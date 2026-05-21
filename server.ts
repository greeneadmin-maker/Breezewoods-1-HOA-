import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import admin from 'firebase-admin';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import rateLimit from 'express-rate-limit';

dotenv.config();

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));

// Initialize Firebase Admin for verifying ID tokens
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: config.projectId
});

let _db: FirebaseFirestore.Firestore | null = null;
const getDb = () => {
    if (!_db) {
        _db = admin.firestore();
        _db.settings({ databaseId: config.firestoreDatabaseId });
    }
    return _db;
};


const app = express();
app.set('trust proxy', 1);

// Security and Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150, // limit each IP to 150 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json());
app.use('/api', apiLimiter);
const PORT = 3000;

// Middleware to verify Firebase token
const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

// Google Sheets setup
const getSheetsClient = (req: express.Request) => {
    const accessToken = req.headers['x-google-access-token'] as string;
    if (accessToken) {
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });
        return google.sheets({ version: 'v4', auth: oauth2Client });
    }

    if (!process.env.GOOGLE_SHEETS_PRIVATE_KEY || !process.env.GOOGLE_SHEETS_CLIENT_EMAIL) {
        throw new Error("Google Sheets credentials are not configured and no access token provided.");
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
          client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL.replace(/"/g, ''),
          private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/"/g, ''),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
    });

    return google.sheets({ version: 'v4', auth });
};

// Helper to get active spreadsheet id
const getSettings = async (token: string) => {
    const url = `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/settings/appSettings`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
        if (res.status === 404) return {};
        console.error("Firestore REST error", await res.text());
        return {};
    }
    const data = await res.json();
    return {
        spreadsheetId: data.fields?.spreadsheetId?.stringValue
    };
};

// API routes
app.get("/api/homeowners", requireAuth, async (req, res) => {
  try {
    const token = req.headers.authorization!.split('Bearer ')[1];
    const settings = await getSettings(token);
    const spreadsheetId = settings.spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    if (!spreadsheetId) {
        return res.status(404).json({ error: "Spreadsheet not setup yet" });
    }

    const sheets = getSheetsClient(req);
    const ledgerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Ledger!A4:E', // Modified to get column E as well
    });

    const allYears = ['2023', '2024', '2025', '2026', '2027'];
    const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
    const availableSheets = spreadsheetInfo.data.sheets?.map(s => s.properties?.title) || [];
    const validYears = allYears.filter(y => availableSheets.includes(y));

    let yearRangesData: any[] = [];
    if (validYears.length > 0) {
      const response = await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: validYears.map(y => `'${y}'!A:AK`),
      });
      yearRangesData = response.data.valueRanges || [];
    }

    const homeownerLatestMonth = new Map<string, string>();
    yearRangesData.forEach((range, index) => {
        const year = validYears[index];
        const rows = range.values || [];
        rows.forEach((row: any) => {
            const homeownerId = row[0];
            if (!homeownerId) return;

            for (let month = 1; month <= 12; month++) {
                const amountIdx = (month - 1) * 3 + 1;
                const amount = row[amountIdx];
                if (amount && amount.toString().trim() !== '') {
                    const monthStr = month.toString().padStart(2, '0');
                    const monthKey = `${year}-${monthStr}`;
                    const currentLatest = homeownerLatestMonth.get(homeownerId);
                    if (!currentLatest || monthKey > currentLatest) {
                        homeownerLatestMonth.set(homeownerId, monthKey);
                    }
                }
            }
        });
    });

    const current = new Date();
    const currentYear = current.getFullYear();
    const currentMonth = current.getMonth() + 1;

    const rows = ledgerResponse.data.values || [];
    const homeowners = rows.filter((row: any) => row[2] && row[2].trim() !== '').map((row: any, index: number) => {
      // Parse block and lot like "1 - 1" or "2 - 4 & 5"
      const blockLot = row[0] || '';
      const [block, ...lotArr] = blockLot.split('-');
      const formattedBlock = block?.trim() || 'N/A';
      const formattedLot = lotArr.join('-')?.trim() || 'N/A';
      const id = (formattedBlock === 'N/A' || formattedLot === 'N/A') ? `HO-${index + 4}` : `BW1-B${formattedBlock}L${formattedLot}`;
      
      let calculatedStatus = 'Pending';
      const latest = homeownerLatestMonth.get(id);
      
      if (latest) {
          const [yStr, mStr] = latest.split('-');
          const diff = (currentYear - parseInt(yStr, 10)) * 12 + (currentMonth - parseInt(mStr, 10));
          if (diff >= 3) {
              calculatedStatus = 'Delinquent';
          } else if (diff <= 0) {
              calculatedStatus = 'Updated';
          } else {
              calculatedStatus = `${diff} Month${diff > 1 ? 's' : ''} Delayed`;
          }
      } else {
          // If no payments found, are they delinquent?
          // If they just joined, maybe they are just Delayed. Let's make them Delinquent if no payments recorded.
          calculatedStatus = 'Delinquent';
      }

      // If resident status is exempt or something, maybe override? 
      // User didn't specify.

      return {
        id,
        name: row[2]?.trim(),
        block: formattedBlock,
        lot: formattedLot,
        residentStatus: row[4]?.trim() || 'Homeowner', // Added residentStatus from Column E
        status: calculatedStatus,
        lastCoveredMonth: latest || 'None',
      };
    });

    // SYNC TO FIRESTORE SO PUBLIC CAN VIEW WITHOUT API KEYS
    try {
        const token = req.headers.authorization!.split('Bearer ')[1];
        const requests = homeowners.map((ho: any) => {
            const hId = ho.id;
            const ledger: any[] = [];
            yearRangesData.forEach((range, idx) => {
                const yr = validYears[idx];
                const rowsYr = range.values || [];
                const yrRow = rowsYr.find((r: any) => r[0] === hId);
                if (yrRow) {
                    for (let m = 1; m <= 12; m++) {
                        const amt = yrRow[(m-1)*3 + 1];
                        const orNum = yrRow[(m-1)*3 + 2];
                        const pDate = yrRow[(m-1)*3 + 3];
                        const pAmount = amt ? Number(amt.toString().replace(/,/g, '')) : 0;
                        if ((orNum && orNum.trim() !== '') || (!isNaN(pAmount) && pAmount > 0) || (pDate && pDate.trim() !== '')) {
                            ledger.push({
                                id: `${yr}-${m.toString().padStart(2, '0')}`,
                                monthCovered: `${yr}-${m.toString().padStart(2, '0')}`,
                                amount: isNaN(pAmount) ? 0 : pAmount,
                                date: pDate || '',
                                orNumber: orNum || 'N/A'
                            });
                        }
                    }
                }
            });
            
            // Build Document format for Firestore REST API
            const docData = {
                fields: {
                    homeowner: {
                        mapValue: {
                            fields: {
                                id: { stringValue: ho.id },
                                name: { stringValue: ho.name },
                                block: { stringValue: ho.block },
                                lot: { stringValue: ho.lot },
                                residentStatus: { stringValue: ho.residentStatus || 'Homeowner' },
                                status: { stringValue: ho.status },
                                lastCoveredMonth: { stringValue: ho.lastCoveredMonth }
                            }
                        }
                    },
                    ledger: {
                        arrayValue: {
                            values: ledger.map(item => ({
                                mapValue: {
                                    fields: {
                                        id: { stringValue: item.id },
                                        monthCovered: { stringValue: item.monthCovered },
                                        amount: { doubleValue: typeof item.amount === 'number' ? item.amount : 0 },
                                        date: { stringValue: item.date },
                                        orNumber: { stringValue: item.orNumber }
                                    }
                                }
                            }))
                        }
                    },
                    updatedAt: { stringValue: new Date().toISOString() }
                }
            };

            return fetch(`https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/public_portal/${hId}`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(docData)
            });
        });
        
        await Promise.all(requests);
        console.log("Successfully synced portal data to Firestore via REST.");
    } catch(syncErr) {
        console.error("Firestore sync error:", syncErr);
    }

    res.json(homeowners);
  } catch (error: any) {
    console.error('Error fetching homeowners:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/sheet-info", requireAuth, async (req, res) => {
    try {
        const token = req.headers.authorization!.split('Bearer ')[1];
        const settings = await getSettings(token);
        const spreadsheetId = settings.spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
        if (!spreadsheetId) {
            return res.json({ setup: false });
        }
        res.json({ setup: true, spreadsheetId, url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/setup-sheet", requireAuth, async (req, res) => {
  try {
    const sheets = getSheetsClient(req);
    
    // Create new spreadsheet
    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: "Breezewoods 1 HOA Ledger",
        },
        sheets: [
          { properties: { title: "Ledger" } },
          { properties: { title: "Payments" } }
        ]
      }
    });

    const spreadsheetId = response.data.spreadsheetId;
    
    // Setup headers
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId!,
      range: 'Ledger!A1:D1',
      valueInputOption: 'RAW',
      requestBody: {
          values: [['Block/Lot', 'Account Status', 'Homeowner Name', 'Resident Status']]
      }
    });
    
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId!,
      range: 'Payments!A1:F1',
      valueInputOption: 'RAW',
      requestBody: {
          values: [['ID', 'Homeowner ID', 'Date', 'Amount', 'OR Number', 'Month Covered']]
      }
    });

    // Save to Firestore using REST API
    const token = req.headers.authorization!.split('Bearer ')[1];
    
    await fetch(`https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/settings/appSettings?updateMask.fieldPaths=spreadsheetId`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          spreadsheetId: { stringValue: spreadsheetId }
        }
      })
    });

    res.json({ spreadsheetId, url: response.data.spreadsheetUrl });
  } catch (error: any) {
    console.error('Error setting up sheet:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/homeowners", requireAuth, async (req, res) => {
  try {
    const { name, block, lot, residentStatus = 'Homeowner' } = req.body;
    
    if (!name || !block || !lot) {
      return res.status(400).json({ error: "Missing required fields: name, block, lot" });
    }

    const token = req.headers.authorization!.split('Bearer ')[1];
    const settings = await getSettings(token);
    const spreadsheetId = settings.spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    if (!spreadsheetId) {
        return res.status(404).json({ error: "Spreadsheet not setup yet" });
    }

    const sheets = getSheetsClient(req);
    
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Ledger!A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [
          [`${block} - ${lot}`, 'Delinquent', name, '', residentStatus]
        ]
      }
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error adding homeowner:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mocked payments fetch
app.get("/api/ledgers/:homeownerId", requireAuth, async (req, res) => {
  try {
    const { homeownerId } = req.params;
    const token = req.headers.authorization!.split('Bearer ')[1];
    const settings = await getSettings(token);
    const spreadsheetId = settings.spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    if (!spreadsheetId) {
        return res.status(404).json({ error: "Spreadsheet not setup yet" });
    }
    const sheets = getSheetsClient(req);
    const payments: any[] = [];
    const allYears = ['2023', '2024', '2025', '2026', '2027'];
    
    try {
      const spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId });
      const availableSheets = spreadsheetInfo.data.sheets?.map(s => s.properties?.title) || [];
      const validYears = allYears.filter(y => availableSheets.includes(y));

      if (validYears.length === 0) {
        return res.json([]);
      }

      const response = await sheets.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges: validYears.map(y => `'${y}'!A:AK`),
      });

      const valueRanges = response.data.valueRanges || [];
      valueRanges.forEach((range, index) => {
        const year = validYears[index];
        const rows = range.values || [];
        const row = rows.find((r: any) => r[0] === homeownerId);
        
        if (row) {
          for (let month = 1; month <= 12; month++) {
            const amountIdx = (month - 1) * 3 + 1;
            const orNumberIdx = (month - 1) * 3 + 2;
            const paidDateIdx = (month - 1) * 3 + 3;
            
            const amount = row[amountIdx];
            const orNumber = row[orNumberIdx];
            const date = row[paidDateIdx];
            
            const parsedAmount = amount ? Number(amount.toString().replace(/,/g, '')) : 0;

            if ((orNumber && orNumber.trim() !== '') || (!isNaN(parsedAmount) && parsedAmount > 0) || (date && date.trim() !== '')) {
              const monthStr = month.toString().padStart(2, '0');
              payments.push({
                id: `${year}-${monthStr}`,
                homeownerId,
                date: date || '',
                amount: isNaN(parsedAmount) ? 0 : parsedAmount,
                orNumber: orNumber || 'N/A',
                monthCovered: `${year}-${monthStr}`,
              });
            }
          }
        }
      });
      res.json(payments);
    } catch (err: any) {
      console.error('Error fetching batch ledgers:', err.message);
      // If Payments sheet doesn't exist, return empty
      res.json([]);
    }
  } catch (error: any) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: error.message });
  }
});


app.post("/api/ledgers/:homeownerId", requireAuth, async (req, res) => {
  try {
    const { homeownerId } = req.params;
    const { amount, orNumber, monthCovered, date } = req.body;
    
    if (!amount || !orNumber || !monthCovered || !date) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const token = req.headers.authorization!.split('Bearer ')[1];
    const settings = await getSettings(token);
    const spreadsheetId = settings.spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    if (!spreadsheetId) {
        return res.status(404).json({ error: "Spreadsheet not setup yet" });
    }

    const sheets = getSheetsClient(req);
    const paymentId = Math.random().toString(36).substring(7);

    const yearStr = monthCovered.split('-')[0];
    const monthStr = monthCovered.split('-')[1];
    const monthNum = parseInt(monthStr, 10);
    const sheetName = yearStr;

    let rows: any[] = [];
    try {
      const getRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A:A`,
      });
      rows = getRes.data.values || [];
    } catch (e: any) {
      return res.status(404).json({ error: `Sheet for year '${sheetName}' does not exist. Please create it first.` });
    }

    let rowIndex = rows.findIndex(row => row[0] === homeownerId);
    let action = 'update';

    if (rowIndex === -1) {
      rowIndex = rows.length;
      action = 'append';
    }

    function colToLetter(col: number) {
      let letter = '';
      while (col > 0) {
        let temp = (col - 1) % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        col = (col - temp - 1) / 26;
      }
      return letter;
    }

    const amountColIdx = (monthNum - 1) * 3 + 2; 
    const endColIdx = amountColIdx + 2;

    const startColLetter = colToLetter(amountColIdx);
    const endColLetter = colToLetter(endColIdx);
    
    // rowIndex is 0-based for the data returned from A:A (if we got the exact range A:A)
    // Actually, A:A might have length N. So next row is N + 1.
    const sheetsRow = rowIndex + 1;
    const updateRange = `'${sheetName}'!${startColLetter}${sheetsRow}:${endColLetter}${sheetsRow}`;

    if (action === 'append') {
      const rowData = new Array(endColIdx).fill('');
      rowData[0] = homeownerId;
      rowData[amountColIdx - 1] = amount;
      rowData[amountColIdx] = orNumber;
      rowData[amountColIdx + 1] = date;
      
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sheetName}'!A:A`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [rowData]
        }
      });
    } else {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: updateRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[amount, orNumber, date]]
        }
      });
    }

    const collectorEmail = (req as any).user?.email || 'Unknown User';
    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: 'Payments!A:G',
            valueInputOption: 'USER_ENTERED',
            requestBody: {
              values: [[paymentId, homeownerId, amount, orNumber, monthCovered, date, collectorEmail]]
            }
        });
    } catch (paymentLogError) {
        console.error('Quietly failing appending to Payments sheet. It might not exist.', paymentLogError);
    }

    res.json({ success: true, paymentId });
  } catch (error: any) {
    console.error('Error adding payment:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/dashboard-stats", requireAuth, async (req, res) => {
  try {
    const token = req.headers.authorization!.split('Bearer ')[1];
    const settings = await getSettings(token);
    const spreadsheetId = settings.spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    
    if (!spreadsheetId) {
        return res.status(404).json({ error: "Spreadsheet not setup yet" });
    }

    const sheets = getSheetsClient(req);
    
    // Fetch payments to aggregate collections over time and collector performance
    let paymentsData: any[] = [];
    try {
        const paymentsRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Payments!A2:G',
        });
        paymentsData = paymentsRes.data.values || [];
    } catch (e) {
        console.log("Payments sheet not found or empty.");
    }
    
    const collectionsByMonth: Record<string, number> = {};
    const collectionsByCollector: Record<string, number> = {};
    
    paymentsData.forEach((row: any) => {
        const amount = Number(row[2]) || 0;
        const dateStr = row[5]; // date of payment
        if (dateStr) { // Use YYYY-MM from date string
            const ym = String(dateStr).substring(0, 7);
            collectionsByMonth[ym] = (collectionsByMonth[ym] || 0) + amount;
        }
        
        const collector = row[6] || 'Unknown';
        collectionsByCollector[collector] = (collectionsByCollector[collector] || 0) + amount;
    });

    res.json({
        collectionsByMonth,
        collectionsByCollector
    });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Portal PIN configuration
app.get("/api/portal-pin", requireAuth, async (req, res) => {
    try {
        const token = req.headers.authorization!.split('Bearer ')[1];
        const resDb = await fetch(`https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/settings/portal`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resDb.ok) {
            return res.json({ pin: '123456' });
        }
        const doc = await resDb.json();
        const pin = doc.fields?.pin?.stringValue || '123456';
        res.json({ pin });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

app.post("/api/portal-pin", requireAuth, async (req, res) => {
    try {
        const { pin } = req.body;
        const token = req.headers.authorization!.split('Bearer ')[1];
        const resDb = await fetch(`https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/settings/portal?updateMask.fieldPaths=pin&updateMask.fieldPaths=lastUpdated`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: {
                    pin: { stringValue: pin },
                    lastUpdated: { stringValue: new Date().toISOString() }
                }
            })
        });
        if (!resDb.ok) throw new Error(await resDb.text());
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Public Portal Login (PIN + Block/Lot)
app.get("/api/public/portal/:homeownerId", async (req, res) => {
    try {
        const { homeownerId } = req.params;
        console.log(`[Public Portal] Request for homeownerId: ${homeownerId}`);
        const resDb = await fetch(`https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/public_portal/${homeownerId}`);
        if (!resDb.ok) {
            console.error(`[Public Portal] Firestore error. Status: ${resDb.status}, Text: ${await resDb.text()}`);
            return res.status(404).json({ error: "Portal data not found. An administrator must view the directory once to generate this link." });
        }
        const doc = await resDb.json();
        
        // Parse the complex REST structure back to simple JSON
        const homeowner = {
            id: doc.fields?.homeowner?.mapValue?.fields?.id?.stringValue,
            name: doc.fields?.homeowner?.mapValue?.fields?.name?.stringValue,
            block: doc.fields?.homeowner?.mapValue?.fields?.block?.stringValue,
            lot: doc.fields?.homeowner?.mapValue?.fields?.lot?.stringValue,
            residentStatus: doc.fields?.homeowner?.mapValue?.fields?.residentStatus?.stringValue,
            status: doc.fields?.homeowner?.mapValue?.fields?.status?.stringValue,
            lastCoveredMonth: doc.fields?.homeowner?.mapValue?.fields?.lastCoveredMonth?.stringValue,
        };
        const ledger = doc.fields?.ledger?.arrayValue?.values?.map((val: any) => ({
            id: val.mapValue?.fields?.id?.stringValue,
            monthCovered: val.mapValue?.fields?.monthCovered?.stringValue,
            amount: val.mapValue?.fields?.amount?.doubleValue || val.mapValue?.fields?.amount?.integerValue || 0,
            date: val.mapValue?.fields?.date?.stringValue,
            orNumber: val.mapValue?.fields?.orNumber?.stringValue,
        })) || [];
        
        console.log(`[Public Portal] Success yielding ${ledger.length} ledger items.`);
        res.json({ success: true, homeowner, ledger, updatedAt: doc.fields?.updatedAt?.stringValue });
    } catch (error: any) {
        console.error(`[Public Portal] Exception: ${error.stack}`);
        res.status(500).json({ error: error.message });
    }
});

// LEGACY handler for cached PWAs that are still sending POST
app.post("/api/public/login", async (req, res) => {
    try {
        const { pin, blockLot } = req.body;
        console.log(`[Legacy PWA] Request for blockLot: ${blockLot}`);
        if (!blockLot) return res.status(400).json({ error: "Block/Lot is required." });
        
        let finalId = blockLot;
        if (!finalId.startsWith('BW1-') && !finalId.startsWith('HO-')) {
            const parts = finalId.split('-');
            if (parts.length >= 2) {
                finalId = `BW1-B${parts[0].trim()}L${parts.slice(1).join('-').trim()}`;
            }
        }
        
        const resDb = await fetch(`https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/public_portal/${finalId}`);
        if (!resDb.ok) {
            return res.status(404).json({ error: "Portal data not found. Wait for an admin to synchronize the directory." });
        }
        const doc = await resDb.json();
        
        const homeowner = {
            id: doc.fields?.homeowner?.mapValue?.fields?.id?.stringValue,
            name: doc.fields?.homeowner?.mapValue?.fields?.name?.stringValue,
            block: doc.fields?.homeowner?.mapValue?.fields?.block?.stringValue,
            lot: doc.fields?.homeowner?.mapValue?.fields?.lot?.stringValue,
            residentStatus: doc.fields?.homeowner?.mapValue?.fields?.residentStatus?.stringValue,
            status: doc.fields?.homeowner?.mapValue?.fields?.status?.stringValue,
            lastCoveredMonth: doc.fields?.homeowner?.mapValue?.fields?.lastCoveredMonth?.stringValue,
        };
        const ledger = doc.fields?.ledger?.arrayValue?.values?.map((val: any) => ({
            id: val.mapValue?.fields?.id?.stringValue,
            monthCovered: val.mapValue?.fields?.monthCovered?.stringValue,
            amount: val.mapValue?.fields?.amount?.doubleValue || val.mapValue?.fields?.amount?.integerValue || 0,
            date: val.mapValue?.fields?.date?.stringValue,
            orNumber: val.mapValue?.fields?.orNumber?.stringValue,
        })) || [];
        
        res.json({ success: true, homeowner, ledger });
    } catch (error: any) {
        console.error(`[Legacy PWA] Exception: ${error.stack}`);
        res.status(500).json({ error: error.message });
    }
});

// LEGACY handler for cached PWAs calling ledgers explicitly
app.get("/api/public/ledgers/:homeownerId", async (req, res) => {
    try {
        const { homeownerId } = req.params;
        const resDb = await fetch(`https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/public_portal/${homeownerId}`);
        if (!resDb.ok) return res.json([]);
        const doc = await resDb.json();
        const ledger = doc.fields?.ledger?.arrayValue?.values?.map((val: any) => ({
            id: val.mapValue?.fields?.id?.stringValue,
            monthCovered: val.mapValue?.fields?.monthCovered?.stringValue,
            amount: val.mapValue?.fields?.amount?.doubleValue || val.mapValue?.fields?.amount?.integerValue || 0,
            date: val.mapValue?.fields?.date?.stringValue,
            orNumber: val.mapValue?.fields?.orNumber?.stringValue,
        })) || [];
        res.json(ledger);
    } catch (e) {
        res.json([]);
    }
});



// Submit a proof
app.post("/api/public/proofs", async (req, res) => {
    try {
        const { homeownerId, name, amount, date, reference, notes } = req.body;
        // Using REST API POST to create a new document in 'pending_payments'
         const docData = {
            fields: {
                homeownerId: { stringValue: homeownerId },
                name: { stringValue: name || '' },
                amount: { doubleValue: Number(amount) },
                date: { stringValue: date || '' },
                reference: { stringValue: reference || '' },
                notes: { stringValue: notes || '' },
                status: { stringValue: 'Pending' },
                submittedAt: { stringValue: new Date().toISOString() }
            }
        };
        const resDb = await fetch(`https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/pending_payments?documentId=${Date.now()}_${homeownerId.replace(/[^a-zA-Z0-9]/g, '')}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(docData)
        });
        if (!resDb.ok) throw new Error(await resDb.text());
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Fetch pending proofs
app.get("/api/proofs", requireAuth, async (req, res) => {
    try {
        const token = req.headers.authorization!.split('Bearer ')[1];
        const resDb = await fetch(`https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/pending_payments?orderBy=submittedAt%20desc`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resDb.ok) throw new Error(await resDb.text());
        const data = await resDb.json();
        const items = (data.documents || []).map((doc: any) => ({
            id: doc.name.split('/').pop(),
            homeownerId: doc.fields?.homeownerId?.stringValue,
            name: doc.fields?.name?.stringValue,
            amount: doc.fields?.amount?.doubleValue || doc.fields?.amount?.integerValue || 0,
            date: doc.fields?.date?.stringValue,
            reference: doc.fields?.reference?.stringValue,
            notes: doc.fields?.notes?.stringValue,
            status: doc.fields?.status?.stringValue,
            submittedAt: doc.fields?.submittedAt?.stringValue,
        }));
        res.json(items);
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

// Update proof status
app.post("/api/proofs/:id/status", requireAuth, async (req, res) => {
    try {
        const { status } = req.body;
        const token = req.headers.authorization!.split('Bearer ')[1];
        const resDb = await fetch(`https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/pending_payments/${req.params.id}?updateMask.fieldPaths=status`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fields: {
                    status: { stringValue: status }
                }
            })
        });
        if (!resDb.ok) throw new Error(await resDb.text());
        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

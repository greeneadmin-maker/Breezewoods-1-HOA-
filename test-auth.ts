import { google } from 'googleapis';
import 'dotenv/config';

async function test() {
    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.replace(/"/g, ''),
                private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, ''),
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        
        const sheets = google.sheets({ version: 'v4', auth });
        const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
        
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'Ledger!A4:C',
        });
        console.log("Success! Data:", response.data.values?.length, "rows");
    } catch (e: any) {
        console.error("Auth failed:", e.message);
    }
}
test();

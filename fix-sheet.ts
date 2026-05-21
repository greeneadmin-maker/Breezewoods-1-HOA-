import { google } from 'googleapis';
import * as dotenv from 'dotenv';
dotenv.config();

const auth = new google.auth.GoogleAuth({
    credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL?.replace(/"/g, ''),
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n').replace(/"/g, ''),
    },
    scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets']
});

async function run() {
    try {
        const drive = google.drive({ version: 'v3', auth });
        // Can we list files?
        const res = await drive.files.list({ q: "mimeType='application/vnd.google-apps.spreadsheet'" });
        const files = res.data.files || [];
        for (const f of files) {
           console.log(`Setting permissions for ${f.id} (${f.name})`);
           await drive.permissions.create({
              fileId: f.id!,
              requestBody: { role: 'writer', type: 'anyone' }
           });
           console.log(`Updated ${f.id}`);
        }
        console.log("Done");
    } catch (e) {
        console.error(e);
    }
}
run();

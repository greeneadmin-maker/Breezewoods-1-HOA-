import * as admin from 'firebase-admin';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: config.projectId
});

const _db = admin.firestore();
_db.settings({ databaseId: config.firestoreDatabaseId });

async function run() {
    try {
        console.log("Testing read...");
        const d = await _db.collection('settings').doc('test').get();
        console.log("Read success", d.exists);
    } catch(e) {
        console.error("Read Error:", e);
    }
}
run();

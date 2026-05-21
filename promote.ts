import admin from 'firebase-admin';
import * as fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));

admin.initializeApp({
  projectId: "green-e-business"
});

async function promote() {
    const db = admin.firestore();
    db.settings({ databaseId: config.firestoreDatabaseId });
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', 'greene.smm.1@gmail.com').get();
    
    if (snapshot.empty) {
        console.log("User not found.");
        return;
    }
    
    for (const doc of snapshot.docs) {
        await doc.ref.update({ role: 'Admin', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        console.log(`Promoted ${doc.id}`);
    }
}

promote().catch(console.error);

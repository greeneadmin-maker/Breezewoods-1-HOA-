const admin = require('firebase-admin');
const config = require('./firebase-applet-config.json');

const app = admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: config.projectId
});

const { getFirestore } = require('firebase-admin/firestore');

async function test() {
  try {
    const db = getFirestore(app, config.firestoreDatabaseId); // getFirestore(app, databaseId)
    const doc = await db.collection('settings').doc('appSettings').get();
    console.log("Success! Data:", doc.data());
  } catch (err) {
    console.error("Error connecting:", err);
  }
}

test();

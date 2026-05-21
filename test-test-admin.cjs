const admin = require('firebase-admin');
const config = require('./firebase-applet-config.json');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: config.projectId
});

const getDb = () => {
    const db = admin.firestore();
    db.settings({ databaseId: config.firestoreDatabaseId });
    return db;
};

async function test() {
  try {
    const db = getDb();
    const doc = await db.collection('settings').doc('appSettings').get();
    console.log("Success! Data:", doc.data());
  } catch (err) {
    console.error("Error connecting:", err);
  }
}

test();

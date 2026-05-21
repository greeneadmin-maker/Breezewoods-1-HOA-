const { Firestore } = require('@google-cloud/firestore');
const config = require('./firebase-applet-config.json');
const db = new Firestore({
  projectId: config.projectId,
  databaseId: config.firestoreDatabaseId
});

async function test() {
  try {
    const doc = await db.collection('settings').doc('appSettings').get();
    console.log("Success! Data:", doc.data());
  } catch (err) {
    console.error("Error connecting:", err);
  }
}

test();

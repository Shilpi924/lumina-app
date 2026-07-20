import admin from 'firebase-admin';
admin.initializeApp({ projectId: 'lumina-kaboom' });
const db = admin.firestore();
const snapshot = await db.collection('developerApiUsageEvents').orderBy('createdAt', 'desc').limit(5).get();
snapshot.forEach(doc => console.log(doc.id, '=>', doc.data()));

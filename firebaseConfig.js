// firebaseConfig.js
// 1) Replace the object below with your Firebase project's config
// 2) Keep compat SDKs in index.html
const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};
firebase.initializeApp(firebaseConfig);
firebase.firestore().enablePersistence?.().catch(()=>{}); // optional offline cache

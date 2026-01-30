// Firebase Configuration
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// TODO: Replace with your Firebase config
const firebaseConfig = {
    apiKey: "Your api key",
    authDomain: "Your key",
    projectId: "your project id",
    storageBucket: "your id",
    messagingSenderId: "your id",
    appId: "your app id",
    // If you have another appId or fields, replace above values accordingly.
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };

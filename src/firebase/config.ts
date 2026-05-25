// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBWW1PPGJ2lyBKwP3rBSZi7T88Km_jaiE8",
    authDomain: "uxd-crm-client.firebaseapp.com",
    projectId: "uxd-crm-client",
    storageBucket: "uxd-crm-client.firebasestorage.app",
    messagingSenderId: "1095077560483",
    appId: "1:1095077560483:web:34bdf27a6cdf21c8c63f16",
    measurementId: "G-WMGV8YTP21"
};

import { getFunctions } from "firebase/functions";
import { getMessaging } from "firebase/messaging";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);
const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

export { app, analytics, auth, db, storage, functions, messaging };
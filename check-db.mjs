import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, orderBy, limit, query } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBWW1PPGJ2lyBKwP3rBSZi7T88Km_jaiE8",
    authDomain: "uxd-crm-client.firebaseapp.com",
    projectId: "uxd-crm-client",
    storageBucket: "uxd-crm-client.firebasestorage.app",
    messagingSenderId: "1095077560483",
    appId: "1:1095077560483:web:34bdf27a6cdf21c8c63f16",
    measurementId: "G-WMGV8YTP21"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
    console.log("Checking notifications...");
    const notifs = await getDocs(query(collection(db, 'notifications'), limit(5)));
    notifs.forEach(doc => {
        console.log("Notification:", doc.id, doc.data().title, doc.data().forRole);
    });

    console.log("\nChecking users with FCM tokens...");
    const users = await getDocs(collection(db, 'users'));
    users.forEach(doc => {
        if (doc.data().fcmToken) {
            console.log("User Has FCM Token:", doc.id, doc.data().name || doc.data().email);
        } else {
            console.log("User Missing FCM Token:", doc.id, doc.data().name || doc.data().email);
        }
    });

    process.exit();
}

run();

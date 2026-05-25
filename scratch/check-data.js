import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

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
    console.log("=== PROJECTS ===");
    const projectsSnap = await getDocs(collection(db, 'projects'));
    projectsSnap.forEach(doc => {
        const data = doc.data();
        console.log(`Project: ID=${doc.id}, Name="${data.name}", AssignedTeam="${data.assignedTeam}", AssignedTeams=${JSON.stringify(data.assignedTeams)}, devTeam=${JSON.stringify(data.devTeam)}`);
    });

    console.log("\n=== EMPLOYEES ===");
    const employeesSnap = await getDocs(collection(db, 'employees'));
    employeesSnap.forEach(doc => {
        const data = doc.data();
        console.log(`Employee: ID=${doc.id}, Name="${data.name}", Email="${data.email}", Team="${data.team}", AuthUid="${data.authUid}"`);
    });

    process.exit();
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});

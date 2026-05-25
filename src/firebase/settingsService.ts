import { doc, getDoc, setDoc, updateDoc, arrayUnion, onSnapshot, query, collection, orderBy, limit } from "firebase/firestore";
import { db } from "./config";


const SETTINGS_COLLECTION = "settings";
const DOCUMENT_ID = "general";

export const settingsService = {
    // Subscribe to industries list updates
    subscribeToIndustries: (callback: (industries: string[]) => void) => {
        const docRef = doc(db, SETTINGS_COLLECTION, DOCUMENT_ID);
        return onSnapshot(docRef, (docSnap: any) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                callback(data.industries || []);
            } else {
                // Check if need to initialize default values or just return empty
                callback([]);
            }
        }, (error: any) => {
            console.error("Error subscribing to industries:", error);
        });
    },

    // Add a new industry to the list
    addIndustry: async (industry: string) => {
        const docRef = doc(db, SETTINGS_COLLECTION, DOCUMENT_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            await updateDoc(docRef, {
                industries: arrayUnion(industry)
            });
        } else {
            // Create document if it doesn't exist
            await setDoc(docRef, {
                industries: [industry]
            });
        }
    },

    // Subscribe to teams list updates
    subscribeToTeams: (callback: (teams: string[]) => void) => {
        const docRef = doc(db, SETTINGS_COLLECTION, DOCUMENT_ID);
        return onSnapshot(docRef, (docSnap: any) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                callback(data.teams || []);
            } else {
                callback([]);
            }
        }, (error: any) => {
            console.error("Error subscribing to teams:", error);
        });
    },

    // Add a new team to the list
    addTeam: async (team: string) => {
        const docRef = doc(db, SETTINGS_COLLECTION, DOCUMENT_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            await updateDoc(docRef, {
                teams: arrayUnion(team)
            });
        } else {
            // Create document if it doesn't exist
            await setDoc(docRef, {
                teams: [team]
            });
        }
    },

    // Subscribe to positions list updates
    subscribeToPositions: (callback: (positions: string[]) => void) => {
        const docRef = doc(db, SETTINGS_COLLECTION, DOCUMENT_ID);
        return onSnapshot(docRef, (docSnap: any) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                callback(data.positions || [
                    "Frontend Developer",
                    "Backend Developer",
                    "Full Stack Developer",
                    "UI/UX Designer",
                    "Product Manager",
                    "Project Manager",
                    "QA Engineer",
                    "DevOps Engineer",
                    "Other"
                ]);
            } else {
                callback([]);
            }
        }, (error: any) => {
            console.error("Error subscribing to positions:", error);
        });
    },

    // Add a new position to the list
    addPosition: async (position: string) => {
        const docRef = doc(db, SETTINGS_COLLECTION, DOCUMENT_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            await updateDoc(docRef, {
                positions: arrayUnion(position)
            });
        } else {
            await setDoc(docRef, {
                positions: [position]
            });
        }
    },

    // Subscribe to experience options list updates
    subscribeToExperienceOptions: (callback: (options: string[]) => void) => {
        const docRef = doc(db, SETTINGS_COLLECTION, DOCUMENT_ID);
        return onSnapshot(docRef, (docSnap: any) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                callback(data.experienceOptions || [
                    "Fresh Graduate",
                    "3 months",
                    "6 months",
                    "1 year",
                    "1.5 years",
                    "2 years",
                    "2+ years",
                    "5+ years"
                ]);
            } else {
                callback([]);
            }
        }, (error: any) => {
            console.error("Error subscribing to experience options:", error);
        });
    },

    // Add a new experience option
    addExperienceOption: async (option: string) => {
        const docRef = doc(db, SETTINGS_COLLECTION, DOCUMENT_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            await updateDoc(docRef, {
                experienceOptions: arrayUnion(option)
            });
        } else {
            await setDoc(docRef, {
                experienceOptions: [option]
            });
        }
    },

    // Subscribe to notice period options list updates
    subscribeToNoticePeriodOptions: (callback: (options: string[]) => void) => {
        const docRef = doc(db, SETTINGS_COLLECTION, DOCUMENT_ID);
        return onSnapshot(docRef, (docSnap: any) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                callback(data.noticePeriodOptions || [
                    "Immediate",
                    "15 Days",
                    "1 Month",
                    "2 Months",
                    "3 Months"
                ]);
            } else {
                callback([]);
            }
        }, (error: any) => {
            console.error("Error subscribing to notice period options:", error);
        });
    },

    // Add a new notice period option
    addNoticePeriodOption: async (option: string) => {
        const docRef = doc(db, SETTINGS_COLLECTION, DOCUMENT_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            await updateDoc(docRef, {
                noticePeriodOptions: arrayUnion(option)
            });
        } else {
            await setDoc(docRef, {
                noticePeriodOptions: [option]
            });
        }
    },

    // Automation Settings
    getAutomationSettings: async (memberId: string) => {
        if (!memberId || memberId === 'none' || memberId === 'all') {
            return null;
        }
        const docRef = doc(db, SETTINGS_COLLECTION, `lead_automation_${memberId}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data();
        }
        return null;
    },

    updateAutomationSettings: async (memberId: string, settings: any) => {
        if (!memberId || memberId === 'none' || memberId === 'all') {
            throw new Error("Invalid member ID for automation settings");
        }
        const docRef = doc(db, SETTINGS_COLLECTION, `lead_automation_${memberId}`);
        await setDoc(docRef, settings, { merge: true });
    },

    // AI API Key Management
    getAiApiKey: async () => {
        const docRef = doc(db, SETTINGS_COLLECTION, "ai_config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data().apiKey || null;
        }
        return null;
    },

    updateAiApiKey: async (apiKey: string) => {
        const docRef = doc(db, SETTINGS_COLLECTION, "ai_config");
        await setDoc(docRef, { apiKey }, { merge: true });
    },

    deleteAiApiKey: async () => {
        const docRef = doc(db, SETTINGS_COLLECTION, "ai_config");
        await updateDoc(docRef, { apiKey: null });
    },

    subscribeToAiApiKey: (callback: (apiKey: string | null) => void) => {
        const docRef = doc(db, SETTINGS_COLLECTION, "ai_config");
        return onSnapshot(docRef, (docSnap: any) => {
            if (docSnap.exists()) {
                callback(docSnap.data().apiKey || null);
            } else {
                callback(null);
            }
        });
    },

    // MongoDB Connection URI Management
    getMongoDbUri: async () => {
        const docRef = doc(db, SETTINGS_COLLECTION, "mongodb");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data().uri || null;
        }
        return null;
    },

    updateMongoDbUri: async (uri: string) => {
        const docRef = doc(db, SETTINGS_COLLECTION, "mongodb");
        await setDoc(docRef, { uri }, { merge: true });
    },

    deleteMongoDbUri: async () => {
        const docRef = doc(db, SETTINGS_COLLECTION, "mongodb");
        await updateDoc(docRef, { uri: null });
    },

    subscribeToMongoDbUri: (callback: (uri: string | null) => void) => {
        const docRef = doc(db, SETTINGS_COLLECTION, "mongodb");
        return onSnapshot(docRef, (docSnap: any) => {
            if (docSnap.exists()) {
                callback(docSnap.data().uri || null);
            } else {
                callback(null);
            }
        });
    },

    subscribeToMongoDbSyncLogs: (callback: (logs: any[]) => void) => {
        const q = query(
            collection(db, "mongodb_sync_logs"),
            orderBy("timestamp", "desc"),
            limit(5)
        );
        return onSnapshot(q, (snapshot: any) => {
            const logs: any[] = [];
            snapshot.forEach((docSnap: any) => {
                logs.push({
                    id: docSnap.id,
                    ...docSnap.data()
                });
            });
            callback(logs);
        }, (error: any) => {
            console.error("Error subscribing to MongoDB sync logs:", error);
        });
    }
};

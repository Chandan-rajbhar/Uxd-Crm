import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    onSnapshot
} from "firebase/firestore";
import { db } from "./config";
import { type App, setApps, setLoading } from "src/store/slices/appsSlice";
import { store } from "src/store/store";

const COLLECTION_NAME = "apps";

export const appsService = {
    // Real-time listener for apps
    subscribeToApps: () => {
        store.dispatch(setLoading(true));
        const q = query(collection(db, COLLECTION_NAME), orderBy("name", "asc"));

        return onSnapshot(q, (snapshot: any) => {
            const apps = snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            })) as App[];

            store.dispatch(setApps(apps));
            store.dispatch(setLoading(false));
        }, (error: any) => {
            console.error("Error subscribing to apps:", error);
            store.dispatch(setLoading(false));
        });
    },

    // Add a new app
    addApp: async (app: Omit<App, 'id'>) => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), app);
            return docRef.id;
        } catch (error) {
            console.error("Error adding app:", error);
            throw error;
        }
    },

    // Update an existing app
    updateApp: async (id: string, app: Partial<App>) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, app);
        } catch (error) {
            console.error("Error updating app:", error);
            throw error;
        }
    },

    // Delete an app
    deleteApp: async (id: string) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Error deleting app:", error);
            throw error;
        }
    }
};

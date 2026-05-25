import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    onSnapshot,
    getDocs,
    getDoc,
    setDoc,
    where,
    serverTimestamp
} from "firebase/firestore";
import { db } from "./config";
import { getFunctions, httpsCallable } from "firebase/functions";
import type { Client } from "src/store/slices/clientsSlice";
import { store } from "src/store/store";
import { setClients, setLoading } from "src/store/slices/clientsSlice";
import { cleanData, makeSerializable } from "src/lib/firebaseUtils";

const COLLECTION_NAME = "clients";

export const clientService = {
    // Real-time listener for clients
    subscribeToClients: () => {
        store.dispatch(setLoading(true));
        const q = query(collection(db, COLLECTION_NAME), orderBy("name", "asc"));

        return onSnapshot(q, (snapshot: any) => {
            const clients = snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            })) as unknown as Client[];

            store.dispatch(setClients(makeSerializable(clients)));
            store.dispatch(setLoading(false));
        }, (error: any) => {
            console.error("Error subscribing to clients:", error);
            store.dispatch(setLoading(false));
        });
    },

    // Add a new client
    addClient: async (client: Omit<Client, 'id'> & { password?: string }) => {
        try {
            const cleanedClient = cleanData(client);
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...cleanedClient,
                createdAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error adding client:", error);
            throw error;
        }
    },

    // Update an existing client
    updateClient: async (id: string, client: Partial<Client> & { password?: string }) => {
        try {
            const cleanedClient = cleanData(client);
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, cleanedClient);
        } catch (error) {
            console.error("Error updating client:", error);
            throw error;
        }
    },

    // Delete a client
    deleteClient: async (id: string) => {
        try {
            // Delete intelligence subcollection doc first to prevent storage leaks
            const intelRef = doc(db, COLLECTION_NAME, id, 'intelligence', 'profile');
            await deleteDoc(intelRef).catch(() => {}); // Catch safely if it never had intelligence generated
            
            const docRef = doc(db, COLLECTION_NAME, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Error deleting client:", error);
            throw error;
        }
    },

    // Check if email already exists (excludeId is used when editing to exclude the current client)
    checkEmailExists: async (email: string, excludeId?: string): Promise<boolean> => {
        try {
            const q = query(collection(db, COLLECTION_NAME), where("email", "==", email.toLowerCase().trim()));
            const snapshot = await getDocs(q);

            if (snapshot.empty) return false;

            // If editing, check if the found email belongs to a different client
            if (excludeId) {
                return snapshot.docs.some((doc: any) => doc.id !== excludeId);
            }

            return true;
        } catch (error) {
            console.error("Error checking email:", error);
            throw error;
        }
    },

    // AI Research Function
    researchClient: async (name: string, company: string) => {
        try {
            console.info(`Calling researchClient for ${name} at ${company}...`);
            const functions = getFunctions();
            const researchFn = httpsCallable(functions, 'researchClient');
            const result = await researchFn({ name, company });
            console.info("Research result:", result.data);
            return result.data as { success: boolean; intelligence: string; sources: { title: string; url: string }[]; images: string[] };
        } catch (error) {
            console.error("Error researching client:", error);
            throw error;
        }
    },

    // Subcollection methods to offload heavy payload
    updateIntelligence: async (id: string, data: any) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id, 'intelligence', 'profile');
            await setDoc(docRef, data, { merge: true });
        } catch (error) {
            console.error("Error updating intelligence:", error);
            throw error;
        }
    },

    getIntelligence: async (id: string) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id, 'intelligence', 'profile');
            const snap = await getDoc(docRef);
            return snap.exists() ? snap.data() : null;
        } catch (error) {
            console.error("Error fetching intelligence:", error);
            throw error;
        }
    }
};

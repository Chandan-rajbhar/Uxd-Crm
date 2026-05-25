import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    getDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./config";
import { cleanData } from "src/lib/firebaseUtils";

const COLLECTION_NAME = "appLinks";

export interface AppLink {
    id?: string;
    heading: string;
    content: string;
    imageUrl?: string;
    createdAt?: any;
    updatedAt?: any;
}

export const appLinkService = {
    // Get a specific link (public)
    getAppLink: async (id: string) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as AppLink;
            }
            return null;
        } catch (error) {
            console.error("Error getting app link:", error);
            throw error;
        }
    },

    // Real-time listener (admin)
    subscribeToAppLinks: (callback: (links: AppLink[]) => void) => {
        const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));

        return onSnapshot(q, (snapshot: any) => {
            const links = snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            })) as AppLink[];
            callback(links);
        }, (error: any) => {
            console.error("Error subscribing to app links:", error);
        });
    },

    // Add a new link
    addAppLink: async (link: Omit<AppLink, 'id'>) => {
        try {
            const cleanedLink = cleanData(link);
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...cleanedLink,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error adding app link:", error);
            throw error;
        }
    },

    // Update link
    updateAppLink: async (id: string, link: Partial<AppLink>) => {
        try {
            const cleanedLink = cleanData(link);
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, {
                ...cleanedLink,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error updating app link:", error);
            throw error;
        }
    },

    // Delete link
    deleteAppLink: async (id: string) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Error deleting app link:", error);
            throw error;
        }
    },

    // Image Upload
    uploadImage: async (file: File) => {
        try {
            const fileRef = ref(storage, `app-links/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(fileRef, file);
            return await getDownloadURL(snapshot.ref);
        } catch (error) {
            console.error("Error uploading file:", error);
            throw error;
        }
    }
};

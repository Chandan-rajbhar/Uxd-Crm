import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    serverTimestamp,
    getDoc,
    where,
    limit,
    getCountFromServer
} from "firebase/firestore";
import { db } from "./config";

const COLLECTION_NAME = "assets";

export const assetService = {
    subscribeToAssets: (callback?: (assets: any[], error?: any) => void, filterCategory?: string | null, limitCount: number = 200) => {
        let q;
        if (filterCategory && filterCategory !== 'All') {
            q = query(
                collection(db, COLLECTION_NAME), 
                where("category", "==", filterCategory),
                orderBy("model", "asc"),
                limit(limitCount)
            );
        } else {
            q = query(
                collection(db, COLLECTION_NAME), 
                orderBy("model", "asc"),
                limit(limitCount)
            );
        }

        // This returns the unsubscribe function
        return onSnapshot(q,
            (snapshot: any) => {
                const assets = snapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    ...doc.data()
                }));

                if (callback) callback(assets);

                // Dispatch event for legacy listeners if any
                window.dispatchEvent(new CustomEvent('assets-updated', { detail: assets }));
            },
            (error: any) => {
                console.error("Error fetching assets:", error);
                if (callback) callback([], error);
            }
        );
    },

    getAssetStats: async () => {
        try {
            const coll = collection(db, COLLECTION_NAME);
            
            // Low-cost aggregate queries (no document reads)
            const totalPromise = getCountFromServer(coll);
            const activePromise = getCountFromServer(query(coll, where("status", "==", "Active")));
            const inRepairPromise = getCountFromServer(query(coll, where("status", "==", "In Repair")));
            // Unassigned counts where assignedTo is explicitly "Unassigned" or empty/null
            const unassignedPromise = getCountFromServer(query(coll, where("assignedTo", "==", "Unassigned")));

            const [total, active, repair, unassigned] = await Promise.all([
                totalPromise, activePromise, inRepairPromise, unassignedPromise
            ]);

            return {
                total: total.data().count,
                active: active.data().count,
                inRepair: repair.data().count,
                unassigned: unassigned.data().count
            };
        } catch (error) {
            console.error("Error getting asset stats:", error);
            return { total: 0, active: 0, inRepair: 0, unassigned: 0 };
        }
    },

    addAsset: async (assetData: any) => {
        return await addDoc(collection(db, COLLECTION_NAME), {
            ...assetData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    },

    updateAsset: async (id: string, assetData: any) => {
        const assetRef = doc(db, COLLECTION_NAME, id);
        return await updateDoc(assetRef, {
            ...assetData,
            updatedAt: serverTimestamp()
        });
    },

    deleteAsset: async (id: string) => {
        const assetRef = doc(db, COLLECTION_NAME, id);
        return await deleteDoc(assetRef);
    },

    getAsset: async (id: string) => {
        const assetRef = doc(db, COLLECTION_NAME, id);
        const assetSnap = await getDoc(assetRef);
        if (assetSnap.exists()) {
            return { id: assetSnap.id, ...assetSnap.data() };
        } else {
            return null;
        }
    }
};

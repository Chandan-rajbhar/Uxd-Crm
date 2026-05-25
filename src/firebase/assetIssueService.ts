import { 
    collection, 
    addDoc, 
    updateDoc, 
    doc, 
    query, 
    onSnapshot, 
    serverTimestamp,
    where
} from "firebase/firestore";
import { db } from "./config";

export interface AssetIssue {
    id?: string;
    employeeName: string;
    employeeEmail: string;
    employeeId: string;
    category: string;
    description: string;
    status: 'Pending' | 'Fixed';
    createdAt: any;
    fixedAt?: any;
}

const COLLECTION_NAME = "assetIssues";

export const assetIssueService = {
    // Add a new issue
    addIssue: async (issue: Omit<AssetIssue, 'id' | 'status' | 'createdAt'>) => {
        try {
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...issue,
                status: 'Pending',
                createdAt: serverTimestamp(),
            });
            return docRef.id;
        } catch (error) {
            console.error("Error adding asset issue:", error);
            throw error;
        }
    },

    // Mark issue as fixed
    markAsFixed: async (issueId: string) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, issueId);
            await updateDoc(docRef, {
                status: 'Fixed',
                fixedAt: serverTimestamp(),
            });
        } catch (error) {
            console.error("Error marking issue as fixed:", error);
            throw error;
        }
    },

    // Subscribe to all issues (for admin/networking team)
    subscribeToAllIssues: (callback: (issues: AssetIssue[]) => void) => {
        const q = query(collection(db, COLLECTION_NAME));
        return onSnapshot(q, (snapshot: any) => {
            const issues = snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            } as AssetIssue)).sort((a: AssetIssue, b: AssetIssue) => {
                const getT = (doc: AssetIssue) => {
                    if (doc.createdAt?.seconds) return doc.createdAt.seconds * 1000;
                    return new Date(doc.createdAt || 0).getTime();
                };
                return getT(b) - getT(a);
            });
            callback(issues);
        });
    },

    // Subscribe to issues for a specific employee
    subscribeToEmployeeIssues: (employeeId: string, callback: (issues: AssetIssue[]) => void) => {
        const q = query(
            collection(db, COLLECTION_NAME), 
            where("employeeId", "==", employeeId)
        );
        return onSnapshot(q, (snapshot: any) => {
            const issues = snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            } as AssetIssue)).sort((a: AssetIssue, b: AssetIssue) => {
                const getT = (doc: AssetIssue) => {
                    if (doc.createdAt?.seconds) return doc.createdAt.seconds * 1000;
                    return new Date(doc.createdAt || 0).getTime();
                };
                return getT(b) - getT(a);
            });
            callback(issues);
        });
    }
};

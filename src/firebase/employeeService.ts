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
    where
} from "firebase/firestore";
import { db } from "./config";
import type { Employee } from "src/store/slices/employeesSlice";
import { store } from "src/store/store";
import { setEmployees, setLoading, setError } from "src/store/slices/employeesSlice";
import { cleanData, makeSerializable } from "src/lib/firebaseUtils";

const COLLECTION_NAME = "employees";

export const employeeService = {
    subscribeToEmployees: () => {
        store.dispatch(setLoading(true));
        const q = query(collection(db, COLLECTION_NAME), orderBy("name"));

        return onSnapshot(q,
            (snapshot: any) => {
                const employees = snapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    ...doc.data()
                })) as Employee[];
                store.dispatch(setEmployees(makeSerializable(employees)));
                store.dispatch(setLoading(false));
            },
            (error: any) => {
                console.error("Error fetching employees:", error);
                store.dispatch(setError(error.message));
                store.dispatch(setLoading(false));
            }
        );
    },

    addEmployee: async (employee: Omit<Employee, "id"> & { password?: string }) => {
        try {
            const cleanedEmployee = cleanData(employee);
            const docRef = await addDoc(collection(db, COLLECTION_NAME), cleanedEmployee);
            return { id: docRef.id, ...employee };
        } catch (error) {
            console.error("Error adding employee:", error);
            throw error;
        }
    },

    updateEmployee: async (id: string, updates: Partial<Employee>) => {
        try {
            const cleanedUpdates = cleanData(updates);
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, cleanedUpdates);
        } catch (error) {
            console.error("Error updating employee:", error);
            throw error;
        }
    },

    deleteEmployee: async (id: string) => {
        try {
            await deleteDoc(doc(db, COLLECTION_NAME, id));
        } catch (error) {
            console.error("Error deleting employee:", error);
            throw error;
        }
    },

    // Check if email already exists (excludeId is used when editing to exclude the current employee)
    checkEmailExists: async (email: string, excludeId?: string): Promise<boolean> => {
        try {
            const q = query(collection(db, COLLECTION_NAME), where("email", "==", email.toLowerCase().trim()));
            const snapshot = await getDocs(q);

            if (snapshot.empty) return false;

            // If editing, check if the found email belongs to a different employee
            if (excludeId) {
                return snapshot.docs.some((doc: any) => doc.id !== excludeId);
            }

            return true;
        } catch (error) {
            console.error("Error checking email:", error);
            throw error;
        }
    },

    getTeamLeads: async () => {
        try {
            const q = query(collection(db, COLLECTION_NAME), where("isTeamLead", "==", true), orderBy("name"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            })) as Employee[];
        } catch (error) {
            console.error("Error fetching team leads:", error);
            return [];
        }
    },

    getEmployeeById: async (id: string): Promise<Employee | null> => {
        try {
            const snapshot = await getDocs(query(collection(db, COLLECTION_NAME), where("__name__", "==", id)));
            if (snapshot.empty) return null;
            return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Employee;
        } catch (error) {
            console.error("Error fetching employee:", error);
            return null;
        }
    }
};

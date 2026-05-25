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
    where,
    serverTimestamp
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./config";
import type { Blog } from "src/store/slices/blogsSlice";
import { store } from "src/store/store";
import { setBlogs, setLoading } from "src/store/slices/blogsSlice";
import { setBlogProjects, setLoading as setProjectsLoading } from "src/store/slices/blogProjectsSlice";
import { cleanData } from "src/lib/firebaseUtils";

const COLLECTION_NAME = "blogs";
const PROJECTS_COLLECTION = "blogProjects";

export const blogService = {
    // Real-time listener for blog projects
    subscribeToBlogProjects: () => {
        store.dispatch(setProjectsLoading(true));
        const q = query(collection(db, PROJECTS_COLLECTION), orderBy("name", "asc"));
        return onSnapshot(q, (snapshot: any) => {
            const projects = snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            }));
            store.dispatch(setBlogProjects(projects));
            store.dispatch(setProjectsLoading(false));
        }, (error: any) => {
            console.error("Error subscribing to blog projects:", error);
            store.dispatch(setProjectsLoading(false));
        });
    },

    // Add blog project
    addBlogProject: async (project: { name: string, avatar: string }) => {
        try {
            // Check if already exists to avoid duplicates
            const docRef = await addDoc(collection(db, PROJECTS_COLLECTION), {
                ...project,
                createdAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error adding blog project:", error);
            throw error;
        }
    },

    // Delete blog project
    deleteBlogProject: async (id: string) => {
        try {
            await deleteDoc(doc(db, PROJECTS_COLLECTION, id));
        } catch (error) {
            console.error("Error deleting blog project:", error);
            throw error;
        }
    },

    // Real-time listener for blogs
    subscribeToBlogs: () => {
        store.dispatch(setLoading(true));
        const q = query(collection(db, COLLECTION_NAME), orderBy("createdAt", "desc"));

        return onSnapshot(q, (snapshot: any) => {
            const blogs = snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            })) as unknown as Blog[];

            store.dispatch(setBlogs(blogs));
            store.dispatch(setLoading(false));
        }, (error: any) => {
            console.error("Error subscribing to blogs:", error);
            store.dispatch(setLoading(false));
        });
    },

    // Add a new blog
    addBlog: async (blog: Omit<Blog, 'id'>) => {
        try {
            const cleanedBlog = cleanData(blog);
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...cleanedBlog,
                createdAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error adding blog:", error);
            throw error;
        }
    },

    // Update an existing blog
    updateBlog: async (id: string, blog: Partial<Blog>) => {
        try {
            const cleanedBlog = cleanData(blog);
            const docRef = doc(db, COLLECTION_NAME, id);
            await updateDoc(docRef, cleanedBlog);
        } catch (error) {
            console.error("Error updating blog:", error);
            throw error;
        }
    },

    // Delete a blog
    deleteBlog: async (id: string) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Error deleting blog:", error);
            throw error;
        }
    },

    // Upload a file to blog storage
    uploadBlogImage: async (file: File) => {
        try {
            const fileRef = ref(storage, `blogs/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(fileRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            return downloadURL;
        } catch (error) {
            console.error("Error uploading file:", error);
            throw error;
        }
    },

    // Delete a file from blog storage
    deleteBlogImage: async (fileUrl: string) => {
        try {
            const decodedUrl = decodeURIComponent(fileUrl);
            const startIndex = decodedUrl.indexOf('/o/') + 3;
            const endIndex = decodedUrl.indexOf('?');
            const filePath = decodedUrl.substring(startIndex, endIndex !== -1 ? endIndex : undefined);

            if (filePath) {
                const fileRef = ref(storage, filePath);
                await deleteObject(fileRef);
            }
        } catch (error) {
            console.error("Error deleting file from storage:", error);
        }
    },

    // Update author name across all relevant collections
    updateAuthorName: async (oldName: string, newName: string) => {
        try {
            if (!oldName || !newName || oldName === newName) return;

            // 1. Update all blogs by this author
            const blogsRef = collection(db, COLLECTION_NAME);
            const q = query(blogsRef, where("author", "==", oldName));
            const snapshot = await getDocs(q);
            
            const blogPromises = snapshot.docs.map((d: any) => 
                updateDoc(doc(db, COLLECTION_NAME, d.id), { author: newName })
            );

            // 2. Update the blogProjects entry if it exists
            const projectsRef = collection(db, PROJECTS_COLLECTION);
            const pq = query(projectsRef, where("name", "==", oldName));
            const psnapshot = await getDocs(pq);
            
            const projectPromises = psnapshot.docs.map((d: any) => 
                updateDoc(doc(db, PROJECTS_COLLECTION, d.id), { name: newName })
            );

            await Promise.all([...blogPromises, ...projectPromises]);
        } catch (error) {
            console.error("Error updating author name across blogs:", error);
            throw error;
        }
    }
};

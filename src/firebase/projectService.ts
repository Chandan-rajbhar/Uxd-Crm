import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    onSnapshot,
    runTransaction,
    serverTimestamp,
    getDocs,
    where,
    getCountFromServer,
    limit,
    getDoc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { httpsCallable } from "firebase/functions";
import { db, storage, functions } from "./config";
import type { Project } from "src/store/slices/projectsSlice";
import { store } from "src/store/store";
import { setProjects, setLoading } from "src/store/slices/projectsSlice";
import { cleanData, makeSerializable } from "src/lib/firebaseUtils";
import { blogService } from "./blogService";

const COLLECTION_NAME = "projects";

export const projectService = {
    // Real-time listener for projects
    subscribeToProjects: (filter?: { clientEmail?: string }, limitCount: number = 200) => {
        store.dispatch(setLoading(true));

        let q;
        if (filter?.clientEmail) {
            q = query(
                collection(db, COLLECTION_NAME), 
                where("clientEmail", "==", filter.clientEmail),
                limit(limitCount)
            );
        } else {
            q = query(
                collection(db, COLLECTION_NAME), 
                orderBy("name", "asc"),
                limit(limitCount)
            );
        }

        return onSnapshot(q, (snapshot: any) => {
            let projects = snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            })) as unknown as Project[];

            // Sort manually if filtering (since we can't use orderBy in query easily)
            if (filter?.clientEmail) {
                projects.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            }

            store.dispatch(setProjects(makeSerializable(projects)));
            store.dispatch(setLoading(false));
        }, (error: any) => {
            console.error("Error subscribing to projects:", error);
            store.dispatch(setLoading(false));
        });
    },

    getProjectStats: async () => {
        try {
            const coll = collection(db, COLLECTION_NAME);
            
            // Parallel 0-read aggregate queries
            const [total, inProgress, completed, critical] = await Promise.all([
                getCountFromServer(coll),
                getCountFromServer(query(coll, where("status", "==", "In Progress"))),
                getCountFromServer(query(coll, where("status", "==", "Completed"))),
                getCountFromServer(query(coll, where("priority", "==", "critical")))
            ]);

            return {
                total: total.data().count,
                inProgress: inProgress.data().count,
                completed: completed.data().count,
                critical: critical.data().count
            };
        } catch (error) {
            console.error("Error getting project stats:", error);
            return { total: 0, inProgress: 0, completed: 0, critical: 0 };
        }
    },

    // Add a new project
    // Add a new project
    addProject: async (project: Omit<Project, 'id'>) => {
        try {
            const cleanedProject = cleanData(project);
            const docRef = await addDoc(collection(db, COLLECTION_NAME), {
                ...cleanedProject,
                createdAt: serverTimestamp()
            });

            return docRef.id;
        } catch (error) {
            console.error("Error adding project:", error);
            throw error;
        }
    },

    // Get a project by ID
    getProjectById: async (id: string) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, id);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                return { id: docSnap.id, ...docSnap.data() } as Project;
            }
            return null;
        } catch (error) {
            console.error("Error getting project:", error);
            throw error;
        }
    },

    // Update an existing project
    updateProject: async (id: string, project: Partial<Project>) => {
        try {
            const cleanedProject = cleanData(project);
            const docRef = doc(db, COLLECTION_NAME, id);

            // If name is being updated, handle cascading changes to blogs
            if (project.name) {
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const oldName = docSnap.data().name;
                    if (oldName && oldName !== project.name) {
                        try {
                            await blogService.updateAuthorName(oldName, project.name);
                        } catch (blogErr) {
                            console.warn("Project name updated but failed to cascade to blogs:", blogErr);
                        }
                    }
                }
            }

            await updateDoc(docRef, cleanedProject);

        } catch (error) {
            console.error("Error updating project:", error);
            throw error;
        }
    },

    // Recursive delete helper for subcollections
    deleteSubcollection: async (projectId: string, subcollectionName: string) => {
        try {
            const subRef = collection(db, COLLECTION_NAME, projectId, subcollectionName);
            const snapshot = await getDocs(subRef);
            const deletePromises = snapshot.docs.map((d: any) => deleteDoc(d.ref));
            await Promise.all(deletePromises);

            // Special Case: aiHistory might have files to delete
            if (subcollectionName === 'aiHistory' || subcollectionName === 'resources') {
                for (const d of snapshot.docs) {
                    const data = d.data();
                    if (data.url) await projectService.deleteProjectFile(data.url).catch(() => {});
                    if (data.content && typeof data.content === 'string' && data.content.startsWith('http')) {
                        await projectService.deleteProjectFile(data.content).catch(() => {});
                    }
                }
            }
        } catch (error) {
            console.warn(`Failed to clean up subcollection ${subcollectionName}:`, error);
        }
    },

    // Delete a project
    deleteProject: async (id: string, projectData?: Project) => {
        try {
            // 1. Cleanup Storage attachments if projectData is provided
            if (projectData?.milestones) {
                for (const m of projectData.milestones) {
                    if (m.attachments) {
                        for (const url of m.attachments) {
                            await projectService.deleteProjectFile(url).catch(e => console.warn("Storage cleanup failed:", e));
                        }
                    }
                }
            }

            // 2. Recursive cleanup of subcollections (Client-side loop)
            const subcollections = ['messages', 'sentEmails', 'receivedEmails', 'resources', 'aiHistory', 'meetings'];
            await Promise.all(subcollections.map(sub => projectService.deleteSubcollection(id, sub)));

            // 3. Delete main document
            const docRef = doc(db, COLLECTION_NAME, id);
            await deleteDoc(docRef);
            
        } catch (error) {
            console.error("Error deleting project:", error);
            throw error;
        }
    },
    // Subscribe to project messages
    subscribeToProjectMessages: (projectId: string, callback: (messages: any[]) => void) => {
        const q = query(
            collection(db, COLLECTION_NAME, projectId, "messages"),
            orderBy("createdAt", "asc")
        );

        return onSnapshot(q, (snapshot: any) => {
            const messages = snapshot.docs.map((doc: any) => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(messages);
        }, (error: any) => {
            console.error("Error subscribing to messages:", error);
        });
    },

    // Send a message
    sendProjectMessage: async (projectId: string, message: { text: string, senderId: string, senderName: string, senderAvatar?: string }) => {
        try {
            await addDoc(collection(db, COLLECTION_NAME, projectId, "messages"), {
                ...message,
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error sending message:", error);
            throw error;
        }
    },

    // Update project milestones (for notes/attachments)
    updateProjectMilestones: async (projectId: string, milestones: any[]) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, projectId);
            await updateDoc(docRef, { milestones });
        } catch (error) {
            console.error("Error updating milestones:", error);
            throw error;
        }
    },

    // Save full email record to avoid 1MB document limit on project
    saveEmailRecord: async (projectId: string, emailData: any) => {
        try {
            const cleanedData = cleanData(emailData);
            await addDoc(collection(db, COLLECTION_NAME, projectId, "sentEmails"), {
                ...cleanedData,
                savedAt: serverTimestamp(),
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error saving email record:", error);
            throw error;
        }
    },

    // Safely add a sent email to a project's history (Subcollection optimization)
    addSentEmail: async (projectId: string, email: any) => {
        try {
            const cleanedEmail = cleanData(email);
            await addDoc(collection(db, COLLECTION_NAME, projectId, "sentEmails"), {
                ...cleanedEmail,
                id: Date.now().toString(),
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error adding sent email:", error);
            throw error;
        }
    },

    // Safely remove a sent email using subcollection ID
    removeSentEmail: async (projectId: string, emailId: string) => {
        try {
            const emailDocRef = doc(db, COLLECTION_NAME, projectId, "sentEmails", emailId);
            await deleteDoc(emailDocRef);
        } catch (error) {
            console.error("Error removing sent email:", error);
            throw error;
        }
    },

    // Lazy load sent emails
    getSentEmails: async (projectId: string) => {
        try {
            // Try ordering by createdAt first (new records have both createdAt and savedAt)
            const q = query(collection(db, COLLECTION_NAME, projectId, "sentEmails"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            const results = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
            
            // Also fetch any records that might only have savedAt (old records missing createdAt)
            // Firestore orderBy excludes docs missing the field, so we need a fallback
            const allDocsQ = query(collection(db, COLLECTION_NAME, projectId, "sentEmails"));
            const allSnapshot = await getDocs(allDocsQ);
            const allDocs = allSnapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
            
            // Merge: add any docs from allDocs that aren't already in results
            const resultIds = new Set(results.map((r: any) => r.id));
            const missingDocs = allDocs.filter((d: any) => !resultIds.has(d.id));
            
            if (missingDocs.length === 0) return results;
            
            // Merge and sort by best available timestamp
            const merged = [...results, ...missingDocs];
            merged.sort((a: any, b: any) => {
                const getTs = (e: any) => {
                    if (e.createdAt?.seconds) return e.createdAt.seconds * 1000;
                    if (e.savedAt?.seconds) return e.savedAt.seconds * 1000;
                    if (e.date) return new Date(e.date).getTime();
                    return 0;
                };
                return getTs(b) - getTs(a);
            });
            return merged;
        } catch (error) {
            console.warn("Failed to fetch sent emails:", error);
            return [];
        }
    },

    // Safely add a milestone to a project without overwriting the whole array from stale state
    addMilestone: async (projectId: string, milestone: any) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, projectId);
            await runTransaction(db, async (transaction: any) => {
                const docSnap = await transaction.get(docRef);
                if (!docSnap.exists()) throw new Error("Project not found");
                const data = docSnap.data();
                const currentMilestones = data.milestones || [];
                transaction.update(docRef, {
                    milestones: [...currentMilestones, milestone]
                });
            });
        } catch (error) {
            console.error("Error adding milestone:", error);
            throw error;
        }
    },

    // Safely migrate tasks from notes to milestones and trackerComments to history
    migrateTasks: async (projectId: string, tasksFromNotes: string[], oldDate: string, newDate: string, trackerComment?: string) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, projectId);
            await runTransaction(db, async (transaction: any) => {
                const docSnap = await transaction.get(docRef);
                if (!docSnap.exists()) throw new Error("Project not found");

                const data = docSnap.data();
                const currentMilestones = data.milestones || [];

                // 1. Migrate Notes to Milestones
                const newMilestones = tasksFromNotes
                    .filter((task: string) => !currentMilestones.some((m: any) => m.task === task.trim()))
                    .map((task: string, index: number) => ({
                        id: `migrated-${Date.now()}-${index}`,
                        task: task.trim(),
                        date: oldDate || "Previous Day",
                        status: 'Pending',
                        description: 'Daily task migrated to timeline.',
                        assignedTo: { name: 'Unassigned', avatar: '' },
                        notes: [],
                        attachments: []
                    }));

                // 2. Migrate Tracker Comment to Subcollection
                if (trackerComment && trackerComment.trim().length > 0) {
                    const commentRef = doc(collection(db, COLLECTION_NAME, projectId, "trackerComments"));
                    transaction.set(commentRef, {
                        comment: trackerComment,
                        date: oldDate || new Date().toISOString(),
                        createdAt: serverTimestamp()
                    });
                }

                if (newMilestones.length === 0 && !data.notes && !data.trackerComment) {
                    transaction.update(docRef, { lastTaskDate: newDate });
                    return;
                }

                transaction.update(docRef, {
                    notes: "",
                    trackerComment: "",
                    milestones: [...currentMilestones, ...newMilestones],
                    lastTaskDate: newDate
                });
            });
        } catch (error) {
            console.error("Error migrating tasks and comments:", error);
            throw error;
        }
    },

    // Upload a file to project storage
    uploadProjectFile: async (projectId: string, file: File) => {
        try {
            const fileRef = ref(storage, `projects/${projectId}/attachments/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(fileRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            return downloadURL;
        } catch (error) {
            console.error("Error uploading file:", error);
            throw error;
        }
    },

    // Delete a file from project storage
    deleteProjectFile: async (fileUrl: string) => {
        try {
            // Need to handle cases where fileUrl might contain query params from Firebase
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
            // Don't throw here to allow Firestore record deletion even if Storage deletion fails
        }
    },

    // Send email via Cloud Function
    sendEmail: async (data: { to: string, cc?: string, bcc?: string, subject: string, text?: string, html?: string, attachments?: { name: string; url: string }[], senderEmail?: string, senderAppPassword?: string, senderDisplayName?: string, inReplyTo?: string, references?: string, leadId?: string, projectId?: string, msgId?: string }) => {
        try {
            const sendEmailFn = httpsCallable(functions, 'sendEmail');
            const result = await sendEmailFn(data);
            return result.data;
        } catch (error) {
            console.error("Error sending email:", error);
            throw error;
        }
    },

    // Extract tasks from rough text via AI
    extractTasks: async (text: string) => {
        try {
            const extractTasksFn = httpsCallable(functions, 'extractTasks');
            const result = await extractTasksFn({ text });
            return result.data as { success: boolean, tasks: { task: string, description: string }[] };
        } catch (error) {
            console.error("Error extracting tasks:", error);
            throw error;
        }
    },

    // Extract tasks from screenshots via AI Vision
    extractTasksFromImages: async (images: { base64: string, mimeType: string }[]) => {
        try {
            const extractTasksFromImagesFn = httpsCallable(functions, 'extractTasksFromImages');
            const result = await extractTasksFromImagesFn({ images });
            return result.data as { success: boolean, tasks: { task: string, description: string }[] };
        } catch (error) {
            console.error("Error extracting tasks from images:", error);
            throw error;
        }
    },

    // Generate Task Description
    generateTaskDetails: async (taskTitle: string, currentDescription?: string) => {
        try {
            const generateTaskDetailsFn = httpsCallable(functions, 'generateTaskDetails');
            const result = await generateTaskDetailsFn({ taskTitle, currentDescription });
            return result.data as { success: boolean, description: string };
        } catch (error) {
            console.error("Error generating task description:", error);
            throw error;
        }
    },

    // Generate Subtasks
    generateSubtasks: async (taskTitle: string, description?: string) => {
        try {
            const generateSubtasksFn = httpsCallable(functions, 'generateSubtasks');
            const result = await generateSubtasksFn({ taskTitle, description });
            return result.data as { success: boolean, subtasks: string[] };
        } catch (error) {
            console.error("Error generating subtasks:", error);
            throw error;
        }
    },

    // Create Google Meet link via Cloud Function
    createGoogleMeet: async (data: { summary: string, description?: string, start?: string, end?: string }) => {
        try {
            const createGoogleMeetFn = httpsCallable(functions, 'createGoogleMeet');
            const result = await createGoogleMeetFn(data);
            return result.data as { meetLink: string };
        } catch (error) {
            console.error("Error creating Google Meet:", error);
            throw error;
        }
    },

    // Sync Meeting Data (Transcript from Google Meet)
    syncMeetingData: async (projectId: string, meetingId: string, meetLink: string) => {
        try {
            const syncMeetingDataFn = httpsCallable(functions, 'syncMeetingData');
            const result = await syncMeetingDataFn({ projectId, meetingId, meetLink });
            return result.data as { success: boolean, message: string };
        } catch (error) {
            console.error("Error syncing meeting data:", error);
            throw error;
        }
    },

    // Add AI history item to subcollection
    addAIHistoryItem: async (projectId: string, milestoneId: string, historyItem: any) => {
        try {
            await addDoc(collection(db, COLLECTION_NAME, projectId, "aiHistory"), {
                ...historyItem,
                milestoneId,
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error adding AI history item:", error);
            throw error;
        }
    },

    // Remove AI history item from subcollection
    removeAIHistoryItem: async (projectId: string, historyItemId: string, fileUrl?: string) => {
        try {
            const historyRef = doc(db, COLLECTION_NAME, projectId, "aiHistory", historyItemId);
            await deleteDoc(historyRef);

            if (fileUrl) {
                await projectService.deleteProjectFile(fileUrl).catch(() => {});
            }
        } catch (error) {
            console.error("Error removing AI history item:", error);
            throw error;
        }
    },

    // Lazy load AI History
    getAIHistory: async (projectId: string, milestoneId?: string) => {
        try {
            let q = query(
                collection(db, COLLECTION_NAME, projectId, "aiHistory"), 
                orderBy("createdAt", "desc")
            );
            
            if (milestoneId) {
                q = query(q, where("milestoneId", "==", milestoneId));
            }
            
            const snapshot = await getDocs(q);
            return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.warn("Failed to fetch AI history:", error);
            return [];
        }
    },

    // Resources Subcollection Methods
    addResource: async (projectId: string, resource: any) => {
        try {
            const cleaned = cleanData(resource);
            await addDoc(collection(db, COLLECTION_NAME, projectId, "resources"), {
                ...cleaned,
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error adding resource:", error);
            throw error;
        }
    },

    removeResource: async (projectId: string, resourceId: string, fileUrl?: string) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, projectId, "resources", resourceId);
            await deleteDoc(docRef);
            if (fileUrl) await projectService.deleteProjectFile(fileUrl).catch(() => {});
        } catch (error) {
            console.error("Error removing resource:", error);
            throw error;
        }
    },

    getResources: async (projectId: string) => {
        try {
            const q = query(collection(db, COLLECTION_NAME, projectId, "resources"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.warn("Failed to fetch resources:", error);
            return [];
        }
    },

    // Received Emails Subcollection Methods
    addReceivedEmail: async (projectId: string, email: any) => {
        try {
            await addDoc(collection(db, COLLECTION_NAME, projectId, "receivedEmails"), {
                ...email,
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error adding received email:", error);
            throw error;
        }
    },

    getReceivedEmails: async (projectId: string) => {
        try {
            const q = query(collection(db, COLLECTION_NAME, projectId, "receivedEmails"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.warn("Failed to fetch received emails:", error);
            return [];
        }
    },
    
    updateReceivedEmail: async (projectId: string, emailId: string, data: any) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, projectId, "receivedEmails", emailId);
            await updateDoc(docRef, data);
        } catch (error) {
            console.error("Error updating received email:", error);
            throw error;
        }
    },

    // Meetings Subcollection Methods
    addMeeting: async (projectId: string, meeting: any) => {
        try {
            const cleaned = cleanData(meeting);
            const docRef = await addDoc(collection(db, COLLECTION_NAME, projectId, "meetings"), {
                ...cleaned,
                savedAt: serverTimestamp()
            });
            return docRef.id;
        } catch (error) {
            console.error("Error adding meeting:", error);
            throw error;
        }
    },

    updateMeeting: async (projectId: string, meetingId: string, meeting: any) => {
        try {
            const cleaned = cleanData(meeting);
            const docRef = doc(db, COLLECTION_NAME, projectId, "meetings", meetingId);
            await updateDoc(docRef, cleaned);
        } catch (error) {
            console.error("Error updating meeting:", error);
            throw error;
        }
    },

    removeMeeting: async (projectId: string, meetingId: string) => {
        try {
            const docRef = doc(db, COLLECTION_NAME, projectId, "meetings", meetingId);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Error removing meeting:", error);
            throw error;
        }
    },

    getMeetings: async (projectId: string) => {
        try {
            const q = query(collection(db, COLLECTION_NAME, projectId, "meetings"), orderBy("date", "desc"));
            const snapshot = await getDocs(q);
            return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.warn("Failed to fetch meetings:", error);
            return [];
        }
    }
};

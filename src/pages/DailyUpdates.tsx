import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Send, Loader2, Paperclip, FileText, ImageIcon, File, Mail, Eye, Inbox, ListChecks, MessageSquareText, HelpCircle, Upload, X, Lock, Reply } from "lucide-react"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState, useEffect, useRef, useMemo } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Sparkles, Bot, History, Calendar, FileSearch2, Trash2, CheckCheck } from "lucide-react"
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "src/components/ui/empty"
import { format, isValid } from "date-fns"
import { generateAIContent } from "@/lib/gemini"
import { useProjects } from "src/hooks/useProjects"
import { projectService } from "src/firebase/projectService"
import { type Project } from "src/store/slices/projectsSlice"
import { useClients } from "src/hooks/useClients"
import { generateEmailTemplate, cleanReplyContent, generateReplyTemplate } from "@/utils/emailTemplate"
import { functions, storage } from "src/firebase/config"
import { httpsCallable } from "firebase/functions"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { useAuth } from "src/contexts/AuthContext"
import { useEmployees } from "src/hooks/useEmployees"
import { whatsappService } from "src/firebase/whatsappService"

import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';

export default function DailyUpdatesPage() {
    const { user, isAdmin } = useAuth()
    const { employees } = useEmployees()
    const { projects: allProjects, loading } = useProjects()
    const { clients } = useClients()

    const currentEmployee = employees.find(e => e.authUid === user?.uid || e.email === user?.email)
    const myName = currentEmployee?.name

    // Filter projects for employees: show only projects where they are in the team or assigned to tasks
    const projects = useMemo(() => {
        if (isAdmin) return allProjects

        return allProjects.filter(p => {
            // 0. Check Assigned Team
            if (currentEmployee?.team?.trim()) {
                const team = currentEmployee.team.trim();
                if (p.assignedTeams?.includes(team)) return true;
                if (p.assignedTeam?.trim() && p.assignedTeam.trim() === team) return true;
            }

            if (!myName) return false

            // 1. Check if in Dev Team
            const inDevTeam = p.devTeam?.some((dev: any) => (typeof dev === 'string' ? dev : dev.name) === myName)
            if (inDevTeam) return true

            // 2. Check if has assigned tasks
            if (p.milestones && Array.isArray(p.milestones)) {
                return p.milestones.some((task: any) => {
                    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : [])
                    return assignees.some((a: any) => (typeof a === 'string' ? a : a.name) === myName)
                })
            }
            return false;
        })
    }, [allProjects, isAdmin, employees, user])
    const [selectedProject, setSelectedProject] = useState<Project | null>(null)
    const [historyProject, setHistoryProject] = useState<Project | null>(null)
    const [isSheetOpen, setIsSheetOpen] = useState(false)
    const [selectedTasks, setSelectedTasks] = useState<string[]>([])
    const [generatedSummary, setGeneratedSummary] = useState("")
    const [isGenerating, setIsGenerating] = useState(false)
    const [emailSubject, setEmailSubject] = useState("")
    const [viewingEmailIndex, setViewingEmailIndex] = useState<number | null>(null)
    const [step, setStep] = useState<'generate' | 'review'>('generate')
    const [mailType, setMailType] = useState<'task' | 'custom' | 'query'>('task')
    
    // Clear summary when switching mail types to avoid HTML/Plaintext mixups
    useEffect(() => {
        setGeneratedSummary("")
        setStep('generate')
    }, [mailType])
    const [aiTone, setAiTone] = useState<'crisp' | 'detailed'>('detailed')
    const [sending, setSending] = useState(false)
    const [recipientEmail, setRecipientEmail] = useState("")
    const [selectedAttachments, setSelectedAttachments] = useState<{ name: string; url: string; type: string }[]>([])
    const [ccEmail, setCcEmail] = useState("")
    const [bccEmail, setBccEmail] = useState("")
    const [savedCcEmails, setSavedCcEmails] = useState<string[]>([])
    const [savedBccEmails, setSavedBccEmails] = useState<string[]>([])
    const [ccDropdownOpen, setCcDropdownOpen] = useState(false)
    const [bccDropdownOpen, setBccDropdownOpen] = useState(false)

    const [isDeleting, setIsDeleting] = useState(false)
    const [selectedEmailIndices, setSelectedEmailIndices] = useState<number[]>([])
    const [activeTab, setActiveTab] = useState(() => localStorage.getItem('daily_activeTab') || "all")
    const [categoryTab, setCategoryTab] = useState(() => localStorage.getItem('daily_categoryTab') || "Development")
    const [isUploading, setIsUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Lazy Loading Sentinel States
    const [lazySentEmails, setLazySentEmails] = useState<any[]>([])
    const [lazyReceivedEmails, setLazyReceivedEmails] = useState<any[]>([])
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)

    // WhatsApp checkbox state
    const [sendWhatsApp, setSendWhatsApp] = useState(false)

    // Load saved CC/BCC emails from localStorage
    useEffect(() => {
        const savedCc = localStorage.getItem('savedCcEmails')
        const savedBcc = localStorage.getItem('savedBccEmails')
        if (savedCc) setSavedCcEmails(JSON.parse(savedCc))
        if (savedBcc) setSavedBccEmails(JSON.parse(savedBcc))
    }, [])

    // Persist Tabs
    useEffect(() => {
        localStorage.setItem('daily_activeTab', activeTab);
        setSelectedEmailIndices([]);
    }, [activeTab]);

    useEffect(() => {
        localStorage.setItem('daily_categoryTab', categoryTab);
    }, [categoryTab]);

    // Helper to save CC email to localStorage
    const saveCcEmail = (email: string) => {
        if (email && !savedCcEmails.includes(email)) {
            const updated = [...savedCcEmails, email]
            setSavedCcEmails(updated)
            localStorage.setItem('savedCcEmails', JSON.stringify(updated))
        }
    }

    // Helper to save BCC email to localStorage
    const saveBccEmail = (email: string) => {
        if (email && !savedBccEmails.includes(email)) {
            const updated = [...savedBccEmails, email]
            setSavedBccEmails(updated)
            localStorage.setItem('savedBccEmails', JSON.stringify(updated))
        }
    }

    // Auto-select latest email when history opens
    useEffect(() => {
        const fetchHistory = async () => {
            if (historyProject?.id) {
                setIsLoadingHistory(true);
                try {
                    const [sentCols, receivedCols] = await Promise.all([
                        projectService.getSentEmails(historyProject.id),
                        projectService.getReceivedEmails(historyProject.id)
                    ]);
                    
                    setLazySentEmails(sentCols);
                    setLazyReceivedEmails(receivedCols);
                    
                    const hasLegacySent = (historyProject as any).sentEmails?.length > 0;
                    const hasLegacyReceived = (historyProject as any).receivedEmails?.length > 0;

                    if (sentCols.length || receivedCols.length || hasLegacySent || hasLegacyReceived) {
                        setViewingEmailIndex(0)
                    } else {
                        setViewingEmailIndex(null)
                    }
                } catch (error) {
                    console.error("Failed to load email history:", error);
                } finally {
                    setIsLoadingHistory(false);
                }
            }
        };
        fetchHistory();
    }, [historyProject?.id])

    useEffect(() => {
        setViewingEmailIndex(0);
    }, [activeTab]);

    // Sync historyProject with real-time projects data (excluding heavy arrays)
    useEffect(() => {
        if (historyProject?.id) {
            const freshProject = projects.find(p => p.id === historyProject.id)
            if (freshProject) {
                // Since sentEmails are now in subcollections, we don't compare them here
                if (historyProject.status !== freshProject.status || historyProject.name !== freshProject.name) {
                    setHistoryProject(freshProject)
                }
            }
        }
    }, [projects])

    // Auto-check emails when mail history opens and poll every 60 seconds
    useEffect(() => {
        if (!historyProject) return;

        // Initial deep scan (10-day lookback) to catch up any missed replies
        const initialCheck = async () => {
            try {
                const check = httpsCallable(functions, 'checkIncomingEmails');
                await check({ lookbackDays: 10 });
            } catch (error) {
                console.error("Initial email check failed:", error);
            }
        };

        // Lighter ongoing poll (3-day lookback)
        const pollCheck = async () => {
            try {
                const check = httpsCallable(functions, 'checkIncomingEmails');
                await check({ lookbackDays: 3 });
            } catch (error) {
                console.error("Poll email check failed:", error);
            }
        };

        initialCheck();

        // Poll every 60 seconds while sheet is open
        const interval = setInterval(pollCheck, 60000);

        return () => clearInterval(interval);
    }, [historyProject?.id])


    const quillModules = {
        toolbar: [
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            ['clean']
        ],
    };

    const quillFormats = [
        'bold', 'italic', 'underline', 'strike',
        'list', 'bullet'
    ];

    // Helper to get project tasks based on status
    const getProjectTasks = (project: Project, status: string = 'Completed') => {
        const milestones = (project.milestones || [])
            .filter((m: any) => {
                const mStatus = (m.status || '').trim().toLowerCase();
                const targetStatus = status.trim().toLowerCase();
                
                if (targetStatus === 'pending') {
                    return mStatus === 'pending' || !mStatus;
                }
                if (targetStatus === 'completed') {
                    return mStatus === 'completed';
                }
                return mStatus === targetStatus;
            })
            .flatMap((m: any) => {
                const subtasks = m.subtasks || [];
                const taskLabel = m.task || m.title || m.name || 'Unnamed Task';
                if (subtasks.length > 0) {
                    // Create an entry for the parent task and each subtask
                    return [
                        taskLabel,
                        ...subtasks.map((st: any) => `  - ${st.title} (${st.completed ? 'Done' : 'Pending'})`)
                    ];
                }
                return [taskLabel];
            });
        return milestones;
    }


    // Helper to get attachments grouped by task (only for completed tasks eligible to be sent)
    const getAttachmentsGroupedByTask = (project: Project) => {
        const milestones = project.milestones || []
        const groupedAttachments: { taskName: string; taskId: string; attachments: { name: string; url: string; type: string }[] }[] = []

        milestones.forEach((m: any) => {
            // Only include tasks that are 'Completed' (eligible to be sent, not 'Delivered')
            if (m.status === 'Completed' && m.attachments && m.attachments.length > 0) {
                groupedAttachments.push({
                    taskName: m.task || 'Unknown Task',
                    taskId: m.id || m.task,
                    attachments: m.attachments.map((att: any) => ({
                        name: att.name,
                        url: att.url,
                        type: att.type
                    }))
                })
            }
        })

        return groupedAttachments
    }



    const getAllEmails = () => {
        if (!historyProject) return [];
        
        // Merge legacy sent emails from root document with new subcollection emails
        const legacySent = (historyProject.sentEmails || []).map((e: any) => ({ ...e, msgType: 'sent' }));
        const currentSent = (lazySentEmails || []).map((e: any) => ({ ...e, msgType: 'sent' }));
        
        const allSent = [...currentSent];
        legacySent.forEach(ls => {
            const isDuplicate = allSent.some(cs => cs.date === ls.date && cs.subject === ls.subject);
            if (!isDuplicate) allSent.push(ls);
        });

        // Merge legacy received emails with subcollection received emails
        const legacyReceived = (historyProject.receivedEmails || []).map((e: any) => ({ ...e, msgType: 'received' }));
        const currentReceived = (lazyReceivedEmails || []).map((e: any) => ({ ...e, msgType: 'received' }));
        
        const allReceived = [...currentReceived];
        legacyReceived.forEach(lr => {
            const isDuplicate = allReceived.some(cr => cr.date === lr.date && cr.subject === lr.subject);
            if (!isDuplicate) allReceived.push(lr);
        });

        return [...allSent, ...allReceived].sort((a, b) => {
            const getTimestamp = (e: any) => {
                // Prefer Firestore server timestamps first
                if (e.createdAt?.seconds) return e.createdAt.seconds * 1000;
                if (e.savedAt?.seconds) return e.savedAt.seconds * 1000;
                if (e.createdAt && typeof e.createdAt === 'string') {
                    const t = new Date(e.createdAt).getTime();
                    if (!isNaN(t)) return t;
                }
                if (e.receivedAt) {
                    const t = new Date(e.receivedAt).getTime();
                    if (!isNaN(t)) return t;
                }
                if (e.date) {
                    const t = new Date(e.date).getTime();
                    if (!isNaN(t)) return t;
                }
                return 0;
            };

            return getTimestamp(b) - getTimestamp(a);
        });
    }
    const allEmails = getAllEmails();
    const filteredEmails = allEmails.filter(e => {
        if (activeTab === 'all') return true;
        if (activeTab === 'sent') return e.msgType === 'sent';
        if (activeTab === 'replies') return e.msgType === 'received';
        return true;
    });

    const handleDeleteEmail = async () => {
        if (viewingEmailIndex === null || !historyProject || !historyProject.id) return;

        const emailToDelete = filteredEmails[viewingEmailIndex];
        if (!emailToDelete) return;

        setIsDeleting(true);

        try {
            if (emailToDelete.msgType === 'sent') {
                if (emailToDelete.id) {
                    // Subcollection item
                    await projectService.removeSentEmail(historyProject.id, emailToDelete.id);
                    setLazySentEmails(prev => prev.filter(e => e.id !== emailToDelete.id));
                } else {
                    // Legacy root item
                    const updatedSent = (historyProject.sentEmails || []).filter((e: any) => 
                        e.date !== emailToDelete.date || e.subject !== emailToDelete.subject
                    );
                    await projectService.updateProject(historyProject.id, { sentEmails: updatedSent });
                }
            } else {
                // Received emails might still be in root or we migrate them too later
                const updatedReceived = (historyProject.receivedEmails || []).filter((e: any) => 
                    e.date !== emailToDelete.date || e.subject !== emailToDelete.subject
                );
                await projectService.updateProject(historyProject.id!, { receivedEmails: updatedReceived });
            }

            toast.success("Email deleted successfully");
            setViewingEmailIndex(null);
        } catch (error) {
            console.error("Failed to delete email:", error);
            toast.error("Failed to delete email");
        } finally {
            setIsDeleting(false);
        }
    }

    const handleDeleteSelectedEmails = async () => {
        if (selectedEmailIndices.length === 0 || !historyProject || !historyProject.id) return;

        const emailsToDelete = selectedEmailIndices.map(i => filteredEmails[i]).filter(Boolean);
        if (emailsToDelete.length === 0) return;

        setIsDeleting(true);

        try {
            const isMatch = (e: any, target: any) =>
                new Date(e.date).getTime() === new Date(target.date).getTime() &&
                e.subject === target.subject &&
                (e.content?.substring(0, 50) === target.content?.substring(0, 50));

            const updatedProject = { ...historyProject };

            updatedProject.sentEmails = (historyProject.sentEmails || []).filter((e: any) =>
                !emailsToDelete.some(target => target.msgType === 'sent' && isMatch(e, target))
            );

            updatedProject.receivedEmails = (historyProject.receivedEmails || []).filter((e: any) =>
                !emailsToDelete.some(target => target.msgType === 'received' && isMatch(e, target))
            );

            await projectService.updateProject(historyProject.id!, {
                sentEmails: updatedProject.sentEmails,
                receivedEmails: updatedProject.receivedEmails
            });

            toast.success(`${emailsToDelete.length} emails deleted successfully`);
            setHistoryProject(updatedProject);
            setSelectedEmailIndices([]);
            setViewingEmailIndex(null);
        } catch (error) {
            console.error("Failed to delete emails:", error);
            toast.error("Failed to delete emails");
        } finally {
            setIsDeleting(false);
        }
    }

    const handleOpenSheet = (project: Project) => {
        setSelectedProject(project)
        // Fetch all relevant buckets
        const completedTasks = getProjectTasks(project, 'Completed')
        const inProgressTasks = getProjectTasks(project, 'In Progress')
        const pendingTasks = getProjectTasks(project, 'Pending')
        const postedTasks = getProjectTasks(project, 'Posted')
        const deliveredTasks = getProjectTasks(project, 'Delivered')

        // Default select completed and in-progress tasks. For DM, also select Posted.
        const defaultSelected = project.category === 'Digital Marketing' 
            ? [...completedTasks, ...inProgressTasks, ...postedTasks, ...deliveredTasks] 
            : [...completedTasks, ...inProgressTasks, ...pendingTasks, ...postedTasks, ...deliveredTasks];
        setSelectedTasks(defaultSelected)
        setGeneratedSummary("")
        setEmailSubject("")

        // Find client email
        const client = clients.find(c => c.company === project.client || c.name === project.client)
        setRecipientEmail(client && client.email ? client.email : "")

        // Reset attachments, CC/BCC, and new options
        setSelectedAttachments([])
        setCcEmail("")
        setBccEmail("")
        setMailType('task')
        setAiTone('detailed')

        setStep('generate')
        setIsSheetOpen(true)
    }

    const toggleAttachmentSelection = (attachment: { name: string; url: string; type: string }) => {
        setSelectedAttachments(prev =>
            prev.some(a => a.url === attachment.url)
                ? prev.filter(a => a.url !== attachment.url)
                : [...prev, attachment]
        )
    }

    const getFileIcon = (type: string) => {
        if (type.startsWith('image/')) return <ImageIcon className="h-4 w-4 text-blue-500" />
        if (type.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />
        return <File className="h-4 w-4 text-gray-500" />
    }

    const handleFileUpload = async (files: FileList | null) => {
        if (!files || files.length === 0 || !selectedProject) return
        setIsUploading(true)
        try {
            const uploadedAttachments: { name: string; url: string; type: string }[] = []
            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                const fileRef = ref(storage, `email-attachments/${selectedProject.id}/${Date.now()}_${file.name}`)
                const snapshot = await uploadBytes(fileRef, file)
                const downloadURL = await getDownloadURL(snapshot.ref)
                uploadedAttachments.push({
                    name: file.name,
                    url: downloadURL,
                    type: file.type || 'application/octet-stream'
                })
            }
            setSelectedAttachments(prev => [...prev, ...uploadedAttachments])
            toast.success(`${uploadedAttachments.length} file${uploadedAttachments.length > 1 ? 's' : ''} uploaded`)
        } catch (error) {
            console.error('File upload error:', error)
            toast.error('Failed to upload file(s)')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const removeAttachment = (url: string) => {
        setSelectedAttachments(prev => prev.filter(a => a.url !== url))
    }

    const toggleTaskSelection = (task: string) => {
        setSelectedTasks(prev =>
            prev.includes(task)
                ? prev.filter(t => t !== task)
                : [...prev, task]
        )
    }

    const handleGenerateSummary = async () => {
        if (!selectedProject) return;
        setIsGenerating(true)
        try {
            const client = clients.find(c => c.company === selectedProject.client || c.name === selectedProject.client)
            const clientName = client ? client.name : "Client"

            // Tone instructions
            const toneGuide = aiTone === 'crisp'
                ? `- Use a POINTWISE (bulleted) format for the tasks.
                   - For each task, provide exactly 2 concise sentences/lines of description.
                   - Keep it very executive and brief. No unnecessary details.`
                : `- Use a POINTWISE (bulleted) format for the tasks.
                   - Make the email comprehensive, professional, and highly detailed.
                   - For each task, provide a substantive bullet point (2-3 sentences) explaining precisely what was achieved and its significance to the project's overall goal.
                   - If subtasks are provided, weave them into the description to demonstrate thoroughness.
                   - Use project-specific context to make the update feel personalized, not generic.
                   - Provide a clear sense of momentum and progress.`;

            let prompt = '';

            if (mailType === 'task') {
                const isDM = selectedProject.category === 'Digital Marketing';
                if (isDM) {
                    const allSelectedTasks = (selectedProject.milestones || []).filter(m => selectedTasks.includes(m.task));

                    // Strictly filter for Marketing Calendar items WITH a live link
                    const marketingItemsWithLinks = allSelectedTasks.filter((m: any) => (m.platform || m.week) && m.postLink);

                    if (marketingItemsWithLinks.length === 0) {
                        setGeneratedSummary("No posted tasks with links found for the selected items.");
                        setIsGenerating(false);
                        return;
                    }

                    const tasksByPlatform = marketingItemsWithLinks.reduce((acc: any, m: any) => {
                        const type = m.contentType || 'Social Media Post';
                        if (!acc[type]) acc[type] = [];
                        acc[type].push(m);
                        return acc;
                    }, {});

                    let dmTasksData = 'MARKETING CALENDAR (POSTED CONTENT):\n';
                    dmTasksData += Object.entries(tasksByPlatform).map(([type, tasks]: [string, any]) => {
                        return `${type}:\n` + tasks.map((m: any) => {
                            return `- ${m.task} (LIVE LINK: ${m.postLink})`;
                        }).join('\n');
                    }).join('\n\n');

                    prompt = `
                        Write a professional daily update email for the Digital Marketing project "${selectedProject.name}".
                        
                        Recipient: ${clientName}
                        
                        CONTENT TO INCLUDE:
                        ${dmTasksData}
                        
                        STRICT FORMATTING RULES:
                        1. Start with "Hi ${clientName},"
                        2. opening: "Hope you're having a productive day! Here's your latest progress update."
                        3. CRITICAL: For every item that has a "LIVE LINK", you MUST include the full URL in the bullet point.
                        4. DO NOT summarize multiple tasks. List each task name and its link clearly.
                        5. Wrap up with: "We are committed to keeping you updated on the progress... We are working diligently to deliver results..."
                        6. ABSOLUTELY NO MARKDOWN (** or *). PLAIN TEXT ONLY.
                        ${toneGuide}
                    `;
                } else {
                    const getDetailedTasksList = (status: string) => {
                        // Get the exact list of tasks that belong to this UI section
                        const tasksForThisStatus = getProjectTasks(selectedProject, status);
                        
                        // Filter selectedTasks directly to find those that appear in this status category
                        const selectedForThisStatus = selectedTasks.filter(sel => tasksForThisStatus.includes(sel));

                        if (selectedForThisStatus.length === 0) return "";

                        // Return the selected strings with bullets, preserving their hierarchy (subtasks have 2 leading spaces)
                        return selectedForThisStatus.map(t => {
                            if (t.startsWith('  -')) return t; // Already has subtask formatting
                            return `- ${t}`;
                        }).join('\n');
                    };

                    const completedList = getDetailedTasksList('Completed');
                    const inProgressList = getDetailedTasksList('In Progress');
                    const pendingList = getDetailedTasksList('Pending');

                    prompt = `
                        Write a professional daily update email body for a client regarding the project "${selectedProject.name}".
                        
                        Recipient: ${clientName}
                        
                        TASK UPDATES:
                        
                        ${completedList ? `Status: COMPLETED\n${completedList}\n` : ''}
                        ${inProgressList ? `Status: WORKING / IN PROGRESS\n${inProgressList}\n` : ''}
                        ${pendingList ? `Status: PENDING\n${pendingList}\n` : ''}
                        
                        CRITICAL INSTRUCTIONS:
                        1. You MUST include EVERY SINGLE task name and subtask name listed above in your response. 
                        2. Do NOT summarize or group multiple tasks together into one sentence. 
                        3. Each item (task or subtask) MUST have its own individual bullet point or line of description.
                        4. Do NOT skip any tasks, even if the task description goes on for multiple lines or paragraphs. Accuracy and 100% coverage of every single list item provided above is mandatory.

                        Formatting Guidelines:
                        - Start with "Hi ${clientName}," followed by a warm opening line.
                        - Organize the tasks by their status (Completed, In Progress, Pending) using clear section headers.
                        - List the tasks in a POINTWISE format using dashes (-).
                        - For each task, use the format "Task Name: Brief description of progress" (e.g., - Dashboard Redesign: Completed the initial landing page layout).
                        ${toneGuide}
                        - End with a line inviting them to reach out for feedback.
                        - Use a friendly but professional tone.
                        - Do NOT include any sign-off, closing, or signature.
                        - CRITICAL RULE: DO NOT USE ANY MARKDOWN. NO BOLDING (**), NO ITALICS (*), NO HASHTAGS (#).
                        - Output strictly 100% PLAIN TEXT.
                    `;
                }
            } else if (mailType === 'custom') {
                const userBody = generatedSummary.trim()
                prompt = `
                    Rewrite the following draft into a polished, professional email body for a client regarding the project "${selectedProject.name}".
                    
                    Recipient: ${clientName}
                    
                    Draft Content:
                    ${userBody || '(No draft provided — write a general project check-in email)'}
                    
                    Guidelines:
                    - Start with "Hi ${clientName},"
                    - Preserve the original intent and key information from the draft.
                    ${toneGuide}
                    - Use a friendly but professional tone throughout.
                    - Do NOT include any sign-off, closing, or signature — the email template already has a signature.
                    - CRITICAL RULE: DO NOT USE ANY MARKDOWN. NO BOLDING (**), NO ITALICS (*). Output strictly 100% PLAIN TEXT.
                `
            } else {
                // query mail
                const userBody = generatedSummary.trim()
                prompt = `
                    Write a professional follow-up / query email to a client regarding the project "${selectedProject.name}".
                    
                    Recipient: ${clientName}
                    
                    Context / Questions to ask:
                    ${userBody || '(No specific questions provided — write a general check-in asking for feedback and next steps)'}
                    
                    Guidelines:
                    - Start with "Hi ${clientName},"
                    - Frame the questions or follow-ups politely and professionally.
                    - Make it clear what you need from the client (feedback, approval, clarification, etc.).
                    ${toneGuide}
                    - Use a friendly but professional tone throughout.
                    - Do NOT include any sign-off, closing, or signature — the email template already has a signature.
                    - CRITICAL RULE: DO NOT USE ANY MARKDOWN. NO BOLDING (**), NO ITALICS (*). Output strictly 100% PLAIN TEXT.
                `
            }

            const systemInstruction = `You are a Senior Project Manager at UXDLab, a premium software and design agency. 
            Your goal is to communicate progress to clients in a way that builds trust, shows deep technical competence, and demonstrates value. 
            Be professional, proactive, and precise. Never be vague.`;

            let summary = await generateAIContent(prompt, "gemini-3.1-flash-lite-preview", systemInstruction);
            
            if (summary) {
                // Remove all markdown stars (bold/italic) as a safety measure
                summary = summary.replace(/\*\*/g, '').replace(/\*/g, '');
            }

            setGeneratedSummary(summary || "Failed to generate summary.")

            // Set appropriate subject based on mail type
            const dateStr = new Date().toLocaleDateString()
            if (mailType === 'task') {
                setEmailSubject(`Daily Update: ${selectedProject.name} - ${dateStr}`)
            } else if (mailType === 'custom') {
                setEmailSubject(`Update: ${selectedProject.name} - ${dateStr}`)
            } else {
                setEmailSubject(`Follow Up: ${selectedProject.name} - ${dateStr}`)
            }

            setStep('review')
        } catch (error) {
            console.error("Error generating summary:", error)
            setGeneratedSummary("Failed to generate summary due to an error.")
        } finally {
            setIsGenerating(false)
        }
    }

    const handleSkipAI = () => {
        if (!selectedProject || !generatedSummary.trim()) {
            toast.error("Please enter your message first.")
            return;
        }

        const dateStr = new Date().toLocaleDateString()
        if (mailType === 'custom') {
            setEmailSubject(`Update: ${selectedProject.name} - ${dateStr}`)
        } else {
            setEmailSubject(`Follow Up: ${selectedProject.name} - ${dateStr}`)
        }

        setStep('review')
    }

    const handleSendMail = async () => {
        if (!selectedProject || !generatedSummary || !selectedProject.id) return

        if (!recipientEmail) {
            toast.error("No client email found for this project. Please add an email to the client details.")
            return;
        }

        // Get client name for personalization
        const client = clients.find(c => c.company === selectedProject.client || c.name === selectedProject.client)
        const clientName = client?.name?.split(' ')[0] || '' // Get first name only

        setSending(true)
        try {
            const dateStr = new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })

            // Generate base HTML email template
            const baseHtmlEmail = generateEmailTemplate({
                projectName: selectedProject.name,
                clientName: clientName,
                summary: generatedSummary,
                date: dateStr,
                credentials: selectedProject.credentials?.all || []
            })

            // Save CC/BCC emails to localStorage for future use
            if (ccEmail) saveCcEmail(ccEmail)
            if (bccEmail) saveBccEmail(bccEmail)

            // 1. Send to CLIENT - with BCC info (but NO CC info)
            let clientHtmlEmail = baseHtmlEmail
            if (bccEmail) {
                const clientBccNote = `<div style="background: #f0f4f8; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #555;">
                    <strong>📋 Note:</strong> This email was also sent to: <strong>${bccEmail}</strong>
                </div>`
                clientHtmlEmail = baseHtmlEmail.replace(/(<body[^>]*>)/, `$1${clientBccNote}`)
            }

            // Create plain text version with credentials
            const creds = selectedProject.credentials?.all || []
            const credsPlainText = creds.length > 0
                ? `\n\n--- PROJECT ACCESS CREDENTIALS ---\n${creds.map((c: any) => `${c.name || 'Login'}:\nURL: ${c.url || 'N/A'}\nEmail: ${c.email || 'N/A'}\nPassword: ${c.password || 'N/A'}`).join('\n\n')}\n`
                : ''
            const fullPlainText = generatedSummary + credsPlainText

            // Initialize lightweight tracking metadata FIRST to prevent race condition
            const emailMsgId = Date.now().toString(36) + Math.random().toString(36).substring(2);
            
            const newEmail = {
                id: emailMsgId, // Used as mock ID temporarily
                date: new Date().toISOString().split('T')[0],
                subject: emailSubject,
                content: generatedSummary,
                htmlContent: clientHtmlEmail,
                sender: currentEmployee?.name || user?.email || "UXDLab Representative",
                attachments: selectedAttachments,
                attachmentCount: selectedAttachments.length,
                msgId: emailMsgId
            };
            
            // Prepared lightweight new email (no heavy HTML in root state)
            const { htmlContent, ...lightweightEmail } = newEmail;
            
            // UI Update local state for immediate feedback
            setLazySentEmails((prev: any) => [lightweightEmail, ...(Array.isArray(prev) ? prev : [])]);

            const sendOptions: any = {
                to: recipientEmail,
                subject: emailSubject,
                text: bccEmail ? `[Note: Also sent to ${bccEmail}]\n\n${fullPlainText}` : fullPlainText,
                html: clientHtmlEmail,
                attachments: selectedAttachments.length > 0 ? selectedAttachments : undefined,
                projectId: selectedProject.id, // Trigger tracking pixel for the primary client email
                msgId: emailMsgId
            }

            if (currentEmployee?.department?.toLowerCase() === 'bde' && currentEmployee?.appPassword) {
                sendOptions.senderEmail = currentEmployee.bdEmail || currentEmployee.email
                sendOptions.senderAppPassword = currentEmployee.appPassword
                sendOptions.senderDisplayName = currentEmployee.name || user?.displayName || user?.email || "UXDLab"
            }

            // 1. Save full record to separate subcollection
            await projectService.saveEmailRecord(selectedProject.id, newEmail);

            // 4. Update milestone status to 'Delivered' ONLY if sending a Task Mail
            const timestamp = new Date().toISOString()
            const deliveryDateStr = new Date().toLocaleDateString()
            const updatedMilestones = (selectedProject.milestones || []).map((m: any) => {
                if (mailType === 'task' && selectedTasks.includes(m.task) && m.status === 'Completed') {
                    return { ...m, status: 'Delivered', deliveredDate: deliveryDateStr, deliveredAt: timestamp }
                }
                return m
            })

            const calculateProjectStatus = (tasks: any[]) => {
                if (!tasks || tasks.length === 0) return selectedProject.status || 'Pending';
                const allDone = tasks.every(t => t.status === 'Completed' || t.status === 'Delivered');
                if (allDone) return 'Completed';
                const anyActive = tasks.some(t => t.status === 'In Progress' || t.status === 'Completed');
                if (anyActive) return 'In Progress';
                return 'Pending';
            }

            const newProjectStatus = calculateProjectStatus(updatedMilestones);

            const finalMilestones = updatedMilestones.map((m: any) => {
                if (selectedTasks.includes(m.task)) {
                    return { ...m, delivered: true, deliveredAt: new Date().toISOString() };
                }
                return m;
            });

            // IMPORTANT: Write to Database BEFORE triggering nodemailler emails
            await projectService.updateProject(selectedProject.id, {
                milestones: finalMilestones,
                status: newProjectStatus,
                lastEmailSent: {
                    date: new Date().toISOString(),
                    subject: emailSubject,
                    sender: currentEmployee?.name || user?.email || 'UXDLab'
                }
            });

            // NOW Send out the actual emails
            await projectService.sendEmail(sendOptions);

            // 2. Send to CC - plain email with NO extra info (just knows about client)
            if (ccEmail) {
                const ccOptions: any = {
                    to: ccEmail,
                    subject: emailSubject,
                    text: fullPlainText,
                    html: baseHtmlEmail,
                    attachments: selectedAttachments.length > 0 ? selectedAttachments : undefined
                }
                if (currentEmployee?.department?.toLowerCase() === 'bde' && currentEmployee?.appPassword) {
                    ccOptions.senderEmail = currentEmployee.bdEmail || currentEmployee.email
                    ccOptions.senderAppPassword = currentEmployee.appPassword
                    ccOptions.senderDisplayName = currentEmployee.name || user?.displayName || user?.email || "UXDLab"
                }
                await projectService.sendEmail(ccOptions);
            }

            // 3. Send to BCC - with FULL info (client + CC + BCC)
            if (bccEmail) {
                let bccInfoParts = [`<strong>${recipientEmail}</strong> (Client)`]
                if (ccEmail) bccInfoParts.push(`<strong>${ccEmail}</strong> (CC)`)
                bccInfoParts.push(`<strong>${bccEmail}</strong> (BCC - You)`)

                const bccInfoNote = `<div style="background: #e8f5e9; padding: 12px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #2e7d32;">
                    <strong>📧 Full Recipients List:</strong><br/>
                    ${bccInfoParts.join('<br/>')}
                </div>`

                const bccHtmlEmail = baseHtmlEmail.replace(/(<body[^>]*>)/, `$1${bccInfoNote}`)

                const bccOptions: any = {
                    to: bccEmail,
                    subject: `[BCC] ${emailSubject}`,
                    text: `[Recipients: Client: ${recipientEmail}${ccEmail ? `, CC: ${ccEmail}` : ''}, BCC: ${bccEmail}]\n\n${fullPlainText}`,
                    html: bccHtmlEmail,
                    attachments: selectedAttachments.length > 0 ? selectedAttachments : undefined
                }
                if (currentEmployee?.department?.toLowerCase() === 'bde' && currentEmployee?.appPassword) {
                    bccOptions.senderEmail = currentEmployee.bdEmail || currentEmployee.email
                    bccOptions.senderAppPassword = currentEmployee.appPassword
                    bccOptions.senderDisplayName = currentEmployee.name || user?.displayName || user?.email || "UXDLab"
                }

                await projectService.sendEmail(bccOptions);
            }

            // Also send WhatsApp if checkbox was ticked
            if (sendWhatsApp) {
                try {
                    const waClient = clients.find(c => c.company === selectedProject.client || c.name === selectedProject.client)
                    const waPhone = waClient?.phone || ''
                    if (waPhone) {
                        await whatsappService.sendProjectUpdate({
                            to: waPhone,
                            message: generatedSummary,
                            projectId: selectedProject.id,
                            projectName: selectedProject.name,
                            clientName: waClient?.name,
                            clientId: waClient?.id
                        })
                        toast.success('WhatsApp update also sent!')
                    } else {
                        toast.warning('WhatsApp skipped — no phone number found for client.')
                    }
                } catch (waError) {
                    console.error('WhatsApp send failed:', waError)
                    toast.error('Email sent, but WhatsApp failed.')
                }
            }

            toast.success(`Email sent successfully!${selectedAttachments.length > 0 ? ` (${selectedAttachments.length} attachment${selectedAttachments.length > 1 ? 's' : ''})` : ''}`)
            setIsSheetOpen(false)
        } catch (error) {
            console.error("Error sending/saving email:", error)
            toast.error("Failed to send email. Please check the logs.")
        } finally {
            setSending(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="flex-1 flex-col space-y-8 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Daily Updates</h2>
                    <p className="text-muted-foreground">Generate client-facing summaries from your project activity.</p>
                </div>
                <div className="flex items-center gap-4">
                    <Tabs value={categoryTab} onValueChange={setCategoryTab} className="w-[550px]">
                        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
                            <TabsTrigger value="Development" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Development</TabsTrigger>
                            <TabsTrigger value="Digital Marketing" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Digital Marketing</TabsTrigger>
                            <TabsTrigger value="Internal" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Internal</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            <div className="flex-1">
                {projects.length > 0 ? (
                    <Table>
                        <TableHeader className="bg-gray-50">
                            <TableRow>
                                <TableHead className="py-3">Project Name</TableHead>
                                <TableHead className="py-3 w-[30%]">Recent Updates</TableHead>
                                <TableHead className="py-3 text-center">Pending</TableHead>
                                <TableHead className="py-3 text-center">Delivered</TableHead>
                                <TableHead className="py-3">Assigned To</TableHead>
                                <TableHead className="py-3">Last Delivered</TableHead>
                                <TableHead className="py-3">Mail History</TableHead>
                                <TableHead className="py-3 text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {projects.filter(p => {
                                const isInternal = p.category === 'Internal' || !p.client || p.client === 'None' || p.client?.toLowerCase().includes('internal');

                                if (!categoryTab) return true;
                                if (categoryTab === 'Internal') return isInternal;

                                // For other tabs, ensure category matches and it's NOT an internal project
                                return p.category === categoryTab && !isInternal;
                            }).map((project) => {
                                const tasks = getProjectTasks(project).filter(t => !project.milestones?.find(m => m.task === t && m.status === 'Delivered'));

                                // Get unique assignees from all milestones
                                const allAssignees: any[] = [];
                                (project.milestones || []).forEach((m: any) => {
                                    if (m.assignedTo) {
                                        const assignees = Array.isArray(m.assignedTo) ? m.assignedTo : [m.assignedTo];
                                        assignees.forEach((a: any) => {
                                            if (a && a.name && a.name !== 'Unassigned' && !allAssignees.some(existing => existing.name === a.name)) {
                                                allAssignees.push(a);
                                            }
                                        });
                                    }
                                });

                                return (
                                    <TableRow key={project.id} className="hover:bg-muted/50">
                                        <TableCell className="font-medium py-4">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={project.logo} />
                                                    <AvatarFallback>{project.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                </Avatar>
                                                <div className="flex items-center gap-2">
                                                    {project.name}
                                                    {project.receivedEmails && project.receivedEmails.length > 0 && (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-blue-100 gap-1 text-[10px] h-5 px-1.5 animate-pulse">
                                                                        <Mail className="h-3 w-3" />
                                                                        Reply
                                                                    </Badge>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>{project.receivedEmails.length} client {project.receivedEmails.length === 1 ? 'reply' : 'replies'}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-4">
                                            {tasks.length > 0 ? (
                                                <div className="flex flex-col gap-1">
                                                    {tasks.slice(0, 2).map((task, idx) => (
                                                        <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                                            <span className="truncate max-w-[300px]">{task}</span>
                                                        </div>
                                                    ))}
                                                    {tasks.length > 2 && (
                                                        <span className="text-xs text-muted-foreground pl-3.5">+{tasks.length - 2} more</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm italic">No recent activity</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center py-4">
                                            {(() => {
                                                const count = (project.milestones || []).filter((m: any) => m.status !== 'Delivered').length;
                                                return count > 0 ? (
                                                    <span className="text-emerald-600 font-bold text-base">
                                                        {count}
                                                    </span>
                                                ) : <span className="text-slate-300">-</span>;
                                            })()}
                                        </TableCell>

                                        <TableCell className="text-center py-4">
                                            {(() => {
                                                const deliveredCount = (project.milestones || []).filter((m: any) => m.delivered).length;
                                                return deliveredCount > 0 ? (
                                                    <span className="text-blue-600 font-bold text-base">
                                                        {deliveredCount}
                                                    </span>
                                                ) : <span className="text-slate-200">-</span>;
                                            })()}
                                        </TableCell>

                                        <TableCell className="py-4">
                                            {allAssignees.length > 0 ? (
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex flex-wrap gap-1">
                                                        {allAssignees.map((a, idx) => {
                                                            const names = a.name.split(' ');
                                                            const initials = names.map((n: string) => n[0]).join('').toUpperCase();

                                                            return (
                                                                <TooltipProvider key={idx}>
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Badge
                                                                                variant="outline"
                                                                                className="rounded-full bg-slate-50 text-slate-600 border-slate-200 text-[10px] font-black w-6 h-6 flex items-center justify-center hover:bg-slate-100 hover:text-primary transition-all cursor-help shadow-sm p-0"
                                                                            >
                                                                                {initials}
                                                                            </Badge>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>
                                                                            <p>{a.name}</p>
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                </TooltipProvider>
                                                            );
                                                        })}
                                                    </div>
                                                    {allAssignees.length > 2 && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {allAssignees.length} people assigned
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm italic">Unassigned</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="py-4">
                                            {(() => {
                                                const parseRobustDate = (rawStr: string) => {
                                                    if (!rawStr) return null;
                                                    let d = (rawStr.includes('-') || rawStr.includes('T')) ? new Date(rawStr) : new Date(rawStr);
                                                    if (rawStr.includes('/')) {
                                                        const parts = rawStr.split('/');
                                                        if (parts.length === 3) {
                                                            const p0 = parseInt(parts[0], 10);
                                                            const p1 = parseInt(parts[1], 10);
                                                            const p2 = parseInt(parts[2], 10);
                                                            if (p1 > 12 && p0 <= 12) {
                                                                d = new Date(`${p2}-${p0.toString().padStart(2, '0')}-${p1.toString().padStart(2, '0')}T12:00:00Z`);
                                                            } else if (p0 > 12 && p1 <= 12) {
                                                                d = new Date(`${p2}-${p1.toString().padStart(2, '0')}-${p0.toString().padStart(2, '0')}T12:00:00Z`);
                                                            } else if (p0 <= 12 && p1 <= 12) {
                                                                // Ambiguous, typical for UK/IN is DD/MM/YYYY
                                                                d = new Date(p2, p1 - 1, p0, 12, 0, 0);
                                                            }
                                                            if (!isValid(d)) d = new Date(rawStr);
                                                        }
                                                    }
                                                    return isValid(d) ? d : null;
                                                };

                                                let lastTaskUnix = 0;
                                                let lastTaskDisplayDate = '';
                                                let lastTaskTitle = '';

                                                const deliveredTasks = (project.milestones || []).filter((m: any) => m.status === 'Delivered');
                                                if (deliveredTasks.length > 0) {
                                                    const sortedTasks = [...deliveredTasks].sort((a: any, b: any) => {
                                                        const timeA = a.deliveredAt ? new Date(a.deliveredAt).getTime() : (a.deliveredDate ? new Date(a.deliveredDate).getTime() : 0);
                                                        const timeB = b.deliveredAt ? new Date(b.deliveredAt).getTime() : (b.deliveredDate ? new Date(b.deliveredDate).getTime() : 0);
                                                        return timeB - timeA;
                                                    });
                                                    const lastDelivered = sortedTasks[0];
                                                    const dtStr = lastDelivered.deliveredAt || lastDelivered.deliveredDate || lastDelivered.date || '';
                                                    const parsed = parseRobustDate(dtStr);
                                                    if (parsed) {
                                                        lastTaskUnix = parsed.getTime();
                                                        lastTaskDisplayDate = format(parsed, 'EEE, MMM d');
                                                    } else {
                                                        lastTaskDisplayDate = dtStr;
                                                    }
                                                    lastTaskTitle = lastDelivered.task;
                                                }

                                                let lastMailUnix = 0;
                                                let lastMailDisplayDate = '';
                                                let lastMailTitle = '';

                                                // Check lastEmailSent metadata (subcollection-era) first, then fall back to legacy root sentEmails
                                                const lastEmailMeta = (project as any).lastEmailSent;
                                                const lastSent = lastEmailMeta || project.sentEmails?.[0];

                                                if (lastSent) {
                                                    const dtStr = lastSent.date || '';
                                                    const parsed = parseRobustDate(dtStr);
                                                    if (parsed) {
                                                        lastMailUnix = parsed.getTime();
                                                        lastMailDisplayDate = format(parsed, 'EEE, MMM d');
                                                    } else {
                                                        lastMailDisplayDate = dtStr;
                                                    }
                                                    lastMailTitle = (lastSent.subject || '').split(':').pop()?.trim() || 'General Update';
                                                }

                                                if (!lastTaskUnix && !lastMailUnix) {
                                                    return <span className="text-muted-foreground text-sm italic">No deliveries</span>;
                                                }

                                                // If mail is newer or same time as task, or there is only mail
                                                if (lastMailUnix >= lastTaskUnix) {
                                                    return (
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-green-600 whitespace-nowrap">{lastMailDisplayDate}</span>
                                                            <span className="text-xs text-muted-foreground italic truncate max-w-[150px]" title={lastMailTitle}>
                                                                {lastMailTitle}
                                                            </span>
                                                        </div>
                                                    );
                                                } else {
                                                    return (
                                                        <div className="flex flex-col">
                                                            <span className="text-sm font-medium text-slate-600 whitespace-nowrap">{lastTaskDisplayDate}</span>
                                                            <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={lastTaskTitle}>
                                                                {lastTaskTitle}
                                                            </span>
                                                        </div>
                                                    );
                                                }
                                            })()}
                                        </TableCell>
                                        <TableCell className="py-4">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="gap-2 text-muted-foreground hover:text-foreground"
                                                onClick={() => setHistoryProject(project)}
                                            >
                                                <History className="h-4 w-4" />
                                                {(() => {
                                                    const hasSubcollectionEmails = !!(project as any).lastEmailSent;
                                                    const sentCount = project.sentEmails?.length || 0;
                                                    const receivedCount = project.receivedEmails?.length || 0;
                                                    if (hasSubcollectionEmails) return 'View History';
                                                    if (sentCount === 0 && receivedCount === 0) return 'View History';
                                                    if (receivedCount > 0) return `${sentCount} Sent / ${receivedCount} Replied`;
                                                    return `${sentCount} Sent`;
                                                })()}
                                            </Button>
                                        </TableCell>
                                        <TableCell className="text-right py-4">
                                            {(isAdmin || currentEmployee?.isTeamLead) && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-2 shadow-sm"
                                                    onClick={() => handleOpenSheet(project)}
                                                >
                                                    <Send className="h-3.5 w-3.5" />
                                                    Send Mail
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-200px)]">
                        <Empty className="max-w-md">
                            <EmptyMedia className="h-20 w-20 bg-blue-500/10 rounded-full mb-4">
                                <FileSearch2 className="h-10 w-10 text-blue-500/40" />
                            </EmptyMedia>
                            <EmptyHeader>
                                <EmptyTitle className="text-2xl">No projects to update</EmptyTitle>
                                <EmptyDescription className="text-base leading-relaxed">
                                    Once you add projects to your tracker, they will appear here. You'll then be able to generate AI-powered summaries of your daily progress.
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    </div>
                )}
            </div>

            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent className="overflow-y-auto sm:max-w-[850px] flex flex-col h-full [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="flex items-center gap-2 text-xl">
                            <Bot className="h-6 w-6" />
                            Generate AI Summary
                        </SheetTitle>
                        <SheetDescription>
                            Select the tasks you want to include in the client update for <strong>{selectedProject?.name}</strong>.
                        </SheetDescription>
                    </SheetHeader>

                    {selectedProject && (
                        <div className="flex-1 overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            <div className="space-y-6">
                                {step === 'generate' && (
                                    <>
                                        {/* Mail Type Selector */}
                                        <div className="space-y-3">
                                            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Mail Type</Label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { value: 'task' as const, label: 'Task Mail', icon: ListChecks, desc: 'Auto-picks completed tasks' },
                                                    { value: 'custom' as const, label: 'Custom Mail', icon: MessageSquareText, desc: 'Write your own content' },
                                                    { value: 'query' as const, label: 'Query Mail', icon: HelpCircle, desc: 'Ask questions / follow-up' },
                                                ].map((type) => {
                                                    const Icon = type.icon
                                                    return (
                                                        <div
                                                            key={type.value}
                                                            onClick={() => setMailType(type.value)}
                                                            className={cn(
                                                                "flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all text-center",
                                                                mailType === type.value
                                                                    ? "border-primary bg-primary/5 shadow-sm"
                                                                    : "border-muted hover:border-primary/30 hover:bg-muted/30"
                                                            )}
                                                        >
                                                            <Icon className={cn("h-5 w-5", mailType === type.value ? "text-primary" : "text-muted-foreground")} />
                                                            <span className={cn("text-xs font-semibold", mailType === type.value ? "text-primary" : "text-foreground")}>{type.label}</span>
                                                            <span className="text-[10px] text-muted-foreground leading-tight">{type.desc}</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* AI Tone Selector */}
                                        <div className="space-y-3">
                                            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                                <Sparkles className="h-3.5 w-3.5" /> AI Tone
                                            </Label>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div
                                                    onClick={() => setAiTone('crisp')}
                                                    className={cn(
                                                        "flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all",
                                                        aiTone === 'crisp'
                                                            ? "border-primary bg-primary/5 shadow-sm"
                                                            : "border-muted hover:border-primary/30 hover:bg-muted/30"
                                                    )}
                                                >
                                                    <span className={cn("text-sm font-semibold", aiTone === 'crisp' ? "text-primary" : "text-foreground")}>⚡ Crisp & Short</span>
                                                    <span className="text-[10px] text-muted-foreground">Brief, to-the-point email</span>
                                                </div>
                                                <div
                                                    onClick={() => setAiTone('detailed')}
                                                    className={cn(
                                                        "flex flex-col gap-1 p-3 rounded-lg border-2 cursor-pointer transition-all",
                                                        aiTone === 'detailed'
                                                            ? "border-primary bg-primary/5 shadow-sm"
                                                            : "border-muted hover:border-primary/30 hover:bg-muted/30"
                                                    )}
                                                >
                                                    <span className={cn("text-sm font-semibold", aiTone === 'detailed' ? "text-primary" : "text-foreground")}>📝 Detailed</span>
                                                    <span className="text-[10px] text-muted-foreground">Comprehensive, thorough email</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Task Selection — only for Task Mail */}
                                        {mailType === 'task' && (
                                            <div className="space-y-6">
                                                <div className="flex flex-col gap-1">
                                                    <Label className="text-sm font-bold text-slate-900 uppercase tracking-wider">Select Tasks to Include</Label>
                                                    <p className="text-[11px] text-muted-foreground">Toggle tasks from different states to include in the summary.</p>
                                                </div>

                                                {/* Completed Tasks */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                        <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-[10px] font-bold uppercase tracking-wider">Completed Tasks</Badge>
                                                    </div>
                                                    <div className="border border-emerald-100 rounded-lg p-2 space-y-1 max-h-[180px] overflow-y-auto bg-emerald-50/10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                                        {getProjectTasks(selectedProject, 'Completed').length > 0 ? getProjectTasks(selectedProject, 'Completed').map((task: string, i: number) => (
                                                            <div key={`comp-${i}`} className="flex items-start space-x-3 p-2 hover:bg-emerald-50 rounded-md transition-colors group">
                                                                <Checkbox
                                                                    id={`task-comp-${i}`}
                                                                    checked={selectedTasks.includes(task)}
                                                                    onCheckedChange={() => toggleTaskSelection(task)}
                                                                    className="mt-0.5 border-emerald-200 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                                                                />
                                                                <label htmlFor={`task-comp-${i}`} className="text-sm cursor-pointer truncate font-medium text-slate-700 flex-1">{task}</label>
                                                            </div>
                                                        )) : <p className="p-4 text-xs text-muted-foreground italic text-center">No new completed tasks to share.</p>}
                                                    </div>
                                                </div>

                                                {/* In Progress Tasks */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                                        <Badge variant="secondary" className="bg-blue-600 text-white hover:bg-blue-700 text-[10px] font-bold uppercase tracking-wider">In Progress Tasks</Badge>
                                                    </div>
                                                    <div className="border border-blue-100 rounded-lg p-2 space-y-1 max-h-[180px] overflow-y-auto bg-blue-50/10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                                        {getProjectTasks(selectedProject, 'In Progress').length > 0 ? getProjectTasks(selectedProject, 'In Progress').map((task: string, i: number) => (
                                                            <div key={`prog-${i}`} className="flex items-start space-x-3 p-2 hover:bg-blue-50 rounded-md transition-colors group">
                                                                <Checkbox
                                                                    id={`task-prog-${i}`}
                                                                    checked={selectedTasks.includes(task)}
                                                                    onCheckedChange={() => toggleTaskSelection(task)}
                                                                    className="mt-0.5 border-blue-200 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                                />
                                                                <label htmlFor={`task-prog-${i}`} className="text-sm cursor-pointer truncate font-medium text-slate-700 flex-1">{task}</label>
                                                            </div>
                                                        )) : <p className="p-4 text-xs text-muted-foreground italic text-center">No tasks currently in progress.</p>}
                                                    </div>
                                                </div>

                                                {/* Pending Tasks */}
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 rounded-full bg-slate-300" />
                                                        <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-slate-200">Pending / Next Up</Badge>
                                                    </div>
                                                    <div className="border border-slate-100 rounded-lg p-2 space-y-1 max-h-[180px] overflow-y-auto bg-slate-50/30 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                                        {getProjectTasks(selectedProject, 'Pending').length > 0 ? getProjectTasks(selectedProject, 'Pending').map((task: string, i: number) => (
                                                            <div key={`pend-${i}`} className="flex items-start space-x-3 p-2 hover:bg-slate-100 rounded-md transition-colors group">
                                                                <Checkbox
                                                                    id={`task-pend-${i}`}
                                                                    checked={selectedTasks.includes(task)}
                                                                    onCheckedChange={() => toggleTaskSelection(task)}
                                                                    className="mt-0.5"
                                                                />
                                                                <label htmlFor={`task-pend-${i}`} className="text-sm cursor-pointer truncate font-medium text-slate-600 flex-1">{task}</label>
                                                            </div>
                                                        )) : <p className="p-4 text-xs text-muted-foreground italic text-center">No pending tasks found.</p>}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Free-form body input — for Custom and Query mail */}
                                        {(mailType === 'custom' || mailType === 'query') && (
                                            <div className="space-y-3">
                                                <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                                    {mailType === 'custom' ? 'Draft Your Message' : 'Questions / Follow-up Points'}
                                                </Label>
                                                <ReactQuill
                                                    theme="snow"
                                                    value={generatedSummary}
                                                    onChange={setGeneratedSummary}
                                                    modules={quillModules}
                                                    formats={quillFormats}
                                                    placeholder={mailType === 'custom'
                                                        ? "Write your email content here... Use bold/lists for formatting."
                                                        : "List your questions or follow-up points..."
                                                    }
                                                    className="bg-white rounded-md h-[250px] mb-12"
                                                />
                                                <p className="text-[11px] text-muted-foreground mt-4">AI will refine this into a professional email when you click Generate, or click SKIP AI to send as is.</p>
                                            </div>
                                        )}

                                        {/* Attachments Section */}
                                        <div className="space-y-3">
                                            <Label className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                                <Paperclip className="h-4 w-4" />
                                                Attachments (Optional)
                                            </Label>

                                            {/* Task-based attachments */}
                                            {getAttachmentsGroupedByTask(selectedProject).length > 0 && (
                                                <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                                    {getAttachmentsGroupedByTask(selectedProject).map((taskGroup, groupIdx) => (
                                                        <div key={groupIdx} className="p-4">
                                                            <div className="flex items-center gap-2 mb-3">
                                                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                                                <span className="text-sm font-semibold text-slate-700 truncate">
                                                                    {taskGroup.taskName}
                                                                </span>
                                                                <Badge variant="outline" className="text-[10px] ml-auto">
                                                                    {taskGroup.attachments.length} file{taskGroup.attachments.length > 1 ? 's' : ''}
                                                                </Badge>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-3">
                                                                {taskGroup.attachments.map((att, attIdx) => {
                                                                    const isImage = att.type?.startsWith('image/');
                                                                    const isSelected = selectedAttachments.some(a => a.url === att.url);

                                                                    return isImage ? (
                                                                        <div
                                                                            key={attIdx}
                                                                            className={cn(
                                                                                "relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all group",
                                                                                isSelected
                                                                                    ? "border-primary ring-2 ring-primary/20"
                                                                                    : "border-transparent hover:border-primary/30"
                                                                            )}
                                                                            onClick={() => toggleAttachmentSelection(att)}
                                                                        >
                                                                            <div className="aspect-video bg-slate-100 relative overflow-hidden">
                                                                                <img
                                                                                    src={att.url}
                                                                                    alt={att.name}
                                                                                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                                                />
                                                                                <div className={cn(
                                                                                    "absolute inset-0 bg-primary/20 flex items-center justify-center transition-opacity",
                                                                                    isSelected ? "opacity-100" : "opacity-0"
                                                                                )}>
                                                                                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                                                                                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                                                        </svg>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                            <div className="p-2 bg-white">
                                                                                <p className="text-[10px] font-medium text-slate-600 truncate">{att.name}</p>
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        <div
                                                                            key={attIdx}
                                                                            className={cn(
                                                                                "flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5",
                                                                                isSelected && "border-primary bg-primary/10"
                                                                            )}
                                                                            onClick={() => toggleAttachmentSelection(att)}
                                                                        >
                                                                            <Checkbox
                                                                                id={`attachment-${groupIdx}-${attIdx}`}
                                                                                checked={isSelected}
                                                                                onCheckedChange={() => toggleAttachmentSelection(att)}
                                                                                className="shrink-0"
                                                                            />
                                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                                {getFileIcon(att.type)}
                                                                                <span className="text-xs font-medium truncate">{att.name}</span>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Direct Upload Section */}
                                            <div
                                                className={cn(
                                                    "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all hover:border-primary/50 hover:bg-primary/5",
                                                    isUploading && "opacity-60 pointer-events-none"
                                                )}
                                                onClick={() => fileInputRef.current?.click()}
                                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleFileUpload(e.dataTransfer.files); }}
                                            >
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    multiple
                                                    className="hidden"
                                                    onChange={(e) => handleFileUpload(e.target.files)}
                                                />
                                                {isUploading ? (
                                                    <div className="flex items-center justify-center gap-2 py-2">
                                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                                        <span className="text-sm text-muted-foreground">Uploading...</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-1.5 py-2">
                                                        <Upload className="h-5 w-5 text-muted-foreground" />
                                                        <span className="text-sm font-medium text-muted-foreground">Upload Files</span>
                                                        <span className="text-[10px] text-muted-foreground">Click or drag & drop files here</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Selected Attachments Summary */}
                                            {selectedAttachments.length > 0 && (
                                                <div className="space-y-2">
                                                    <p className="text-xs text-muted-foreground font-medium">
                                                        {selectedAttachments.length} attachment{selectedAttachments.length > 1 ? 's' : ''} selected
                                                    </p>
                                                    <div className="flex flex-wrap gap-2">
                                                        {selectedAttachments.map((att, idx) => (
                                                            <div key={idx} className="flex items-center gap-1.5 bg-muted/50 rounded-full px-3 py-1.5 text-xs font-medium group">
                                                                {getFileIcon(att.type)}
                                                                <span className="truncate max-w-[120px]">{att.name}</span>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); removeAttachment(att.url); }}
                                                                    className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                                                                >
                                                                    <X className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {step === 'review' && (
                                    <div className="space-y-4 animation-fade-in">
                                        <div className="flex items-center justify-between pb-2 border-b">
                                            <Label className="text-sm font-medium">Review Email Content</Label>
                                            <Badge variant="outline" className="text-xs">
                                                <Sparkles className="h-3 w-3 mr-1" /> AI Generated
                                            </Badge>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="subject">Subject</Label>
                                            <Input
                                                id="subject"
                                                value={emailSubject}
                                                onChange={(e) => setEmailSubject(e.target.value)}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label htmlFor="cc">CC (Optional)</Label>
                                                <div className="relative">
                                                    <Input
                                                        id="cc"
                                                        value={ccEmail}
                                                        onChange={(e) => setCcEmail(e.target.value)}
                                                        onFocus={() => setCcDropdownOpen(true)}
                                                        onBlur={() => setTimeout(() => setCcDropdownOpen(false), 200)}
                                                        placeholder="cc@example.com"
                                                        autoComplete="off"
                                                    />
                                                    {ccDropdownOpen && savedCcEmails.length > 0 && (
                                                        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                                            {savedCcEmails
                                                                .filter(e => e.toLowerCase().includes(ccEmail.toLowerCase()))
                                                                .map((email, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                                                                        onMouseDown={() => setCcEmail(email)}
                                                                    >
                                                                        {email}
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">Receives plain email only</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="bcc">BCC (Optional)</Label>
                                                <div className="relative">
                                                    <Input
                                                        id="bcc"
                                                        value={bccEmail}
                                                        onChange={(e) => setBccEmail(e.target.value)}
                                                        onFocus={() => setBccDropdownOpen(true)}
                                                        onBlur={() => setTimeout(() => setBccDropdownOpen(false), 200)}
                                                        placeholder="bcc@example.com"
                                                        autoComplete="off"
                                                    />
                                                    {bccDropdownOpen && savedBccEmails.length > 0 && (
                                                        <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-40 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                                            {savedBccEmails
                                                                .filter(e => e.toLowerCase().includes(bccEmail.toLowerCase()))
                                                                .map((email, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                                                                        onMouseDown={() => setBccEmail(email)}
                                                                    >
                                                                        {email}
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <p className="text-xs text-muted-foreground">Sees all recipients (Client + CC + BCC)</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="body">Message Body</Label>
                                            {mailType === 'task' ? (
                                                <Textarea
                                                    id="body"
                                                    value={generatedSummary}
                                                    onChange={(e) => setGeneratedSummary(e.target.value)}
                                                    className="min-h-[400px] font-medium leading-relaxed resize-none p-4 bg-muted/30 focus:bg-white transition-colors [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                                                />
                                            ) : (
                                                <ReactQuill
                                                    theme="snow"
                                                    value={generatedSummary}
                                                    onChange={setGeneratedSummary}
                                                    modules={quillModules}
                                                    formats={quillFormats}
                                                    className="bg-white rounded-md h-[400px] mb-12 border-none"
                                                />
                                            )}
                                        </div>

                                        {/* Credentials Preview in Review Step */}
                                        {selectedProject?.credentials?.all && selectedProject.credentials.all.length > 0 && (
                                            <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg space-y-3">
                                                <div className="flex items-center gap-2 text-blue-700">
                                                    <Lock className="h-4 w-4" />
                                                    <span className="text-sm font-bold uppercase tracking-wider">Project Access Included</span>
                                                </div>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {selectedProject.credentials.all.map((cred: any, i: number) => (
                                                        <div key={i} className="text-[12px] bg-white p-2 rounded border border-blue-100 flex items-center justify-between gap-4">
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-slate-700">{cred.name || 'Login'}</span>
                                                                {cred.url && <span className="text-[10px] text-blue-600 truncate max-w-[200px]">{cred.url}</span>}
                                                            </div>
                                                            <div className="flex flex-col items-end shrink-0">
                                                                <span className="text-muted-foreground font-medium">{cred.email}</span>
                                                                {cred.password && <span className="text-[11px] font-mono text-slate-500 bg-slate-50 px-1 rounded border border-slate-100 mt-0.5">{cred.password}</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-[10px] text-blue-600/70 italic">* These credentials will be appended as a secure table in the final HTML email.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <SheetFooter className="mt-6 pt-6 border-t">
                        <div className="flex flex-col gap-3 w-full">
                            {step === 'review' && (
                                <div
                                    className={cn(
                                        "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                                        sendWhatsApp
                                            ? "border-[#25D366]/40 bg-[#25D366]/5"
                                            : "border-slate-200 bg-slate-50/50 hover:border-[#25D366]/20"
                                    )}
                                    onClick={() => setSendWhatsApp(!sendWhatsApp)}
                                >
                                    <Checkbox
                                        id="send-whatsapp-too"
                                        checked={sendWhatsApp}
                                        onCheckedChange={(checked) => setSendWhatsApp(!!checked)}
                                    />
                                    <div className="flex-1">
                                        <label htmlFor="send-whatsapp-too" className="text-sm font-bold text-slate-700 cursor-pointer flex items-center gap-2">
                                            <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#25D366]" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                            Also send on WhatsApp
                                        </label>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">The same update will be sent as a WhatsApp message to the client</p>
                                    </div>
                                    {sendWhatsApp && (
                                        <span className="text-[10px] font-bold text-[#25D366] bg-[#25D366]/10 px-2 py-0.5 rounded-full">ON</span>
                                    )}
                                </div>
                            )}
                            <div className="flex sm:flex-row sm:justify-between gap-3">
                                <Button variant="outline" onClick={() => setIsSheetOpen(false)}>Cancel</Button>
                                {step === 'generate' ? (
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        {(mailType === 'custom' || mailType === 'query') && (
                                            <Button
                                                variant="outline"
                                                onClick={handleSkipAI}
                                                className="gap-2 border-slate-300 hover:bg-slate-50"
                                            >
                                                Send Directly (Skip AI)
                                            </Button>
                                        )}
                                        <Button
                                            className="gap-2 w-full sm:w-auto"
                                            onClick={handleGenerateSummary}
                                            disabled={(mailType === 'task' && selectedTasks.length === 0) || isGenerating}
                                        >
                                            {isGenerating ? (
                                                <>Generating...</>
                                            ) : (
                                                <>
                                                    <Sparkles className="h-4 w-4" />
                                                    {mailType === 'task' ? `Generate ${aiTone === 'crisp' ? 'Crisp' : 'Detailed'} Summary` : 'Polish & Enhance with AI'}
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                ) : (
                                    <Button className="gap-2 w-full sm:w-auto" onClick={handleSendMail} disabled={sending}>
                                        {sending ? (
                                            <>Sending...</>
                                        ) : (
                                            <>
                                                <Send className="h-4 w-4" /> {sendWhatsApp ? 'Send Mail + WhatsApp' : 'Send Mail'}
                                            </>
                                        )}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <Sheet open={!!historyProject} onOpenChange={(open) => {
                if (!open) {
                    setHistoryProject(null);
                    setSelectedEmailIndices([]);
                }
            }}>

                <SheetContent className="overflow-hidden sm:max-w-[70vw] w-full flex flex-col h-full p-0">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                        <div className="p-6 border-b flex justify-between items-start">
                            <div>
                                <SheetHeader>
                                    <SheetTitle>Mail History</SheetTitle>
                                    <SheetDescription>
                                        Past updates & replies for <strong>{historyProject?.name}</strong>. <span className="text-xs text-muted-foreground">(Auto-syncing)</span>
                                    </SheetDescription>
                                </SheetHeader>
                                <TabsList className="mt-4">
                                    <TabsTrigger value="all">All Mail</TabsTrigger>
                                    <TabsTrigger value="sent">Sent Updates</TabsTrigger>
                                    <TabsTrigger value="replies">Replies</TabsTrigger>
                                </TabsList>
                            </div>
                        </div>


                        <div className="flex-1 flex overflow-hidden">
                            {/* Sidebar List */}
                            <div className="w-[320px] border-r overflow-y-auto p-4 space-y-3 bg-muted/5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                {filteredEmails.length > 0 && (
                                    <div className="flex items-center justify-between pb-2 border-b">
                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedEmailIndices.length === filteredEmails.length && filteredEmails.length > 0}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedEmailIndices(filteredEmails.map((_, i) => i));
                                                    } else {
                                                        setSelectedEmailIndices([]);
                                                    }
                                                }}
                                            />
                                            <span className="text-sm font-medium text-muted-foreground">
                                                {selectedEmailIndices.length > 0 ? `${selectedEmailIndices.length} selected` : 'Select All'}
                                            </span>
                                        </div>
                                        {selectedEmailIndices.length > 0 && isAdmin && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 text-xs px-2 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={handleDeleteSelectedEmails}
                                                disabled={isDeleting}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                {isDeleting ? "Deleting..." : "Delete"}
                                            </Button>
                                        )}
                                    </div>
                                )}
                                {isLoadingHistory ? (
                                    <div className="flex flex-col items-center justify-center py-10 space-y-2 opacity-50 capitalize">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        <span className="text-[10px] font-black tracking-widest">Hydrating History...</span>
                                    </div>
                                ) : filteredEmails.length === 0 ? (
                                    <p className="text-center text-muted-foreground py-8 text-sm">No emails found.</p>
                                ) : (
                                    filteredEmails.map((email: any, i: number) => (
                                        <div
                                            key={i}
                                            onClick={() => setViewingEmailIndex(i)}
                                            className={cn(
                                                "group flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors text-left",
                                                viewingEmailIndex === i ? "bg-primary/5 border-primary shadow-sm" : "hover:bg-white bg-card"
                                            )}
                                        >
                                            <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedEmailIndices.includes(i)}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setSelectedEmailIndices([...selectedEmailIndices, i]);
                                                        } else {
                                                            setSelectedEmailIndices(selectedEmailIndices.filter(idx => idx !== i));
                                                        }
                                                    }}
                                                    className={cn(
                                                        "transition-opacity",
                                                        selectedEmailIndices.includes(i) || selectedEmailIndices.length > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                                    )}
                                                />
                                            </div>
                                            <div className="flex-1 flex flex-col space-y-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-muted-foreground flex items-center">
                                                        <Calendar className="h-3 w-3 mr-1" />
                                                        {(() => {
                                                            // Try Firestore timestamps first, then date string
                                                            if (email.createdAt?.seconds) return new Date(email.createdAt.seconds * 1000).toLocaleDateString();
                                                            if (email.savedAt?.seconds) return new Date(email.savedAt.seconds * 1000).toLocaleDateString();
                                                            const d = new Date(email.date);
                                                            return isValid(d) ? d.toLocaleDateString() : (email.date || 'Unknown');
                                                        })()}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        {email.msgType === 'received' && <Badge variant="outline" className="text-[10px] h-5 px-1 bg-blue-50 text-blue-700 border-blue-200">Inbox</Badge>}
                                                        {email.msgType === 'sent' && (
                                                            email.opened ? (
                                                                <Badge variant="outline" className="text-[10px] h-5 px-1 bg-emerald-50 text-emerald-700 border-emerald-200" title={`Read on ${new Date(email.openedAt).toLocaleString()}`}>
                                                                    <CheckCheck className="h-3 w-3 mr-1" />
                                                                    Read
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-[10px] h-5 px-1 bg-gray-50 text-gray-500 border-gray-200" title="Sent (Unread)">
                                                                    <CheckCheck className="h-3 w-3 mr-1 opacity-50" />
                                                                    Sent
                                                                </Badge>
                                                            )
                                                        )}
                                                        {email.attachmentCount > 0 && (
                                                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                                                                <Paperclip className="h-3 w-3 mr-1" />
                                                                {email.attachmentCount}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="font-medium text-sm line-clamp-2">{email.subject}</span>
                                                <span className="text-xs text-muted-foreground truncate opacity-80">
                                                    {email.msgType === 'received' ? `From: ${email.sender?.split('<')[0]}` : `To: ${historyProject?.client}`}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Content Panel */}
                            <div className="flex-1 overflow-y-auto bg-white [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                {viewingEmailIndex !== null && filteredEmails[viewingEmailIndex] ? (
                                    <div className="p-6 space-y-6">
                                        <div className="space-y-4 pb-6 border-b">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-3 flex-1">
                                                    {filteredEmails[viewingEmailIndex].msgType === 'received' ? <Inbox className="h-5 w-5 text-blue-600" /> : <Send className="h-5 w-5 text-muted-foreground" />}
                                                    <h2 className="text-xl font-bold leading-tight line-clamp-2">
                                                        {filteredEmails[viewingEmailIndex].subject}
                                                    </h2>
                                                    {filteredEmails[viewingEmailIndex].msgType === 'sent' && (
                                                        filteredEmails[viewingEmailIndex].opened ? (
                                                            <Badge variant="outline" className="shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200" title={`Read on ${new Date(filteredEmails[viewingEmailIndex].openedAt).toLocaleString()}`}>
                                                                <CheckCheck className="h-4 w-4 mr-1.5" />
                                                                Read
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="shrink-0 bg-gray-50 text-gray-500 border-gray-200" title="Sent (Unread)">
                                                                <CheckCheck className="h-4 w-4 mr-1.5 opacity-50" />
                                                                Sent
                                                            </Badge>
                                                        )
                                                    )}
                                                </div>

                                                {isAdmin && (
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-600 shrink-0">
                                                                <Trash2 className="h-5 w-5" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Delete Email?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    This action cannot be undone. This will permanently delete this email from the project history.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction onClick={handleDeleteEmail} className="bg-red-600 hover:bg-red-700">
                                                                    {isDeleting ? "Deleting..." : "Delete"}
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between text-sm text-muted-foreground">
                                                <div className="flex items-center gap-4">
                                                    <span className="flex items-center bg-muted px-2 py-1 rounded">
                                                        <Calendar className="h-4 w-4 mr-2" />
                                                        {(() => {
                                                            const em = filteredEmails[viewingEmailIndex];
                                                            if (em.createdAt?.seconds) return new Date(em.createdAt.seconds * 1000).toLocaleString();
                                                            if (em.savedAt?.seconds) return new Date(em.savedAt.seconds * 1000).toLocaleString();
                                                            const d = new Date(em.date);
                                                            return isValid(d) ? d.toLocaleString() : (em.date || 'Unknown');
                                                        })()}
                                                    </span>
                                                    <span>From: {filteredEmails[viewingEmailIndex].sender}</span>
                                                </div>
                                                {filteredEmails[viewingEmailIndex].msgType === 'received' && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="gap-2 text-primary border-primary/20 hover:bg-primary/5 shadow-sm"
                                                        onClick={() => {
                                                            const project = historyProject;
                                                            if (project) {
                                                                setHistoryProject(null);
                                                                handleOpenSheet(project);
                                                                // Set default mail type to query for replies
                                                                setMailType('query');
                                                            }
                                                        }}
                                                    >
                                                        <Reply className="h-4 w-4" />
                                                        Reply to Client
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {(() => {
                                            const email = filteredEmails[viewingEmailIndex];
                                            let htmlToRender = email.htmlContent || null;

                                            if (!htmlToRender && email.msgType === 'sent') {
                                                htmlToRender = generateEmailTemplate({
                                                    projectName: historyProject?.name || '',
                                                    clientName: historyProject?.client?.split(' ')[0] || '',
                                                    summary: email.content || "",
                                                    date: email.date,
                                                    credentials: historyProject?.credentials?.all || []
                                                });
                                            }

                                            if (!htmlToRender && email.msgType === 'received') {
                                                const cleanedContent = cleanReplyContent(email.content);
                                                htmlToRender = generateReplyTemplate({
                                                    senderName: email.sender ? email.sender.split('<')[0].trim().replace(/^"|"$/g, '') : "Unknown Sender",
                                                    content: cleanedContent,
                                                    date: new Date(email.date).toLocaleString(),
                                                    subject: email.subject
                                                });
                                            }

                                            return (
                                                <div
                                                    className="border rounded-md bg-white p-4"
                                                    dangerouslySetInnerHTML={{ __html: htmlToRender || '' }}
                                                />
                                            )
                                        })()}


                                        {filteredEmails[viewingEmailIndex].attachments && filteredEmails[viewingEmailIndex].attachments.length > 0 && (
                                            <div className="pt-6 border-t mt-8">
                                                <h3 className="text-sm font-semibold mb-3 flex items-center">
                                                    <Paperclip className="h-4 w-4 mr-2" />
                                                    Attachments ({filteredEmails[viewingEmailIndex].attachments.length})
                                                </h3>
                                                <div className="flex flex-wrap gap-3">
                                                    {filteredEmails[viewingEmailIndex].attachments.map((att: any, idx: number) => {
                                                        const isImage = att.type?.startsWith('image/');
                                                        return (
                                                            <div key={idx} className="group relative w-[180px] border rounded-lg overflow-hidden bg-card hover:shadow-md transition-all">
                                                                <div className="aspect-[4/3] w-full bg-muted relative overflow-hidden">
                                                                    {isImage ? (
                                                                        <img
                                                                            src={att.url}
                                                                            alt={att.name}
                                                                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                                        />
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center p-6">
                                                                            {getFileIcon(att.type)}
                                                                        </div>
                                                                    )}

                                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                        <Button
                                                                            size="icon"
                                                                            variant="secondary"
                                                                            className="h-8 w-8 rounded-full"
                                                                            onClick={() => window.open(att.url, '_blank')}
                                                                        >
                                                                            <Eye className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </div>

                                                                <div className="p-2 border-t bg-white">
                                                                    <div className="text-xs font-medium truncate" title={att.name}>{att.name}</div>
                                                                    <div className="text-[10px] text-muted-foreground truncate opacity-70">
                                                                        {(att.size ? (att.size / 1024).toFixed(0) + ' KB' : 'Attachment')}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}


                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                            <Mail className="h-6 w-6" />
                                        </div>
                                        <p>Select an email from {activeTab === 'all' ? 'history' : activeTab === 'sent' ? 'sent updates' : 'replies'} to view details.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </Tabs>
                </SheetContent>
            </Sheet>

        </div>
    )
}

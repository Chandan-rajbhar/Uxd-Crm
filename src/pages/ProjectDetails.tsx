import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Plus, Loader2, Trash2, Sparkles, Calendar, Flame, Zap, Users, Check, FileText, ChevronLeft, ChevronRight } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

import React, { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import { useProjects } from "src/hooks/useProjects"
import { projectService } from "src/firebase/projectService"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format, isValid, parseISO, subMonths, addMonths } from "date-fns"


import { TaskDetailsSheet } from "@/components/TaskDetailsSheet"
import { QuickTagSheet } from "@/components/QuickTagSheet"
import { AITaskExtractor } from "@/components/AITaskExtractor"
import { TemplateTasksSheet } from "@/components/TemplateTasksSheet"
import { useAuth } from "src/contexts/AuthContext"
import { useEmployees } from "src/hooks/useEmployees"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { AIPostGeneratorSheet } from "@/components/AIPostGeneratorSheet"
import { QuickPostSheet } from "@/components/QuickPostSheet"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Upload, Save, Paperclip } from "lucide-react"

// Extracted sub-components
import { TaskRow } from "./ProjectDetails/TaskRow"
import { DigitalMarketingRow } from "./ProjectDetails/DigitalMarketingRow"
import { ProjectModals } from "./ProjectDetails/ProjectModals"




export default function ProjectDetailsPage() {
    const navigate = useNavigate()
    const { id } = useParams()
    const { projects, loading } = useProjects()

    const { user, isAdmin, isEmployee, isClient } = useAuth()
    const { employees } = useEmployees()

    // Find the current employee record based on Auth UID
    const currentEmployee = useMemo(() => {
        if (user && employees.length > 0) {
            return employees.find(e => e.authUid === user.uid || e.email === user.email)
        }
        return null
    }, [user, employees])


    // Find the project from the store
    const project = projects.find(p => p.id === id)

    // State
    const [items, setItems] = useState<any[]>([])
    const [selectedTask, setSelectedTask] = useState<any>(null)
    const [isSheetOpen, setIsSheetOpen] = useState(false)


    // Quick add task state
    const [newTaskName, setNewTaskName] = useState("")

    // Tagging state
    const [tagTask, setTagTask] = useState<any>(null)
    const [isTagOpen, setIsTagOpen] = useState(false)

    // Delete dialog state
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
    const [isClearAllOpen, setIsClearAllOpen] = useState(false)

    // AI Task Extractor state
    const [isAIOpen, setIsAIOpen] = useState(false)
    const [isAIGenOpen, setIsAIGenOpen] = useState(false)
    const [aiGenTargetItem, setAiGenTargetItem] = useState<any>(null)
    const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false)
    const [isQuickPostOpen, setIsQuickPostOpen] = useState(false)
    const [quickPostWeek, setQuickPostWeek] = useState<string>("Week 1")
    const [quickPostTargetItem, setQuickPostTargetItem] = useState<any>(null)

    // Filter state
    const [statusFilter, setStatusFilter] = useState<string>("All")
    const [showMyTasks, setShowMyTasks] = useState(false)
    const [viewDate, setViewDate] = useState(new Date())
    const selectedMonth = format(viewDate, 'MMMM yyyy')

    // Inline subtask state
    const [activeSubtaskParentId, setActiveSubtaskParentId] = useState<string | null>(null)
    const [newSubtaskName, setNewSubtaskName] = useState("")
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())

    // Resource state
    const [isResourcesSheetOpen, setIsResourcesSheetOpen] = useState(false)
    const [resourceSheetView, setResourceSheetView] = useState<'list' | 'add' | 'detail'>('list')
    const [selectedResource, setSelectedResource] = useState<any>(null)
    const [resourceType, setResourceType] = useState<'text' | 'file'>('text')
    const [resourceTitle, setResourceTitle] = useState("")
    const [resourceContent, setResourceContent] = useState("")
    const [resourceFile, setResourceFile] = useState<File | null>(null)
    const [isSavingResource, setIsSavingResource] = useState(false)
    const [activeTab, setActiveTab] = useState<'marketing' | 'more'>('marketing')
    const [selectedWeek, setSelectedWeek] = useState<string>('Week 1')

    const toggleExpand = (taskId: string) => {
        setExpandedTasks(prev => {
            const next = new Set(prev)
            if (next.has(taskId)) next.delete(taskId)
            else next.add(taskId)
            return next
        })
    }

    // Meeting state




    const isMarketingTask = (item: any) => !!(item.platform || item.week || item.monthYear);

    // Initialize timeline items from project milestones or notes
    useEffect(() => {
        if (!project) return;

        const milestones = (project.milestones || []).filter((m: any) => m.task && m.task.trim().length > 0);
        let combinedItems = [...milestones];

        if (project.notes) {
            // Create tasks from notes, but ONLY if they aren't already in milestones
            const noteTasks = project.notes.split('\n')
                .filter(t => t.trim().length > 0)
                .filter(note => !milestones.some((m: any) => m.task === note.trim())) // Deduplication
                .map((note, index) => ({
                    id: `auto-${Date.now()}-${index}`, // Unique stable ID for this render session
                    task: note.trim(),
                    date: format(new Date(), 'yyyy-MM-dd'),
                    status: 'Pending',
                    description: 'Active task from Project Tracker',
                    assignedTo: project.devTeam?.[0] || { name: 'Unassigned', avatar: '' },
                    notes: [],
                    attachments: []
                }));

            combinedItems = [...combinedItems, ...noteTasks];
        }

        // 1. Sort by date first (descending - latest first)
        combinedItems.sort((a, b) => {
            const dateA = a.date || "";
            const dateB = b.date || "";

            if (dateB !== dateA) return dateB.localeCompare(dateA);

            // Priority sorting (high first)
            if (a.priority === 'high' && b.priority !== 'high') return -1;
            if (a.priority !== 'high' && b.priority === 'high') return 1;

            // New Feature sorting
            if (a.isNewFeature && !b.isNewFeature) return -1;
            if (!a.isNewFeature && b.isNewFeature) return 1;

            // Fallback to timestamp in ID
            const aTime = a.id.includes('task-') ? parseInt(a.id.split('-')[1]) : (a.id.includes('auto-') ? parseInt(a.id.split('-')[1]) : 0);
            const bTime = b.id.includes('task-') ? parseInt(b.id.split('-')[1]) : (b.id.includes('auto-') ? parseInt(b.id.split('-')[1]) : 0);

            return bTime - aTime;
        });

        // 2. Filter restrictions (Team member access)
        const isTeamMember = !isAdmin && currentEmployee && (
            (currentEmployee.team && (project.assignedTeams?.includes(currentEmployee.team) || project.assignedTeam === currentEmployee.team)) ||
            project.devTeam?.some((d: any) => (typeof d === 'string' ? d : d.name) === currentEmployee.name)
        );

        if (!isAdmin && !isClient && !isTeamMember && currentEmployee && project.category !== "Digital Marketing") {
            combinedItems = combinedItems.filter(item => {
                const assignees = Array.isArray(item.assignedTo) ? item.assignedTo : (item.assignedTo ? [item.assignedTo] : []);
                return assignees.some((a: any) => (typeof a === 'string' ? a : a.name) === currentEmployee.name);
            });
        }

        // 3. Client Hidden Filter
        if (isClient) {
            combinedItems = combinedItems.filter(item => !item.isHiddenFromClient);
        }

        // 4. Status Filter
        if (statusFilter !== "All") {
            combinedItems = combinedItems.filter(item => item.status === statusFilter);
        }

        // 5. My Tasks Filter
        if (!isAdmin && showMyTasks && currentEmployee) {
            combinedItems = combinedItems.filter(item => {
                const assignees = Array.isArray(item.assignedTo) ? item.assignedTo : (item.assignedTo ? [item.assignedTo] : []);
                return assignees.some((a: any) => (typeof a === 'string' ? a : a.name) === currentEmployee.name);
            });
        }

        setItems(combinedItems);
    }, [project, isAdmin, currentEmployee, statusFilter, showMyTasks]);




    // Helper to sanitize data for Firestore (remove undefined)
    const sanitizeForFirestore = (data: any[]) => {
        return data.map(item => {
            const cleanItem = { ...item };
            Object.keys(cleanItem).forEach(key => {
                if (cleanItem[key] === undefined) {
                    delete cleanItem[key];
                }
            });
            return cleanItem;
        });
    };

    // Merge local (possibly filtered) items back into the full milestones list.
    // This prevents overwriting tasks that aren't visible to the current user.
    const mergeIntoFullMilestones = (localItems: any[], deletedId?: string) => {
        const fullMilestones = (project?.milestones || []).filter((m: any) => m.task && m.task.trim().length > 0);
        // Build a map of local items by ID for quick lookup
        const localMap = new Map<string, any>();
        localItems.forEach(item => localMap.set(item.id, item));

        // Update existing milestones or keep them unchanged
        let merged = fullMilestones.map((m: any) => {
            if (deletedId && m.id === deletedId) return null; // Mark for removal
            return localMap.has(m.id) ? localMap.get(m.id) : m;
        }).filter(Boolean);

        // Add any new items that don't exist in milestones yet
        localItems.forEach(item => {
            if (!fullMilestones.some((m: any) => m.id === item.id)) {
                merged.push(item);
            }
        });

        return merged;
    };

    const calculateProjectStatus = (tasks: any[]) => {
        if (!tasks || tasks.length === 0) return project?.status || 'Pending';

        const allDone = tasks.every(t => t.status === 'Completed' || t.status === 'Delivered');
        if (allDone) return 'Completed';

        const anyActive = tasks.some(t => t.status === 'In Progress' || t.status === 'Completed');
        if (anyActive) return 'In Progress';

        return 'Pending';
    }

    const handleStatusChange = async (itemId: string, newStatus: string) => {
        if (!project?.id) return

        let hasError = false;
        const previousItems = [...items];
        const updatedItems = items.map(item => {
            if (item.id === itemId) {
                const isCompleted = newStatus === 'Completed' || newStatus === 'Delivered';

                // Requirement: all subtasks must be completed before marking as Completed/Delivered
                if (isCompleted && item.subtasks && item.subtasks.length > 0) {
                    const allSubtasksDone = item.subtasks.every((st: any) => st.completed);
                    if (!allSubtasksDone) {
                        toast.error("Please complete all subtasks before marking this task as completed.");
                        hasError = true;
                        return item;
                    }
                }

                return {
                    ...item,
                    status: newStatus,
                    completedAt: isCompleted ? new Date().toISOString() : undefined
                }
            }
            return item
        })

        if (hasError) return;

        setItems(updatedItems)
        const fullMilestones = mergeIntoFullMilestones(updatedItems);
        const newProjectStatus = calculateProjectStatus(fullMilestones);

        projectService.updateProject(project.id, {
            milestones: sanitizeForFirestore(fullMilestones),
            status: newProjectStatus
        }).then(() => {
            const taskObj = updatedItems.find(i => i.id === itemId);
            if (taskObj) {
            }
        }).catch((error) => {
            console.error("Failed to update status:", error)
            setItems(previousItems) // Revert optimistic update
            toast.error("Failed to update status.")
        });
    }

    const handlePriorityToggle = async (itemId: string) => {
        if (!project?.id || !isAdmin) return

        const previousItems = [...items];
        const updatedItems = items.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    priority: item.priority === 'high' ? 'normal' : 'high',
                    lastEditedAt: new Date().toISOString()
                }
            }
            return item
        })

        setItems(updatedItems)
        const fullMilestones = mergeIntoFullMilestones(updatedItems);

        projectService.updateProject(project.id, {
            milestones: sanitizeForFirestore(fullMilestones)
        }).catch((error) => {
            console.error("Failed to update priority:", error)
            setItems(previousItems) // Revert
            toast.error("Failed to update priority.")
        });
    }

    const handleFeatureToggle = async (itemId: string) => {
        if (!project?.id || (!isAdmin && !isEmployee)) return

        const previousItems = [...items];
        const updatedItems = items.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    isNewFeature: !item.isNewFeature,
                    lastEditedAt: new Date().toISOString()
                }
            }
            return item
        })

        setItems(updatedItems)
        const fullMilestones = mergeIntoFullMilestones(updatedItems);

        projectService.updateProject(project.id, {
            milestones: sanitizeForFirestore(fullMilestones)
        }).catch(error => {
            console.error("Failed to update feature status:", error)
            setItems(previousItems) // Revert
            toast.error("Failed to update feature status.")
        });
    }

    const handleHideToggle = async (itemId: string) => {
        if (!project?.id || !isAdmin) return

        const previousItems = [...items];
        const updatedItems = items.map(item => {
            if (item.id === itemId) {
                return {
                    ...item,
                    isHiddenFromClient: !item.isHiddenFromClient,
                    lastEditedAt: new Date().toISOString()
                }
            }
            return item
        })

        setItems(updatedItems)
        const fullMilestones = mergeIntoFullMilestones(updatedItems);

        projectService.updateProject(project.id, {
            milestones: sanitizeForFirestore(fullMilestones)
        }).then(() => {
            const isHidden = updatedItems.find(i => i.id === itemId)?.isHiddenFromClient;
            toast.success(isHidden ? "Task hidden from client" : "Task visible to client")
        }).catch(error => {
            console.error("Failed to update visibility:", error)
            setItems(previousItems) // Revert
            toast.error("Failed to update visibility status.")
        });
    }


    // Handle task update from sheet
    const handleTaskUpdate = async (updatedTask: any) => {
        if (!project?.id) return

        const updatedItems = items.map(item =>
            item.id === updatedTask.id ? { ...updatedTask, lastEditedAt: new Date().toISOString() } : item
        )

        setItems(updatedItems)
        setSelectedTask(updatedTask) // Keep sheet in sync

        try {
            const fullMilestones = mergeIntoFullMilestones(updatedItems)
            const cleanItems = sanitizeForFirestore(fullMilestones)
            await projectService.updateProject(project.id, {
                milestones: cleanItems
            })
        } catch (error) {
            console.error("Failed to update task:", error)
            toast.error("Failed to update task details")
        }
    }

    // Trigger delete dialog
    const handleDeleteClick = async (taskId: string) => {
        setTaskToDelete(taskId)
        setIsDeleteOpen(true)
    }

    const handleTagClick = (task: any) => {
        setTagTask(task)
        setIsTagOpen(true)
    }

    // Confirm delete handler
    const confirmDeleteTask = async () => {
        if (!taskToDelete || !project?.id) return

        // Optimistic update
        const updatedItems = items.filter(item => item.id !== taskToDelete)
        setItems(updatedItems)

        // Close sheet if open and matches deleted task
        if (selectedTask?.id === taskToDelete) {
            setIsSheetOpen(false)
            setSelectedTask(null)
        }

        try {
            const fullMilestones = mergeIntoFullMilestones(updatedItems, taskToDelete)
            const cleanItems = sanitizeForFirestore(fullMilestones)
            await projectService.updateProject(project.id, {
                milestones: cleanItems,
                status: calculateProjectStatus(fullMilestones)
            })
            toast.success("Task deleted")
        } catch (error) {
            console.error("Failed to delete task:", error)
            setItems(items) // Revert
            toast.error("Failed to delete task")
        } finally {
            setIsDeleteOpen(false)
            setTaskToDelete(null)
        }
    }

    // Confirm clear all tasks
    const handleClearAllTasks = async () => {
        if (!project?.id) return

        const previousItems = [...items];
        // Optimistic update
        setItems([]);
        setIsSheetOpen(false);
        setSelectedTask(null);

        try {
            await projectService.updateProject(project.id, {
                milestones: [],
                status: calculateProjectStatus([])
            })
            toast.success("All tasks cleared")
        } catch (error) {
            console.error("Failed to clear tasks:", error)
            setItems(previousItems) // Revert
            toast.error("Failed to clear tasks")
        } finally {
            setIsClearAllOpen(false)
        }
    }

    // Quick add task handler
    const handleAddTask = async () => {
        if (!newTaskName.trim() || !project?.id) {
            if (!newTaskName.trim()) toast.error("Task name cannot be empty");
            return;
        }

        const taskName = newTaskName.trim();
        // Optimistically clear input immediately so user can type again
        setNewTaskName("");

        const newTask = {
            id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            task: taskName,
            date: format(new Date(), 'yyyy-MM-dd'),
            status: 'Pending',
            description: '',
            // Assign to creator (current employee) if available, otherwise default
            assignedTo: currentEmployee ? { name: currentEmployee.name, avatar: currentEmployee.avatar || '' } : (project.devTeam?.[0] || { name: 'Unassigned', avatar: '' }),
            notes: [],
            attachments: []
        }

        // Optimistic update of UI
        const updatedItems = [newTask, ...items];
        setItems(updatedItems);

        try {
            const fullMilestones = mergeIntoFullMilestones(updatedItems);
            const cleanItems = sanitizeForFirestore(fullMilestones);
            const newProjectStatus = calculateProjectStatus(fullMilestones);

            // Fire and forget to avoid blocking UI
            projectService.updateProject(project.id, {
                milestones: cleanItems,
                status: newProjectStatus
            }).then(() => {

                // Optional: remove success toast if the user prefers silent fast adds
                // toast.success("Task added successfully!")
            }).catch((error) => {
                console.error("Failed to add task:", error);
                setItems(items); // Revert on failure
                toast.error("Failed to add task.");
            });

        } catch (error) {
            console.error("Failed to add task setup:", error);
            setItems(items); // Revert
            toast.error("Failed to add task.");
        }
    }

    const handleAddSubtaskInline = async (parentId: string) => {
        if (!newSubtaskName.trim() || !project?.id) {
            setActiveSubtaskParentId(null)
            setNewSubtaskName("")
            return
        }

        const subtask = {
            id: Date.now().toString(),
            title: newSubtaskName.trim(),
            completed: false,
            createdAt: new Date().toISOString()
        }

        const updatedItems = items.map(item => {
            if (item.id === parentId) {
                return {
                    ...item,
                    subtasks: [...(item.subtasks || []), subtask]
                }
            }
            return item
        })

        setItems(updatedItems)
        setNewSubtaskName("")
        setActiveSubtaskParentId(null)

        try {
            const fullMilestones = mergeIntoFullMilestones(updatedItems)
            const cleanItems = sanitizeForFirestore(fullMilestones)
            await projectService.updateProject(project.id, {
                milestones: cleanItems
            })
            toast.success("Subtask added")
        } catch (error) {
            console.error("Failed to add subtask:", error)
            setItems(items) // Revert
            toast.error("Failed to add subtask")
        }
    }

    const handleToggleSubtaskInline = async (parentId: string, subtaskId: string) => {
        if (!project?.id) return

        const updatedItems = items.map(item => {
            if (item.id === parentId) {
                const updatedSubtasks = (item.subtasks || []).map((st: any) =>
                    st.id === subtaskId ? { ...st, completed: !st.completed } : st
                )
                return { ...item, subtasks: updatedSubtasks }
            }
            return item
        })

        setItems(updatedItems)
        try {
            const fullMilestones = mergeIntoFullMilestones(updatedItems)
            await projectService.updateProject(project.id, {
                milestones: sanitizeForFirestore(fullMilestones)
            })
        } catch (error) {
            console.error(error)
            setItems(items)
        }
    }

    const handleDeleteSubtaskInline = async (parentId: string, subtaskId: string) => {
        if (!project?.id) return

        const updatedItems = items.map(item => {
            if (item.id === parentId) {
                const updatedSubtasks = (item.subtasks || []).filter((st: any) => st.id !== subtaskId)
                return { ...item, subtasks: updatedSubtasks }
            }
            return item
        })

        setItems(updatedItems)
        try {
            const fullMilestones = mergeIntoFullMilestones(updatedItems)
            await projectService.updateProject(project.id, {
                milestones: sanitizeForFirestore(fullMilestones)
            })
            toast.success("Subtask deleted")
        } catch (error) {
            console.error(error)
            setItems(items)
        }
    }


    const handleAddResource = async () => {
        if (!project?.id || !resourceTitle.trim()) {
            toast.error("Please provide a title for the resource")
            return
        }

        setIsSavingResource(true)
        try {
            let content = resourceContent
            let fileName = ""

            if (resourceType === 'file' && resourceFile) {
                content = await projectService.uploadProjectFile(project.id, resourceFile)
                fileName = resourceFile.name
            }

            const newResource = {
                id: Date.now().toString(),
                title: resourceTitle.trim(),
                type: resourceType,
                content,
                fileName,
                createdBy: currentEmployee?.name || user?.displayName || user?.email || "Team Member",
                createdAt: new Date().toISOString()
            }

            const updatedResources = [...(project.resources || []), newResource]
            await projectService.updateProject(project.id, { resources: updatedResources })

            toast.success("Resource added successfully")
            setResourceSheetView('list')
            setResourceTitle("")
            setResourceContent("")
            setResourceFile(null)
        } catch (error) {
            console.error("Failed to add resource:", error)
            toast.error("Failed to add resource")
        } finally {
            setIsSavingResource(false)
        }
    }

    const handleDeleteResource = async (resourceId: string) => {
        if (!project?.id) return

        try {
            const resourceToDelete = project.resources?.find(r => r.id === resourceId)
            if (resourceToDelete?.type === 'file' && resourceToDelete.content) {
                await projectService.deleteProjectFile(resourceToDelete.content)
            }

            const updatedResources = (project.resources || []).filter(r => r.id !== resourceId)
            await projectService.updateProject(project.id, { resources: updatedResources })
            toast.success("Resource deleted")
        } catch (error) {
            console.error("Failed to delete resource:", error)
            toast.error("Failed to delete resource")
        }
    }

    // Client Action Handlers
    const [actionTask, setActionTask] = useState<any>(null)
    const [actionType, setActionType] = useState<'reject' | 'doubt' | 'view-reject' | 'view-doubt' | null>(null)
    const [actionReason, setActionReason] = useState("")

    const handleClientActionClick = async (task: any, type: 'approve' | 'reject' | 'doubt' | 'view-reject' | 'view-doubt') => {
        if (!project?.id) return;

        if (type === 'approve') {
            const updatedItems = items.map(item => {
                if (item.id === task.id) {
                    const newNotes = [...(item.notes || [])]
                    const timestamp = new Date().toISOString()

                    newNotes.push({
                        id: Date.now(),
                        text: `CLIENT APPROVAL: Task marked as approved by client.`,
                        sender: user?.displayName || user?.email || "Client",
                        date: timestamp,
                        senderType: "client"
                    })

                    return {
                        ...item,
                        status: 'Completed',
                        completedAt: timestamp,
                        notes: newNotes
                    }
                }
                return item
            })

            setItems(updatedItems)
            const fullMilestones = mergeIntoFullMilestones(updatedItems);
            const newProjectStatus = calculateProjectStatus(fullMilestones);

            try {
                const cleanItems = sanitizeForFirestore(fullMilestones)
                await projectService.updateProject(project.id, {
                    milestones: cleanItems,
                    status: newProjectStatus
                })
                toast.success("Task approved!")
            } catch (error) {
                console.error("Failed to approve task:", error)
                setItems(items) // Revert
                toast.error("Failed to approve task.")
            }
        } else if (type.startsWith('view-')) {
            const lastNote = task.notes && task.notes.length > 0 ? task.notes[task.notes.length - 1] : null;
            let existingReason = "";
            if (lastNote?.text) {
                // Extract reason after the prefix
                const prefix = type === 'view-reject' ? "REJECTION REASON: " : "CLIENT DOUBT: ";
                existingReason = lastNote.text.replace(prefix, "");
            }
            setActionTask(task)
            setActionType(type as any)
            setActionReason(existingReason)
        } else {
            setActionTask(task)
            setActionType(type)
            setActionReason("")
        }
    }

    const submitClientAction = async () => {
        if (!actionTask || !actionType || !project?.id) return

        if (!actionReason.trim()) {
            toast.error("Please provide a reason")
            return
        }

        const updatedItems = items.map(item => {
            if (item.id === actionTask.id) {
                const newNotes = [...(item.notes || [])]
                const timestamp = new Date().toISOString()
                const prefix = actionType === 'reject' ? "REJECTION REASON" : "CLIENT DOUBT"

                newNotes.push({
                    id: Date.now(),
                    text: `${prefix}: ${actionReason}`,
                    sender: user?.displayName || user?.email || "Client",
                    date: timestamp,
                    senderType: "client"
                })

                return {
                    ...item,
                    status: actionType === 'reject' ? 'In Progress' : item.status, // Reject sends back to In Progress
                    notes: newNotes
                }
            }
            return item
        })

        setItems(updatedItems)

        try {
            const fullMilestones = mergeIntoFullMilestones(updatedItems);
            const cleanItems = sanitizeForFirestore(fullMilestones);
            // If rejected, project status might change too
            const newProjectStatus = calculateProjectStatus(fullMilestones);

            await projectService.updateProject(project.id, {
                milestones: cleanItems,
                status: newProjectStatus
            });

            toast.success(actionType === 'reject' ? "Task rejected" : "Doubt shared")
        } catch (error) {
            console.error("Failed to submit action:", error)
            setItems(items) // Revert
            toast.error("Failed to submit action")
        } finally {
            setActionTask(null)
            setActionType(null)
            setActionReason("")
        }
    }


    if (loading) {
        return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    if (!project) {
        return (
            <div className="flex h-screen flex-col items-center justify-center gap-4">
                <p className="text-xl font-semibold">Project not found</p>
                <Button onClick={() => navigate('/tasks')}>Back to Projects</Button>
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6 min-h-screen">
            {/* Extracted Modals */}
            <ProjectModals
                isClearAllOpen={isClearAllOpen}
                setIsClearAllOpen={setIsClearAllOpen}
                onClearAll={handleClearAllTasks}
                isDeleteOpen={isDeleteOpen}
                setIsDeleteOpen={setIsDeleteOpen}
                onConfirmDelete={confirmDeleteTask}
                actionType={actionType}
                setActionType={setActionType}
                actionTask={actionTask}
                actionReason={actionReason}
                setActionReason={setActionReason}
                onSubmitClientAction={submitClientAction}
            />

            {/* Resources Sheet - kept inline since it uses many local state setters */}
            <Sheet open={isResourcesSheetOpen} onOpenChange={setIsResourcesSheetOpen}>
                <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto p-0 border-none shadow-2xl">
                    <SheetHeader className="p-8 border-b">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                {resourceSheetView !== 'list' && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setResourceSheetView('list')}
                                        className="h-10 w-10 rounded-full -ml-2"
                                    >
                                        <ArrowLeft className="h-5 w-5" />
                                    </Button>
                                )}
                                <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center">
                                    <FileText className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <SheetTitle className="text-2xl font-bold tracking-tight text-slate-900">
                                        {resourceSheetView === 'list' && "Project Resources"}
                                        {resourceSheetView === 'add' && "Add Resource"}
                                        {resourceSheetView === 'detail' && "Resource Detail"}
                                    </SheetTitle>
                                    <SheetDescription className="text-slate-500 font-medium">
                                        {resourceSheetView === 'list' && "Key items and shared documentation."}
                                        {resourceSheetView === 'add' && "Share a new requirement or file."}
                                        {resourceSheetView === 'detail' && `Created by ${selectedResource?.createdBy}`}
                                    </SheetDescription>
                                </div>
                            </div>
                            {resourceSheetView === 'list' && !isClient && (
                                <Button
                                    onClick={() => setResourceSheetView('add')}
                                    className="h-10 w-10 rounded-xl bg-primary text-white shadow-lg shadow-primary/20 p-0"
                                >
                                    <Plus className="h-5 w-5" />
                                </Button>
                            )}
                        </div>
                    </SheetHeader>

                    <div className="p-8">
                        {resourceSheetView === 'add' && (
                            <div className="space-y-8 animate-in slide-in-from-right duration-300">
                                <Tabs defaultValue="text" onValueChange={(v: any) => setResourceType(v)} className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 p-1 bg-slate-100/50 rounded-xl h-11 border border-slate-200">
                                        <TabsTrigger value="text" className="rounded-lg font-bold text-[10px] uppercase tracking-wider">Text / Requirements</TabsTrigger>
                                        <TabsTrigger value="file" className="rounded-lg font-bold text-[10px] uppercase tracking-wider">File Attachment</TabsTrigger>
                                    </TabsList>

                                    <div className="mt-8 space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-[11px] font-bold uppercase text-slate-500 pl-1">Resource Title</Label>
                                            <Input
                                                placeholder="e.g. Design Specs, API Keys..."
                                                value={resourceTitle}
                                                onChange={(e) => setResourceTitle(e.target.value)}
                                                className="h-12 rounded-xl border-slate-200 focus-visible:ring-primary bg-slate-50/50"
                                            />
                                        </div>

                                        {resourceType === 'text' ? (
                                            <div className="space-y-2">
                                                <Label className="text-[11px] font-bold uppercase text-slate-500 pl-1">Content</Label>
                                                <Textarea
                                                    placeholder="Enter requirements or notes..."
                                                    value={resourceContent}
                                                    onChange={(e) => setResourceContent(e.target.value)}
                                                    className="min-h-[220px] rounded-xl border-slate-200 focus-visible:ring-primary bg-slate-50/50 pt-3 text-sm leading-relaxed"
                                                />
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <Label className="text-[11px] font-bold uppercase text-slate-500 pl-1">Document</Label>
                                                <div className={cn(
                                                    "relative h-48 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center gap-3 bg-slate-50/50",
                                                    resourceFile ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/20"
                                                )}>
                                                    {resourceFile ? (
                                                        <>
                                                            <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center border border-primary/20">
                                                                <Check className="h-6 w-6 text-primary" />
                                                            </div>
                                                            <span className="text-sm font-bold truncate max-w-[250px]">{resourceFile.name}</span>
                                                            <Button variant="ghost" size="sm" onClick={() => setResourceFile(null)} className="text-[10px] font-black uppercase text-red-500 hover:bg-red-50 hover:text-red-700">Remove File</Button>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center shadow-inner">
                                                                <Upload className="h-6 w-6 text-slate-400" />
                                                            </div>
                                                            <div className="text-center">
                                                                <span className="text-sm font-bold text-slate-500 block">Click to upload file</span>
                                                                <span className="text-[11px] text-slate-400">PDF, PNG, JPG, ZIP (Max 10MB)</span>
                                                            </div>
                                                            <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => setResourceFile(e.target.files?.[0] || null)} />
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="pt-4 flex gap-3">
                                            <Button
                                                variant="ghost"
                                                onClick={() => setResourceSheetView('list')}
                                                className="flex-1 h-12 rounded-xl font-bold text-slate-500 hover:bg-slate-50"
                                            >
                                                Cancel
                                            </Button>
                                            <Button
                                                onClick={handleAddResource}
                                                disabled={isSavingResource || !resourceTitle.trim() || (resourceType === 'file' && !resourceFile) || (resourceType === 'text' && !resourceContent.trim())}
                                                className="flex-[2] h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl shadow-lg shadow-primary/20"
                                            >
                                                {isSavingResource ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Share Resource</>}
                                            </Button>
                                        </div>
                                    </div>
                                </Tabs>
                            </div>
                        )}

                        {resourceSheetView === 'list' && (
                            <section className="space-y-6 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Shared Assets ({project.resources?.length || 0})</Label>
                                </div>

                                <div className="space-y-3">
                                    {project.resources?.map(resource => (
                                        <div
                                            key={resource.id}
                                            onClick={() => { setSelectedResource(resource); setResourceSheetView('detail'); }}
                                            className="group p-4 rounded-xl border bg-white hover:border-primary/30 hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4"
                                        >
                                            <div className="flex items-center gap-4 min-w-0">
                                                <div className={cn(
                                                    "h-10 w-10 rounded-lg flex items-center justify-center shrink-0 border bg-white shadow-sm",
                                                    resource.type === 'file' ? "text-primary border-primary/10" : "text-blue-500 border-blue-100"
                                                )}>
                                                    {resource.type === 'file' ? <Paperclip className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-bold text-sm text-slate-900 truncate leading-none">{resource.title}</h4>
                                                    <p className="text-[10px] text-slate-500 mt-2 font-medium flex items-center gap-1.5">
                                                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                                                        {resource.createdBy} • {format(new Date(resource.createdAt), 'MMM d')}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <ArrowLeft className="h-4 w-4 text-slate-300 rotate-180 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                            </div>
                                        </div>
                                    ))}
                                    {(!project.resources || project.resources.length === 0) && (
                                        <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-100">
                                            <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center text-slate-200 border shadow-sm">
                                                <Paperclip className="h-8 w-8" />
                                            </div>
                                            <div>
                                                <p className="text-base font-bold text-slate-400">No project resources</p>
                                                <p className="text-xs font-medium text-slate-300 max-w-[220px] mx-auto mt-1 leading-relaxed">
                                                    Add project requirements, wireframes, or credentials for the team.
                                                </p>
                                            </div>
                                            {!isClient && (
                                                <Button
                                                    variant="outline"
                                                    onClick={() => setResourceSheetView('add')}
                                                    className="rounded-full border-slate-200 font-bold px-6 h-10 hover:bg-white"
                                                >
                                                    <Plus className="h-4 w-4 mr-2" /> Share First Resource
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </section>
                        )}

                        {resourceSheetView === 'detail' && selectedResource && (
                            <div className="space-y-8 animate-in slide-in-from-left duration-300">
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "h-10 w-10 rounded-xl flex items-center justify-center border",
                                                selectedResource.type === 'file' ? "bg-primary/5 text-primary border-primary/10" : "bg-blue-50 text-blue-500 border-blue-100"
                                            )}>
                                                {selectedResource.type === 'file' ? <Paperclip className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-900 leading-none">{selectedResource.title}</h3>
                                                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                                                    {selectedResource.type} Asset
                                                </p>
                                            </div>
                                        </div>
                                        {!isClient && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    handleDeleteResource(selectedResource.id);
                                                    setResourceSheetView('list');
                                                }}
                                                className="h-10 w-10 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl"
                                            >
                                                <Trash2 className="h-5 w-5" />
                                            </Button>
                                        )}
                                    </div>

                                    <div className="p-6 rounded-2xl border bg-slate-50/50 space-y-4 shadow-inner">
                                        {selectedResource.type === 'text' ? (
                                            <p className="text-sm text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                                                {selectedResource.content}
                                            </p>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-6 gap-6">
                                                <div className="h-20 w-20 bg-white rounded-3xl flex items-center justify-center border shadow-sm relative group/file transition-transform hover:scale-105">
                                                    <FileText className="h-10 w-10 text-primary" />
                                                    <div className="absolute inset-0 bg-primary/5 rounded-3xl opacity-0 group-hover/file:opacity-100 transition-opacity" />
                                                </div>
                                                <div className="text-center">
                                                    <p className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1">{selectedResource.fileName || "Project Document"}</p>
                                                    <p className="text-xs text-slate-500">Resource is ready for download</p>
                                                </div>
                                                <Button asChild className="w-full h-12 bg-primary hover:bg-primary/90 rounded-xl font-bold shadow-lg shadow-primary/10">
                                                    <a href={selectedResource.content} target="_blank" rel="noopener noreferrer">
                                                        <Upload className="h-4 w-4 mr-2 rotate-180" />
                                                        Download Resource
                                                    </a>
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="pt-6 border-t flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-slate-400">
                                        <div className="flex items-center gap-2">
                                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                            <span>Shared By {selectedResource.createdBy}</span>
                                        </div>
                                        <span>{format(new Date(selectedResource.createdAt), 'MMM d, yyyy • h:mm a')}</span>
                                    </div>
                                </div>

                                <Button
                                    variant="outline"
                                    onClick={() => setResourceSheetView('list')}
                                    className="w-full h-12 rounded-xl font-bold border-slate-200 text-slate-600 hover:bg-slate-50"
                                >
                                    Back to Resources
                                </Button>
                            </div>
                        )}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Page Header */}
            <div className="flex items-center justify-between space-y-2 mb-8 pb-6">
                <div className="flex items-center gap-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full hover:bg-slate-100 h-10 w-10">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 border bg-white rounded-lg shadow-sm">
                            <AvatarImage src={project.logo} />
                            <AvatarFallback className="rounded-lg bg-primary/10 text-primary font-bold">
                                {project.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{project.name}</h1>
                            <p className="text-sm text-muted-foreground font-medium">Project Tracker & Timeline • {project.client}</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="px-3 py-1 border-slate-200 text-slate-600 font-medium">
                        {project.team?.length || 0} Team Members
                    </Badge>
                    {project.category && (
                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 px-3 py-1.5 font-bold uppercase tracking-wider text-[10px]">
                            {project.category}
                        </Badge>
                    )}
                    <Badge className="bg-primary text-primary-foreground shadow-sm px-4 py-1.5 font-bold uppercase tracking-wider text-[10px]">
                        {project.status}
                    </Badge>
                </div>
            </div>

            {/* Development Timeline Section */}
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    {project.category === "Digital Marketing" ? (
                        <div className="flex">
                            <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-[450px]">
                                <TabsList className="grid w-full grid-cols-2 p-1 bg-slate-100/50 rounded-xl h-12 border border-slate-200">
                                    <TabsTrigger value="marketing" className="rounded-lg font-bold text-[11px] uppercase tracking-wider">Marketing Calendar</TabsTrigger>
                                    <TabsTrigger value="more" className="rounded-lg font-bold text-[11px] uppercase tracking-wider">Additional Tasks</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    ) : (
                        <div></div>
                    )}

                    {project.category === "Digital Marketing" && activeTab === 'marketing' && (
                        <div className="flex-1 flex justify-center">
                            <div className="flex items-center gap-3">
                                {/* Month Selector */}
                                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 shadow-sm">
                                    <Button variant="ghost" size="icon" onClick={() => setViewDate(subMonths(viewDate, 1))} className="h-8 w-8 rounded-lg hover:bg-white hover:text-slate-900 hover:shadow-sm text-slate-500 transition-all">
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-700 w-36 text-center select-none flex items-center justify-center gap-2">
                                        <Calendar className="w-3.5 h-3.5 text-primary" />
                                        {selectedMonth}
                                    </span>
                                    <Button variant="ghost" size="icon" onClick={() => setViewDate(addMonths(viewDate, 1))} className="h-8 w-8 rounded-lg hover:bg-white hover:text-slate-900 hover:shadow-sm text-slate-500 transition-all">
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                                {/* Week Selector */}
                                <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                                    {['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((week) => (
                                        <button
                                            key={week}
                                            onClick={() => setSelectedWeek(week)}
                                            className={cn(
                                                "px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all whitespace-nowrap",
                                                selectedWeek === week
                                                    ? "bg-blue-600 text-white shadow-sm"
                                                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                                            )}
                                        >
                                            {week.replace('Week ', 'W')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-4">
                        {project.category !== "Digital Marketing" && (
                            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                                {["All", "In Progress", "Completed", "Pending", "Delivered"].map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => setStatusFilter(status)}
                                        className={cn(
                                            "px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all",
                                            statusFilter === status
                                                ? "bg-white text-primary shadow-sm"
                                                : "text-slate-400 hover:text-slate-600"
                                        )}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                        )}

                        {!isAdmin && !isClient && (
                            <button
                                onClick={() => setShowMyTasks(!showMyTasks)}
                                className={cn(
                                    "flex items-center gap-2 px-4 py-2 h-10 text-[10px] font-black uppercase tracking-wider rounded-xl border transition-all shadow-sm",
                                    showMyTasks
                                        ? "bg-primary text-white border-primary ring-2 ring-primary/20"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                                )}
                            >
                                <Users className={cn("h-3.5 w-3.5", showMyTasks ? "fill-white/20" : "")} />
                                {showMyTasks ? "My Tasks" : "All Tasks"}
                            </button>
                        )}
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={() => setIsResourcesSheetOpen(true)}
                                variant="outline"
                                className="h-10 px-4 rounded-xl border-slate-200 hover:bg-slate-50 transition-all font-bold group"
                            >
                                <FileText className="h-4 w-4 mr-2 text-slate-400 group-hover:text-primary transition-colors" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Resources</span>
                            </Button>
                            <Button
                                onClick={() => navigate(-1)}
                                className="bg-muted hover:bg-muted/80 text-foreground font-bold px-4 py-2 h-10 rounded-xl"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Back
                            </Button>
                            {project.category !== "Digital Marketing" && !isClient && (
                                <Button
                                    onClick={() => setIsAIOpen(true)}
                                    className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold px-4 py-2 h-10 rounded-xl"
                                >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    AI Magic Add
                                </Button>
                            )}

                            {project.category === "Digital Marketing" && !isClient && (
                                <Button
                                    onClick={() => setIsTemplateManagerOpen(true)}
                                    className="bg-primary text-white font-bold px-4 py-2 h-10 rounded-xl hover:bg-primary/90"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Tasks
                                </Button>
                            )}

                            {!isClient && isAdmin && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setIsClearAllOpen(true)}
                                    className="h-10 w-10 p-0 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                    title="Clear All Tasks"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
                <div className="space-y-12">
                    {(project.category !== "Digital Marketing" || activeTab === 'marketing') && (
                    <div className="overflow-visible">
                    <Table>
                        <TableHeader className="bg-gray-50">
                            {project.category === "Digital Marketing" ? (
                                <TableRow>
                                    <TableHead className="w-[120px] py-3 whitespace-nowrap text-xs font-bold uppercase tracking-wider text-slate-500">Platform</TableHead>
                                    <TableHead className="w-[150px] py-3 whitespace-nowrap text-xs font-bold uppercase tracking-wider text-slate-500">Post ID/Link</TableHead>
                                    <TableHead className="py-3 min-w-[200px] whitespace-nowrap text-xs font-bold uppercase tracking-wider text-slate-500">Content Title</TableHead>
                                    <TableHead className="w-[110px] py-3 whitespace-nowrap text-center text-xs font-bold uppercase tracking-wider text-slate-500">Type</TableHead>
                                    <TableHead className="w-[120px] py-3 whitespace-nowrap text-center text-xs font-bold uppercase tracking-wider text-slate-500">Scheduled</TableHead>
                                                <TableHead className="w-[120px] py-3 whitespace-nowrap text-center text-xs font-bold uppercase tracking-wider text-slate-500">Actual</TableHead>
                                    <TableHead className="w-[130px] py-3 whitespace-nowrap text-center text-xs font-bold uppercase tracking-wider text-slate-500">Status</TableHead>
                                    <TableHead className="w-[140px] py-3 whitespace-nowrap text-center text-xs font-bold uppercase tracking-wider text-slate-500">Responsible</TableHead>
                                    <TableHead className="w-[130px] py-3 whitespace-nowrap text-center text-xs font-bold uppercase tracking-wider text-slate-500">Approval</TableHead>
                                    <TableHead className="w-[130px] py-3 whitespace-nowrap text-center text-xs font-bold uppercase tracking-wider text-slate-500">Design</TableHead>
                                    <TableHead className="w-[150px] py-3 whitespace-nowrap text-center text-xs font-bold uppercase tracking-wider text-slate-500">Files</TableHead>
                                    <TableHead className="py-3 min-w-[150px] whitespace-nowrap text-xs font-bold uppercase tracking-wider text-slate-500">Remarks</TableHead>
                                    <TableHead className="w-[100px] py-3 text-center whitespace-nowrap text-xs font-bold uppercase tracking-wider text-slate-500">Delivered</TableHead>
                                    <TableHead className="w-16 py-3"></TableHead>
                                </TableRow>
                            ) : (
                                <TableRow>
                                    <TableHead className="w-[80px] py-3 text-center">
                                        <div className="flex items-center justify-center gap-1 text-slate-400">
                                            <Flame className="h-3.5 w-3.5" />
                                            <Zap className="h-3.5 w-3.5" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-[140px] py-3">Status</TableHead>
                                    {!isClient && <TableHead className="w-[80px] py-3 text-center">Test</TableHead>}
                                    <TableHead className="py-3">Task Details</TableHead>
                                    <TableHead className="w-[150px] py-3 text-right">Date</TableHead>
                                    {!isClient && (
                                        <TableHead className="w-[150px] py-3">Assignee</TableHead>
                                    )}
                                    <TableHead className="w-[120px] py-3 text-center">
                                        <div className="flex items-center justify-center gap-2 group/activity">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover/activity:text-slate-600 transition-colors">Activity</span>
                                            {!isClient && (
                                                <div className="flex items-center gap-0.5 bg-slate-100/50 rounded-full px-1 py-0.5 opacity-0 group-hover/activity:opacity-100 transition-all border border-slate-200/50">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => { e.stopPropagation(); setResourceSheetView('add'); setIsResourcesSheetOpen(true); }}
                                                        className="h-5 w-5 rounded-full text-slate-400 hover:text-primary hover:bg-white shadow-sm"
                                                        title="Quick Add Resource"
                                                    >
                                                        <Plus className="h-2.5 w-2.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={(e) => { e.stopPropagation(); setResourceSheetView('list'); setIsResourcesSheetOpen(true); }}
                                                        className="h-5 w-5 rounded-full text-slate-400 hover:text-primary hover:bg-white shadow-sm"
                                                        title="View All Resources"
                                                    >
                                                        <FileText className="h-2.5 w-2.5" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-[100px] py-3 text-center whitespace-nowrap text-xs font-bold uppercase tracking-wider text-slate-500">Delivered</TableHead>
                                    <TableHead className="w-16 py-3"></TableHead>
                                </TableRow>
                            )}
                        </TableHeader>
                        <TableBody>
                            {/* ClickUp-style Inline Add Task Row */}
                            {!isClient && project.category !== "Digital Marketing" && (
                                <TableRow className="hover:bg-muted/50 transition-all group border-b-2 border-slate-50">
                                    <TableCell className="text-center py-4"></TableCell>
                                    <TableCell className="text-center py-4"></TableCell>
                                    {!isClient && <TableCell className="text-center py-4"></TableCell>}
                                    <TableCell className="py-4" colSpan={!isClient ? 2 : 1}>
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "h-6 w-6 rounded-lg flex items-center justify-center border-2 border-dashed transition-all shrink-0",
                                                newTaskName ? "border-primary bg-primary/5 scale-110" : "border-slate-200 group-hover:border-slate-300"
                                            )}>
                                                <Plus className={cn("h-3 w-3", newTaskName ? "text-primary" : "text-slate-300")} />
                                            </div>
                                            <Input
                                                placeholder="Press Enter to quick-add a task..."
                                                value={newTaskName}
                                                onChange={(e) => setNewTaskName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault()
                                                        handleAddTask()
                                                    }
                                                }}
                                                className="border-none bg-transparent shadow-none focus-visible:ring-0 p-0 text-sm font-bold text-slate-600 placeholder:text-slate-300 h-6 w-full"
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-6 py-4" colSpan={3}>
                                        {/* Activity column space */}
                                    </TableCell>
                                </TableRow>
                            )}

                            {project.category === "Digital Marketing" ? (
                                <>
                                    {(() => {
                                        const week = selectedWeek;
                                        const weekItems = items.filter(item => {
                                            // Keep marketing tasks only
                                            if (!isMarketingTask(item)) return false;

                                            const itemMonth = item.monthYear || format(new Date(), 'MMMM yyyy');
                                            if (itemMonth !== selectedMonth) return false;

                                            if (item.week) return item.week === week;

                                            if (!item.date) return week === 'Week 1';
                                            let d = parseISO(item.date);
                                            if (!isValid(d)) d = new Date(item.date);
                                            if (!isValid(d)) return week === 'Week 1';
                                            const dateNum = d.getDate();
                                            if (dateNum <= 7) return week === 'Week 1';
                                            if (dateNum <= 14) return week === 'Week 2';
                                            if (dateNum <= 21) return week === 'Week 3';
                                            return week === 'Week 4';
                                        });

                                        return (
                                            <React.Fragment key={week}>
                                                <TableRow className="bg-transparent hover:bg-slate-50/50 group/week border-none">
                                                    <TableCell colSpan={isClient ? 11 : 14} className="pt-6 pb-4 px-6 border-none">
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-bold text-blue-800 text-xs uppercase tracking-widest">{week}</span>
                                                            <Badge variant="secondary" className="bg-blue-50 text-blue-600 border-none text-[10px] font-bold px-2 py-0 h-5">
                                                                {weekItems.length} post{weekItems.length !== 1 ? 's' : ''}
                                                            </Badge>
                                                            <div className="h-[1px] flex-1 bg-slate-100" />
                                                            {!isClient && (
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="h-6 w-6 rounded-lg bg-blue-50 text-blue-600 opacity-0 group-hover/week:opacity-100 transition-all hover:bg-blue-600 hover:text-white"
                                                                    onClick={() => {
                                                                        setQuickPostWeek(week);
                                                                        setQuickPostTargetItem(null);
                                                                        setIsQuickPostOpen(true);
                                                                    }}
                                                                >
                                                                    <Plus className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                                {weekItems.map(item => (
                                                    <DigitalMarketingRow
                                                        key={item.id}
                                                        item={item}
                                                        onUpdateTask={handleTaskUpdate}
                                                        handleDeleteClick={handleDeleteClick}
                                                        setIsSheetOpen={setIsSheetOpen}
                                                        setSelectedTask={setSelectedTask}
                                                        employees={employees}
                                                        setIsQuickPostOpen={setIsQuickPostOpen}
                                                        setQuickPostWeek={setQuickPostWeek}
                                                        setQuickPostTargetItem={setQuickPostTargetItem}
                                                        setIsAIGenOpen={setIsAIGenOpen}
                                                        setAiGenTargetItem={setAiGenTargetItem}
                                                    />
                                                ))}
                                                {weekItems.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={isClient ? 11 : 14} className="py-16 px-6 text-center border-b border-slate-50">
                                                            <div className="flex flex-col items-center gap-3">
                                                                <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                                                                    <Calendar className="h-6 w-6" />
                                                                </div>
                                                                <span className="text-slate-400 text-xs font-medium">No posts scheduled for {week}</span>
                                                                {!isClient && (
                                                                    <Button 
                                                                        variant="outline" 
                                                                        size="sm" 
                                                                        className="h-8 border-dashed border-slate-200 text-[10px] font-bold uppercase tracking-widest hover:border-blue-300 hover:text-blue-600 rounded-lg mt-1"
                                                                        onClick={() => {
                                                                            setQuickPostWeek(week);
                                                                            setQuickPostTargetItem(null);
                                                                            setIsQuickPostOpen(true);
                                                                        }}
                                                                    >
                                                                        <Plus className="h-3 w-3 mr-1.5" />
                                                                        Add Post
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        );
                                    })()}
                                </>
                            ) : (
                                items.map((item, index) => {
                                    const prevItem = items[index - 1];
                                    const showDateHeader = (!prevItem || prevItem.date !== item.date);

                                    const formatDateHeader = (dateStr: string) => {
                                        if (!dateStr) return "Untracked Date";
                                        try {
                                            const date = parseISO(dateStr);
                                            if (isValid(date)) return format(date, 'EEEE, MMMM do, yyyy');
                                            const fallbackDate = new Date(dateStr);
                                            if (isValid(fallbackDate)) return format(fallbackDate, 'EEEE, MMMM do, yyyy');
                                            return dateStr;
                                        } catch (e) {
                                            return dateStr;
                                        }
                                    };

                                    const totalCols = (!isClient ? 9 : 7);

                                    return (
                                        <React.Fragment key={`group-${item.id}`}>
                                            {showDateHeader && (
                                                <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-y border-slate-100">
                                                    <TableCell colSpan={totalCols} className="py-2.5 px-6">
                                                        <div className="flex items-center gap-3">
                                                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                                                                {formatDateHeader(item.date)}
                                                            </span>
                                                            <div className="h-[1px] flex-1 bg-slate-200/60" />
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                            <TaskRow
                                                key={item.id}
                                                item={item}
                                                handleStatusChange={handleStatusChange}
                                                handlePriorityToggle={handlePriorityToggle}
                                                handleFeatureToggle={handleFeatureToggle}
                                                handleDeleteClick={handleDeleteClick}
                                                setIsSheetOpen={setIsSheetOpen}
                                                setSelectedTask={setSelectedTask}
                                                onClientAction={handleClientActionClick}
                                                currentEmployee={currentEmployee}
                                                onUpdateTask={handleTaskUpdate}
                                                handleTagClick={handleTagClick}
                                                handleHideToggle={handleHideToggle}
                                                onAddSubtaskClick={() => {
                                                    setExpandedTasks(prev => new Set(prev).add(item.id));
                                                    setActiveSubtaskParentId(item.id);
                                                    setNewSubtaskName("");
                                                }}
                                                isExpanded={expandedTasks.has(item.id)}
                                                onToggleExpand={() => toggleExpand(item.id)}
                                            />

                                            {/* Existing Subtasks */}
                                            {expandedTasks.has(item.id) && item.subtasks?.map((st: any) => (
                                                <TableRow key={st.id} className="group/subtask hover:bg-slate-50/40 border-none">
                                                    <TableCell className="w-[80px] py-1"></TableCell>
                                                    <TableCell className="w-[140px] py-1 text-center">
                                                        <div className="flex items-center justify-center relative h-full">
                                                            {/* Vertical line from parent */}
                                                            <div className="absolute left-1/2 -top-1 w-[1px] h-full bg-slate-200 -translate-x-1/2" />

                                                            {/* L-shaped connection */}
                                                            <div className="absolute left-1/2 top-1/2 w-4 h-[1px] bg-slate-200" />

                                                            <div
                                                                onClick={(e) => { e.stopPropagation(); handleToggleSubtaskInline(item.id, st.id); }}
                                                                className={cn(
                                                                    "h-4 w-4 rounded-md border flex items-center justify-center transition-all cursor-pointer z-10",
                                                                    st.completed
                                                                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                                                        : 'bg-white border-slate-300 hover:border-emerald-400 shadow-sm'
                                                                )}
                                                            >
                                                                {st.completed && <Check className="h-2.5 w-2.5 stroke-[4px]" />}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    {!isClient && <TableCell className="w-[80px] py-1"></TableCell>}
                                                    <TableCell className="py-1" colSpan={4}>
                                                        <div className="flex items-center gap-2 group relative pl-3">
                                                            <span className={cn(
                                                                "text-[12px] font-medium leading-tight py-1 transition-colors flex-1",
                                                                st.completed ? "text-slate-400 line-through decoration-slate-300" : "text-slate-600"
                                                            )}>
                                                                {st.title}
                                                            </span>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-6 w-6 opacity-0 group-hover/subtask:opacity-100 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-all"
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteSubtaskInline(item.id, st.id); }}
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="w-[64px] py-1"></TableCell>
                                                </TableRow>
                                            ))}

                                            {expandedTasks.has(item.id) && activeSubtaskParentId === item.id && (
                                                <TableRow className="bg-slate-50/20 border-none">
                                                    <TableCell className="w-[80px] py-1"></TableCell>
                                                    <TableCell className="w-[140px] py-1 text-center">
                                                        <div className="flex items-center justify-center relative h-full">
                                                            <div className="absolute left-1/2 -top-1 w-[1px] h-full bg-slate-200 -translate-x-1/2" />
                                                            <div className="absolute left-1/2 top-1/2 w-4 h-[1px] bg-slate-200" />

                                                            <div className="h-4 w-4 rounded-md border border-primary/30 border-dashed bg-primary/5 flex items-center justify-center z-10">
                                                                <Plus className="h-2.5 w-2.5 text-primary/40" />
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    {!isClient && <TableCell className="w-[80px] py-1"></TableCell>}
                                                    <TableCell className="py-1" colSpan={4}>
                                                        <div className="pl-3">
                                                            <Input
                                                                placeholder="Add subtask..."
                                                                value={newSubtaskName}
                                                                onChange={(e) => setNewSubtaskName(e.target.value)}
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' && newSubtaskName.trim()) {
                                                                        e.preventDefault();
                                                                        handleAddSubtaskInline(item.id);
                                                                    }
                                                                    if (e.key === 'Escape') {
                                                                        setActiveSubtaskParentId(null);
                                                                        setNewSubtaskName("");
                                                                    }
                                                                }}
                                                                className="h-7 text-[12px] border-none bg-transparent shadow-none focus-visible:ring-0 p-0 font-medium text-primary placeholder:text-slate-300 w-full"
                                                            />
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="w-[64px] py-1"></TableCell>
                                                </TableRow>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                    </div>
                    )}

                    {/* Additional Tasks Section for Digital Marketing */}
                    {project.category === "Digital Marketing" && activeTab === 'more' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold tracking-tight text-slate-900">More Tasks</h2>
                                    <p className="text-sm text-muted-foreground">General tasks, additional requirements or management items.</p>
                                </div>
                            </div>
                            <div className="overflow-visible">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="w-[80px] py-3 text-center">
                                                <div className="flex items-center justify-center gap-1 text-slate-400">
                                                    <Flame className="h-3.5 w-3.5" />
                                                    <Zap className="h-3.5 w-3.5" />
                                                </div>
                                            </TableHead>
                                            <TableHead className="w-[140px] py-3">Status</TableHead>
                                            {!isClient && <TableHead className="w-[80px] py-3 text-center">Test</TableHead>}
                                            <TableHead className="py-3">Task Details</TableHead>
                                            <TableHead className="w-[150px] py-3 text-right">Date</TableHead>
                                            {!isClient && (
                                                <TableHead className="w-[150px] py-3">Assignee</TableHead>
                                            )}
                                            <TableHead className="w-[120px] py-3 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Activity</span>
                                                </div>
                                            </TableHead>
                                            <TableHead className="w-[100px] py-3 text-center whitespace-nowrap text-xs font-bold uppercase tracking-wider text-slate-500">Delivered</TableHead>
                                            <TableHead className="w-16 py-3"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {/* Manual Add Row for Additional Tasks */}
                                        {!isClient && (
                                            <TableRow className="hover:bg-muted/50 transition-all group border-b-2 border-slate-50">
                                                <TableCell className="text-center py-4"></TableCell>
                                                <TableCell className="text-center py-4"></TableCell>
                                                {!isClient && <TableCell className="text-center py-4"></TableCell>}
                                                <TableCell className="py-4" colSpan={!isClient ? 2 : 1}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={cn(
                                                            "h-6 w-6 rounded-lg flex items-center justify-center border-2 border-dashed transition-all shrink-0",
                                                            newTaskName ? "border-primary bg-primary/5 scale-110" : "border-slate-200 group-hover:border-slate-300"
                                                        )}>
                                                            <Plus className={cn("h-3 w-3", newTaskName ? "text-primary" : "text-slate-300")} />
                                                        </div>
                                                        <Input
                                                            id="more-tasks-input"
                                                            placeholder="Click to add manual task..."
                                                            value={newTaskName}
                                                            onChange={(e) => setNewTaskName(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                                    e.preventDefault()
                                                                    handleAddTask()
                                                                }
                                                            }}
                                                            className="border-none bg-transparent shadow-none focus-visible:ring-0 p-0 text-sm font-bold text-slate-600 placeholder:text-slate-300 h-6 w-full"
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-6 py-4" colSpan={3}></TableCell>
                                            </TableRow>
                                        )}

                                        {/* Render Non-Marketing Tasks */}
                                        {items.filter(item => !isMarketingTask(item)).length > 0 ? (
                                            items.filter(item => !isMarketingTask(item)).map((item, index) => {
                                                const otherItems = items.filter(i => !isMarketingTask(i));
                                                const prevItem = otherItems[index - 1];
                                                const showDateHeader = (!prevItem || prevItem.date !== item.date);

                                                const formatDateHeader = (dateStr: string) => {
                                                    if (!dateStr) return "Additional Tasks";
                                                    try {
                                                        const date = parseISO(dateStr);
                                                        if (isValid(date)) return format(date, 'EEEE, MMMM do, yyyy');
                                                        return dateStr;
                                                    } catch (e) { return dateStr; }
                                                };

                                                return (
                                                    <React.Fragment key={item.id}>
                                                        {showDateHeader && (
                                                            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-y border-slate-100">
                                                                <TableCell colSpan={!isClient ? 8 : 6} className="py-2.5 px-6">
                                                                    <div className="flex items-center gap-3">
                                                                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                                                        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                                                                            {formatDateHeader(item.date)}
                                                                        </span>
                                                                        <div className="h-[1px] flex-1 bg-slate-200/60" />
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        )}
                                                        <TaskRow
                                                            item={item}
                                                            handleStatusChange={handleStatusChange}
                                                            handlePriorityToggle={handlePriorityToggle}
                                                            handleFeatureToggle={handleFeatureToggle}
                                                            handleDeleteClick={handleDeleteClick}
                                                            setIsSheetOpen={setIsSheetOpen}
                                                            setSelectedTask={setSelectedTask}
                                                            onClientAction={handleClientActionClick}
                                                            currentEmployee={currentEmployee}
                                                            onUpdateTask={handleTaskUpdate}
                                                            handleTagClick={handleTagClick}
                                                            handleHideToggle={handleHideToggle}
                                                            onAddSubtaskClick={() => {
                                                                setExpandedTasks(prev => new Set(prev).add(item.id));
                                                                setActiveSubtaskParentId(item.id);
                                                                setNewSubtaskName("");
                                                            }}
                                                            isExpanded={expandedTasks.has(item.id)}
                                                            onToggleExpand={() => toggleExpand(item.id)}
                                                        />
                                                    </React.Fragment>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={!isClient ? 8 : 6} className="py-12 text-center text-slate-400 italic text-sm">
                                                    No additional manual tasks added yet.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <TaskDetailsSheet
                isOpen={isSheetOpen}
                onClose={() => setIsSheetOpen(false)}
                task={selectedTask}
                project={project}
                onUpdateTask={handleTaskUpdate}
                onDeleteTask={handleDeleteClick}
                readOnly={project.category === "Digital Marketing" ? false : isClient || (!isAdmin && selectedTask && !(() => {
                    const assignees = Array.isArray(selectedTask.assignedTo) ? selectedTask.assignedTo : (selectedTask.assignedTo ? [selectedTask.assignedTo] : []);
                    return assignees.some((a: any) => (typeof a === 'string' ? a : a.name) === currentEmployee?.name);
                })())}
            />

            <QuickTagSheet
                open={isTagOpen}
                onOpenChange={setIsTagOpen}
                task={tagTask}
                project={project}
                currentUser={user}
            />

            {
                project && (
                    <>
                        <AITaskExtractor
                            open={isAIOpen}
                            onOpenChange={setIsAIOpen}
                            projectId={project.id as string}
                            currentMilestones={project.milestones || []}
                            currentEmployee={currentEmployee}
                        />
                        <TemplateTasksSheet
                            open={isTemplateManagerOpen}
                            onOpenChange={setIsTemplateManagerOpen}
                            project={project}
                            targetMonth={selectedMonth}
                        />
                        <QuickPostSheet
                            open={isQuickPostOpen}
                            onOpenChange={setIsQuickPostOpen}
                            project={project}
                            week={quickPostWeek}
                            month={selectedMonth}
                            targetItem={quickPostTargetItem}
                        />
                        <AIPostGeneratorSheet 
                            open={isAIGenOpen}
                            onOpenChange={setIsAIGenOpen}
                            project={project}
                            targetItem={aiGenTargetItem}
                            onUpdateTask={handleTaskUpdate}
                        />
                    </>
                )
            }
        </div >
    )
}

import { useState, useRef, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
    Paperclip,
    Send,
    UserPlus,
    FileText,
    Trash2,
    Clock,
    CheckCircle2,
    Loader2,
    MessageSquare,
    Users,
    Search,
    Sparkles,
    Check,
    Plus,
    Beaker,
    CheckCircle,
    XCircle,
    AlertCircle,
    X,
    Zap
} from "lucide-react"
import { format } from "date-fns"
import { useEmployees } from "src/hooks/useEmployees"
import { useAuth } from "src/contexts/AuthContext"
import { projectService } from "src/firebase/projectService"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface TaskDetailsSheetProps {
    isOpen: boolean
    onClose: () => void
    task: any
    project: any
    onUpdateTask: (updatedTask: any) => Promise<void>
    onDeleteTask?: (taskId: string) => Promise<void>
    readOnly?: boolean
}

export function TaskDetailsSheet({ isOpen, onClose, task, project, onUpdateTask, onDeleteTask, readOnly }: TaskDetailsSheetProps) {
    const { employees, loading: employeesLoading } = useEmployees()
    const { isAdmin, isEmployee } = useAuth()
    const [activeTab, setActiveTab] = useState("description")
    const [description, setDescription] = useState(task?.description || "") // Local state for description
    const [subtasks, setSubtasks] = useState(task?.subtasks || []) // Local state for subtasks
    const [testStatus, setTestStatus] = useState(task?.testStatus || "not_tested") // passed, failed, not_tested
    const [testNotes, setTestNotes] = useState(task?.testNotes || "")
    const [isGeneratingDescription, setIsGeneratingDescription] = useState(false)
    const [isGeneratingSubtasks, setIsGeneratingSubtasks] = useState(false)

    useEffect(() => {
        if (task) {
            setDescription(task.description || "")
            setSubtasks(task.subtasks || [])
            setTestStatus(task.testStatus || "not_tested")
            setTestNotes(task.testNotes || "")
        }
    }, [task])

    const [newMessage, setNewMessage] = useState("")
    const [searchQuery, setSearchQuery] = useState("")
    const [isUploading, setIsUploading] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const [isDraggingAttachments, setIsDraggingAttachments] = useState(false)
    const [previewImage, setPreviewImage] = useState<string | null>(null)

    // Scroll to bottom of chat when opening or changing tabs
    useEffect(() => {
        if (activeTab === "chat" && scrollAreaRef.current) {
            // timeout to allow render
            setTimeout(() => {
                const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
                if (scrollContainer) {
                    scrollContainer.scrollTop = scrollContainer.scrollHeight;
                }
            }, 100);
        }
    }, [activeTab, task?.notes, isOpen])

    // Paste support for attachments
    useEffect(() => {
        const handlePaste = async (e: ClipboardEvent) => {
            if (activeTab !== 'attachments') return;
            
            const items = e.clipboardData?.items;
            if (!items) return;

            const pastedFiles: File[] = [];
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image/') !== -1 || items[i].type.indexOf('video/') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) pastedFiles.push(file);
                }
            }

            if (pastedFiles.length > 0) {
                setIsUploading(true);
                try {
                    const newAttachments = [...(task.attachments || [])];
                    for (const file of pastedFiles) {
                        const downloadURL = await projectService.uploadProjectFile(project.id, file);
                        newAttachments.push({
                            id: Date.now().toString() + Math.random().toString(),
                            name: file.name || `pasted-image-${Date.now()}.png`,
                            type: file.type,
                            url: downloadURL,
                            createdAt: new Date().toISOString(),
                            size: file.size
                        });
                    }
                    await onUpdateTask({ ...task, attachments: newAttachments });
                    toast.success(`Uploaded ${pastedFiles.length} file(s) from clipboard`);
                } catch (error) {
                    toast.error("Failed to upload pasted file(s)");
                } finally {
                    setIsUploading(false);
                }
            }
        };

        if (isOpen && activeTab === 'attachments') {
            window.addEventListener('paste', handlePaste);
            return () => window.removeEventListener('paste', handlePaste);
        }
    }, [isOpen, activeTab, task, project.id, onUpdateTask]);

    if (!task) return null

    const handleSendMessage = async () => {
        if (!newMessage.trim()) return

        setIsSending(true)
        try {
            const newNote = {
                id: Date.now().toString(),
                text: newMessage.trim(),
                createdAt: new Date().toISOString(),
                sender: {
                    name: "Current User", // In a real app, get from auth context
                    avatar: "",
                }
            }

            const updatedNotes = [...(task.notes || []), newNote]
            const updatedTask = { ...task, notes: updatedNotes }

            await onUpdateTask(updatedTask)
            setNewMessage("")
        } catch (error) {
            toast.error("Failed to send message")
        } finally {
            setIsSending(false)
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setIsUploading(true)
        try {
            const newAttachments = [...(task.attachments || [])]

            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                const downloadURL = await projectService.uploadProjectFile(project.id, file)

                newAttachments.push({
                    id: Date.now().toString() + Math.random().toString(),
                    name: file.name,
                    type: file.type,
                    url: downloadURL,
                    createdAt: new Date().toISOString(),
                    size: file.size
                })
            }

            const updatedTask = { ...task, attachments: newAttachments }

            await onUpdateTask(updatedTask)
            toast.success(`${files.length} file(s) uploaded`)
        } catch (error) {
            console.error(error)
            toast.error("Failed to upload file(s)")
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }


    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDraggingAttachments(true)
    }

    const handleDragLeave = () => {
        setIsDraggingAttachments(false)
    }

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault()
        setIsDraggingAttachments(false)
        const files = e.dataTransfer.files
        if (!files || files.length === 0) return

        setIsUploading(true)
        try {
            const newAttachments = [...(task.attachments || [])]

            for (let i = 0; i < files.length; i++) {
                const file = files[i]
                const downloadURL = await projectService.uploadProjectFile(project.id, file)

                newAttachments.push({
                    id: Date.now().toString() + Math.random().toString(),
                    name: file.name,
                    type: file.type,
                    url: downloadURL,
                    createdAt: new Date().toISOString(),
                    size: file.size
                })
            }

            const updatedTask = { ...task, attachments: newAttachments }

            await onUpdateTask(updatedTask)
            toast.success(`${files.length} file(s) uploaded`)
        } catch (error) {
            console.error(error)
            toast.error("Failed to upload file(s)")
        } finally {
            setIsUploading(false)
        }
    }

    const handleDeleteAttachment = async (attachmentId: string, fileUrl: string) => {
        try {
            // Start deleting from storage
            await projectService.deleteProjectFile(fileUrl)

            // Update local state
            const updatedAttachments = task.attachments.filter((a: any) => a.id !== attachmentId)
            const updatedTask = { ...task, attachments: updatedAttachments }

            await onUpdateTask(updatedTask)
            toast.success("Attachment removed")
        } catch (error) {
            toast.error("Failed to remove attachment")
        }
    }

    const handleAssignMember = async (member: any) => {
        if (readOnly) return;
        try {
            // Normalize to array and filter out invalid/placeholder entries
            let currentAssignees = Array.isArray(task.assignedTo)
                ? [...task.assignedTo]
                : (task.assignedTo ? [task.assignedTo] : []);

            currentAssignees = currentAssignees.filter((m: any) => m && m.name !== 'Unassigned');

            const isAssigned = currentAssignees.some((m: any) => m.name === member.name);

            let updatedAssignees;
            if (isAssigned) {
                updatedAssignees = currentAssignees.filter((m: any) => m.name !== member.name);
            } else {
                updatedAssignees = [...currentAssignees, member];
            }

            const updatedTask = { ...task, assignedTo: updatedAssignees };
            await onUpdateTask(updatedTask);

            if (!isAssigned) {
                toast.success(`Assigned to ${member.name}`);
            } else {
                toast.success(`Removed ${member.name}`);
            }
        } catch (error) {
            toast.error("Failed to update assignment");
        }
    }

    const handleDeleteTask = async () => {
        if (onDeleteTask) {
            onDeleteTask(task.id);
        }
    }

    const filteredEmployees = employees.filter(emp =>
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.role?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // AI & Task Management Handlers
    const handleSaveDescription = async () => {
        if (description === task.description) return
        try {
            await onUpdateTask({ ...task, description })
            toast.success("Description updated")
        } catch (error) {
            toast.error("Failed to update description")
        }
    }

    const handleGenerateDescription = async () => {
        setIsGeneratingDescription(true)
        try {
            const result = await projectService.generateTaskDetails(task.task, description)
            if (result.success) {
                setDescription(result.description)
                // Auto-save the generated description
                await onUpdateTask({ ...task, description: result.description })
                toast.success("AI generated description!")
            }
        } catch (error) {
            toast.error("AI generation failed")
        } finally {
            setIsGeneratingDescription(false)
        }
    }

    const handleGenerateSubtasks = async () => {
        setIsGeneratingSubtasks(true)
        try {
            const result = await projectService.generateSubtasks(task.task, description)
            if (result.success) {
                const newSubtasks = result.subtasks.map((title: string) => ({
                    id: Date.now() + Math.random().toString(),
                    title,
                    completed: false,
                    createdAt: new Date().toISOString()
                }))
                const updatedSubtasks = [...subtasks, ...newSubtasks]
                setSubtasks(updatedSubtasks)
                await onUpdateTask({ ...task, subtasks: updatedSubtasks })
                toast.success(`Generated ${newSubtasks.length} subtasks!`)
            }
        } catch (error) {
            toast.error("AI subtask generation failed")
        } finally {
            setIsGeneratingSubtasks(false)
        }
    }

    const handleAddSubtask = async () => {
        const newSubtask = {
            id: Date.now().toString() + Math.random().toString(),
            title: "",
            completed: false,
            createdAt: new Date().toISOString()
        }
        const updatedSubtasks = [...subtasks, newSubtask]
        setSubtasks(updatedSubtasks)
    }

    const handleToggleSubtask = async (subtaskId: string) => {
        const updatedSubtasks = subtasks.map((st: any) =>
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
        )
        setSubtasks(updatedSubtasks)
        await onUpdateTask({ ...task, subtasks: updatedSubtasks })
    }

    const handleDeleteSubtask = async (subtaskId: string) => {
        const updatedSubtasks = subtasks.filter((st: any) => st.id !== subtaskId)
        setSubtasks(updatedSubtasks)
        await onUpdateTask({ ...task, subtasks: updatedSubtasks })
    }

    const handleUpdateSubtaskTitle = async (subtaskId: string, title: string) => {
        const updatedSubtasks = subtasks.map((st: any) =>
            st.id === subtaskId ? { ...st, title } : st
        )
        setSubtasks(updatedSubtasks)
    }

    const handleSaveSubtaskTitle = async (subtaskId: string, title: string) => {
        if (!title.trim()) {
            // Remove if empty
            const updatedSubtasks = subtasks.filter((st: any) => st.id !== subtaskId)
            setSubtasks(updatedSubtasks)
            await onUpdateTask({ ...task, subtasks: updatedSubtasks })
            return
        }
        const updatedSubtasks = subtasks.map((st: any) =>
            st.id === subtaskId ? { ...st, title: title.trim() } : st
        )
        setSubtasks(updatedSubtasks)
        await onUpdateTask({ ...task, subtasks: updatedSubtasks })
    }

    const handleUpdateTestStatus = async (status: string) => {
        setTestStatus(status)
        await onUpdateTask({ ...task, testStatus: status })
        if (status === 'passed') toast.success("Marked as Passed")
        if (status === 'failed') toast.error("Marked as Failed")
    }

    const handleSaveTestNotes = async () => {
        if (testNotes === task.testNotes) return
        await onUpdateTask({ ...task, testNotes })
        toast.success("Test notes saved")
    }

    const handleToggleNewFeature = async () => {
        if (readOnly) return;
        try {
            await onUpdateTask({ ...task, isNewFeature: !task.isNewFeature });
            toast.success(task.isNewFeature ? "Removed as New Feature" : "Marked as New Feature");
        } catch (error) {
            toast.error("Failed to update feature status");
        }
    }


    // Identify current user or use a placeholder if no auth context available yet
    // For now assuming we just show messages cleanly.

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-[90vw] sm:w-[50vw] sm:max-w-[50vw] flex flex-col p-0 gap-0 bg-white border-l shadow-2xl">
                {/* Header Section */}
                <div className="p-6 pb-4 border-b bg-slate-50/50">
                    <SheetHeader className="space-y-4">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <Badge
                                    variant={
                                        task.status === 'Completed' ? 'default' :
                                            task.status === 'In Progress' ? 'secondary' :
                                                task.status === 'Delivered' ? 'default' :
                                                    task.status === 'Pending' ? 'destructive' : 'outline'
                                    }
                                    className={cn("border-transparent font-semibold",
                                        task.status === 'Completed' && "bg-emerald-600 text-white hover:bg-emerald-700",
                                        task.status === 'In Progress' && "bg-yellow-500 text-white hover:bg-yellow-600",
                                        task.status === 'Delivered' && "bg-purple-600 text-white hover:bg-purple-700",
                                        (task.status === 'Pending' || !task.status) && "bg-red-600 text-white hover:bg-red-700"
                                    )}
                                >
                                    {task.status}
                                </Badge>
                                <div className="flex items-center gap-2">
                                    <SheetTitle className="text-xl font-bold text-slate-900 leading-tight">
                                        {task.task}
                                    </SheetTitle>
                                    {(isAdmin || isEmployee) && !readOnly && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleToggleNewFeature}
                                            className={cn(
                                                "h-7 px-2 rounded-full transition-all",
                                                task.isNewFeature
                                                    ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                                                    : "text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                                            )}
                                            title={task.isNewFeature ? "Remove New Feature" : "Mark as New Feature"}
                                        >
                                            <Zap className={cn("h-3.5 w-3.5 mr-1", task.isNewFeature && "fill-blue-700")} />
                                            <span className="text-[10px] font-bold uppercase tracking-wider">
                                                {task.isNewFeature ? "New Feature" : "Feature?"}
                                            </span>
                                        </Button>
                                    )}
                                </div>
                            </div>
                            {onDeleteTask && !readOnly && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleDeleteTask}
                                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                    title="Delete Task"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                            <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                Created {task.date}
                            </div>
                            {(() => {
                                const assignees = (Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo])
                                    .filter((m: any) => m && m.name !== 'Unassigned');

                                if (assignees.length === 0) return null;

                                return (
                                    <div className="flex items-center gap-1.5">
                                        <div className="flex -space-x-2">
                                            {assignees.slice(0, 3).map((assignee: any, idx: number) => (
                                                <Avatar key={idx} className="h-5 w-5 border-2 border-white ring-1 ring-slate-100">
                                                    <AvatarImage src={assignee.avatar} />
                                                    <AvatarFallback className="text-[6px]">{assignee.name?.[0]}</AvatarFallback>
                                                </Avatar>
                                            ))}
                                            {assignees.length > 3 && (
                                                <div className="h-5 w-5 rounded-full bg-slate-100 border-2 border-white ring-1 ring-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-500">
                                                    +{assignees.length - 3}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-xs">
                                            {assignees.length === 1
                                                ? assignees[0].name
                                                : `${assignees.length} Assigned`
                                            }
                                        </span>
                                    </div>
                                );
                            })()}                </div>
                    </SheetHeader>
                </div >

                {/* Tabs Section */}
                <div className="flex-1 flex flex-col min-h-0" >
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
                        <div className="px-6 border-b bg-white">
                            <TabsList className="w-full justify-start h-12 bg-transparent p-0 gap-6">
                                <TabsTrigger
                                    value="description"
                                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none h-full px-0 font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4" />
                                        Description
                                    </div>
                                </TabsTrigger>
                                {!readOnly && (
                                    <TabsTrigger
                                        value="testing"
                                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none h-full px-0 font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Beaker className="h-4 w-4" />
                                            Testing
                                            {testStatus !== 'not_tested' && (
                                                <Badge variant="secondary" className={`h-5 min-w-5 px-1 rounded-full text-[10px] ml-1 ${testStatus === 'passed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {testStatus === 'passed' ? <Check className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                                </Badge>
                                            )}
                                        </div>
                                    </TabsTrigger>
                                )}
                                <TabsTrigger
                                    value="chat"
                                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none h-full px-0 font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <MessageSquare className="h-4 w-4" />
                                        Discussion
                                        {task.notes?.length > 0 && (
                                            <Badge variant="secondary" className="h-5 min-w-5 px-1 rounded-full text-[10px] ml-1">
                                                {task.notes.length}
                                            </Badge>
                                        )}
                                    </div>
                                </TabsTrigger>
                                <TabsTrigger
                                    value="attachments"
                                    className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none h-full px-0 font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                                >
                                    <div className="flex items-center gap-2">
                                        <Paperclip className="h-4 w-4" />
                                        Attachments
                                        {task.attachments?.length > 0 && (
                                            <Badge variant="secondary" className="h-5 min-w-5 px-1 rounded-full text-[10px] ml-1">
                                                {task.attachments.length}
                                            </Badge>
                                        )}
                                    </div>
                                </TabsTrigger>
                                {!readOnly && (
                                    <TabsTrigger
                                        value="team"
                                        className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary rounded-none h-full px-0 font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <Users className="h-4 w-4" />
                                            Assignee
                                        </div>
                                    </TabsTrigger>
                                )}
                            </TabsList>
                        </div>


                        {/* Description Content */}
                        <TabsContent value="description" className="flex-1 flex flex-col m-0 min-h-0 data-[state=inactive]:hidden">
                            <ScrollArea className="flex-1 p-6">
                                <div className="space-y-8">
                                    {/* Description Section */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Description</h3>
                                            {!readOnly && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleGenerateDescription}
                                                    disabled={isGeneratingDescription}
                                                    className="h-7 text-xs font-medium text-primary border-primary/20 hover:bg-primary/5"
                                                >
                                                    {isGeneratingDescription ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                                                    AI Auto-Complete
                                                </Button>
                                            )}
                                        </div>
                                        <Textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            onBlur={handleSaveDescription}
                                            readOnly={readOnly}
                                            placeholder={readOnly ? "No description provided." : "Add a more detailed description..."}
                                            className={cn("min-h-[120px] resize-none border-slate-200 focus-visible:ring-primary/20 bg-slate-50/50 text-sm leading-relaxed", readOnly && "focus-visible:ring-0")}
                                        />
                                    </div>

                                    {/* Subtasks Section */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Subtasks</h3>
                                                <Badge variant="secondary" className="px-1.5 py-0 h-5 text-[10px]">
                                                    {subtasks.filter((st: any) => st.completed).length}/{subtasks.length}
                                                </Badge>
                                            </div>
                                            {!readOnly && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={handleGenerateSubtasks}
                                                    disabled={isGeneratingSubtasks}
                                                    className="h-7 text-xs font-medium text-primary border-primary/20 hover:bg-primary/5"
                                                >
                                                    {isGeneratingSubtasks ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                                                    AI Generate
                                                </Button>
                                            )}
                                        </div>

                                        <div className="space-y-2">
                                            {subtasks.map((subtask: any) => (
                                                <div key={subtask.id} className="group flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all">
                                                    <div
                                                        onClick={() => !readOnly && handleToggleSubtask(subtask.id)}
                                                        className={`
                                                            h-5 w-5 rounded border flex items-center justify-center transition-colors mt-1.5
                                                            ${subtask.completed ? 'bg-primary border-primary text-white' : 'bg-white border-slate-300 hover:border-slate-400'}
                                                            ${readOnly ? 'cursor-default' : 'cursor-pointer'}
                                                        `}
                                                    >
                                                        {subtask.completed && <Check className="h-3.5 w-3.5 stroke-[3px]" />}
                                                    </div>
                                                    <Textarea
                                                        value={subtask.title}
                                                        onChange={(e) => {
                                                            handleUpdateSubtaskTitle(subtask.id, e.target.value)
                                                            e.target.style.height = "auto"
                                                            e.target.style.height = `${e.target.scrollHeight}px`
                                                        }}
                                                        onBlur={(e) => handleSaveSubtaskTitle(subtask.id, e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                (e.target as HTMLElement).blur();
                                                            }
                                                        }}
                                                        readOnly={readOnly}
                                                        className={`
                                                            flex-1 min-h-[32px] py-1 border-none shadow-none bg-transparent px-0 focus-visible:ring-0 resize-none overflow-hidden
                                                            ${subtask.completed ? 'text-slate-400 line-through' : 'text-slate-700 font-medium'}
                                                            ${readOnly ? 'focus-visible:ring-0' : ''}
                                                        `}
                                                        placeholder="Type subtask and press Enter..."
                                                        rows={1}
                                                        autoFocus={subtask.title === ""}
                                                        ref={(ref) => {
                                                            if (ref) {
                                                                ref.style.height = "auto"
                                                                ref.style.height = `${ref.scrollHeight}px`
                                                            }
                                                        }}
                                                    />
                                                    {subtask.createdAt && (
                                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight whitespace-nowrap mt-2.5 tabular-nums">
                                                            {format(new Date(subtask.createdAt), "MMM d, h:mm a")}
                                                        </span>
                                                    )}
                                                    {!readOnly && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDeleteSubtask(subtask.id)}
                                                            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all mt-1"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}

                                            {!readOnly && (
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleAddSubtask}
                                                    className="w-full justify-start text-slate-500 hover:text-primary hover:bg-primary/5 h-9 font-medium"
                                                >
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    Add Subtask
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        {/* Chat Content */}
                        <TabsContent value="chat" className="flex-1 flex flex-col m-0 min-h-0 data-[state=inactive]:hidden">
                            <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
                                <div className="space-y-6">
                                    {!task.notes || task.notes.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                                            <MessageSquare className="h-12 w-12 mb-3 opacity-20" />
                                            <p className="text-sm font-medium">No comments yet</p>
                                            <p className="text-xs">Start the discussion below</p>
                                        </div>
                                    ) : (
                                        task.notes.map((note: any, idx: number) => {
                                            const isString = typeof note === 'string';
                                            const noteText = isString ? note : note.text;
                                            const noteDate = isString ? null : note.createdAt;
                                            const noteSender = isString ? null : note.sender;

                                            return (
                                                <div key={idx} className="flex gap-3">
                                                    <Avatar className="h-8 w-8 border mt-1">
                                                        <AvatarImage src={noteSender?.avatar} />
                                                        <AvatarFallback className="bg-slate-100 text-slate-500 text-xs">
                                                            {noteSender?.name?.[0] || "?"}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs font-bold text-slate-700">
                                                                {noteSender?.name || "User"}
                                                            </span>
                                                            {noteDate && !isNaN(new Date(noteDate).getTime()) && (
                                                                <span className="text-[10px] text-slate-400">
                                                                    {format(new Date(noteDate), "MMM d, h:mm a")}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="bg-slate-50 p-3 rounded-tr-xl rounded-br-xl rounded-bl-xl text-sm text-slate-600 leading-relaxed border border-slate-100">
                                                            {noteText}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </ScrollArea>
                            <div className="p-4 border-t bg-white">
                                <div className="flex gap-2">
                                    <Textarea
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Type a message..."
                                        className="min-h-[44px] max-h-32 resize-none border-slate-200 focus-visible:ring-primary/20"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                handleSendMessage()
                                            }
                                        }}
                                    />
                                    <Button
                                        onClick={handleSendMessage}
                                        disabled={!newMessage.trim() || isSending}
                                        size="icon"
                                        className="h-[44px] w-[44px] shrink-0"
                                    >
                                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>

                        {/* Testing Content */}
                        {!readOnly && (
                            <TabsContent value="testing" className="flex-1 flex flex-col m-0 min-h-0 data-[state=inactive]:hidden">
                                <ScrollArea className="flex-1 p-6">
                                    <div className="space-y-8">
                                        <div className="space-y-4">
                                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Test Status</h3>
                                            <div className="grid grid-cols-3 gap-3">
                                                <div
                                                    onClick={() => !readOnly && handleUpdateTestStatus('passed')}
                                                    className={`
                                                    rounded-xl border-2 p-4 flex flex-col items-center justify-center gap-2 transition-all
                                                    ${testStatus === 'passed' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white border-slate-200 hover:border-green-200 hover:bg-green-50/50'}
                                                    ${readOnly ? 'cursor-default' : 'cursor-pointer'}
                                                `}
                                                >
                                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${testStatus === 'passed' ? 'bg-green-200 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                                                        <CheckCircle className="h-6 w-6" />
                                                    </div>
                                                    <span className="font-bold text-sm">Pass</span>
                                                </div>

                                                <div
                                                    onClick={() => !readOnly && handleUpdateTestStatus('failed')}
                                                    className={`
                                                    rounded-xl border-2 p-4 flex flex-col items-center justify-center gap-2 transition-all
                                                    ${testStatus === 'failed' ? 'bg-red-50 border-red-500 text-red-700' : 'bg-white border-slate-200 hover:border-red-200 hover:bg-red-50/50'}
                                                    ${readOnly ? 'cursor-default' : 'cursor-pointer'}
                                                `}
                                                >
                                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${testStatus === 'failed' ? 'bg-red-200 text-red-700' : 'bg-slate-100 text-slate-400'}`}>
                                                        <XCircle className="h-6 w-6" />
                                                    </div>
                                                    <span className="font-bold text-sm">Fail</span>
                                                </div>

                                                <div
                                                    onClick={() => !readOnly && handleUpdateTestStatus('not_tested')}
                                                    className={`
                                                    rounded-xl border-2 p-4 flex flex-col items-center justify-center gap-2 transition-all
                                                    ${testStatus === 'not_tested' ? 'bg-slate-100 border-slate-400 text-slate-700' : 'bg-white border-slate-200 hover:bg-slate-50'}
                                                    ${readOnly ? 'cursor-default' : 'cursor-pointer'}
                                                `}
                                                >
                                                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${testStatus === 'not_tested' ? 'bg-slate-300 text-slate-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        <AlertCircle className="h-6 w-6" />
                                                    </div>
                                                    <span className="font-bold text-sm">Not Tested</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Test Notes</h3>
                                            <Textarea
                                                value={testNotes}
                                                onChange={(e) => setTestNotes(e.target.value)}
                                                onBlur={handleSaveTestNotes}
                                                readOnly={readOnly}
                                                placeholder={readOnly ? "No test notes." : "Add details about test results, bugs found, or reproduction steps..."}
                                                className="min-h-[200px] resize-none border-slate-200 focus-visible:ring-primary/20 bg-slate-50/50 text-sm leading-relaxed"
                                            />
                                        </div>
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                        )}

                        {/* Attachments Content */}
                        <TabsContent value="attachments" className="flex-1 flex flex-col m-0 min-h-0 data-[state=inactive]:hidden">
                            <ScrollArea className="flex-1 p-6">
                                <div className="grid grid-cols-4 gap-4">
                                    <div
                                        className={`col-span-4 border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer group ${isDraggingAttachments ? 'bg-primary/5 border-primary shadow-inner scale-[0.98]' : 'border-slate-200 hover:bg-slate-50'}`}
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                    >
                                        <input
                                            type="file"
                                            multiple
                                            ref={fileInputRef}
                                            className="hidden"
                                            onChange={handleFileUpload}
                                            disabled={isUploading}
                                        />
                                        <div className={`h-12 w-12 rounded-full flex items-center justify-center mb-4 transition-all duration-300 ${isDraggingAttachments ? 'bg-primary text-white scale-110' : 'bg-primary/5 text-primary group-hover:bg-primary/10'}`}>
                                            {isUploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Paperclip className={`h-6 w-6 ${isDraggingAttachments ? 'animate-bounce' : ''}`} />}
                                        </div>
                                        <p className="text-sm font-bold text-slate-800">
                                            {isDraggingAttachments ? 'Drop to upload' : 'Click or drag file to upload'}
                                        </p>
                                        <p className="text-xs text-slate-400 mt-2 font-medium">Images, documents, or archives</p>
                                    </div>

                                    {task.attachments?.map((file: any) => {
                                        const isImage = file.type?.includes('image')
                                        if (isImage) {
                                            return (
                                                <div key={file.id} className="group relative aspect-[16/10] rounded-2xl overflow-hidden bg-slate-900 shadow-sm hover:shadow-xl transition-all duration-300">
                                                    <img
                                                        src={file.url}
                                                        alt={file.name}
                                                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80" />

                                                    {!readOnly && (
                                                        <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 translate-y-[-10px] group-hover:translate-y-0">
                                                            <Button
                                                                variant="secondary"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-full bg-black/40 backdrop-blur-md text-white hover:bg-red-500 hover:text-white border-0"
                                                                onClick={(e) => {
                                                                    e.stopPropagation()
                                                                    handleDeleteAttachment(file.id, file.url)
                                                                }}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}

                                                    <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between gap-3 translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-white font-bold text-sm truncate leading-tight" title={file.name}>{file.name}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] text-slate-300 font-medium bg-white/10 px-1.5 py-0.5 rounded">
                                                                    {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'IMG'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <Button
                                                            variant="secondary"
                                                            size="icon"
                                                            className="h-8 w-8 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white hover:text-slate-900 border-0 shrink-0"
                                                            onClick={() => setPreviewImage(file.url)}
                                                        >
                                                            <Paperclip className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            )
                                        }

                                        return (
                                            <div key={file.id} className="col-span-4 flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-lg group hover:border-slate-200 hover:shadow-sm transition-all">
                                                <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                                                    <FileText className="h-5 w-5 text-slate-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                                                    <p className="text-xs text-slate-400">
                                                        {file.size ? `${(file.size / 1024).toFixed(1)} KB` : 'Unknown size'} • {file.createdAt && !isNaN(new Date(file.createdAt).getTime()) ? format(new Date(file.createdAt), 'MMM d') : 'Unknown date'}
                                                    </p>
                                                </div>
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/5"
                                                        asChild
                                                    >
                                                        <a href={file.url} target="_blank" rel="noopener noreferrer">
                                                            <Paperclip className="h-4 w-4" />
                                                        </a>
                                                    </Button>
                                                    {!readOnly && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                            onClick={() => handleDeleteAttachment(file.id, file.url)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
                            <DialogContent className="max-w-4xl w-full p-0 overflow-hidden bg-transparent border-none shadow-none">
                                <DialogTitle className="sr-only">Image Preview</DialogTitle>
                                <div className="relative w-full h-full flex items-center justify-center">
                                    {previewImage && (
                                        <img
                                            src={previewImage}
                                            alt="Preview"
                                            className="max-h-[80vh] w-auto object-contain rounded-lg shadow-2xl"
                                        />
                                    )}
                                    <Button
                                        variant="secondary"
                                        size="icon"
                                        className="absolute top-2 right-2 rounded-full bg-black/50 text-white hover:bg-black/70"
                                        onClick={() => setPreviewImage(null)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        {/* Team Member Assignment */}
                        {!readOnly && (
                            <TabsContent value="team" className="flex-1 flex flex-col m-0 min-h-0 data-[state=inactive]:hidden">
                                <ScrollArea className="flex-1 p-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Assign Team Member</h3>
                                            {(() => {
                                                const count = (Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo])
                                                    .filter((m: any) => m && m.name !== 'Unassigned').length;

                                                if (count > 0) {
                                                    return (
                                                        <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">
                                                            {count} Selected
                                                        </Badge>
                                                    )
                                                }
                                                return null;
                                            })()}
                                        </div>

                                        <div className="relative mb-4">
                                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                            <Input
                                                placeholder="Search by name or role..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="pl-9 bg-slate-50 border-slate-200 focus-visible:ring-primary/20"
                                            />
                                        </div>

                                        {employeesLoading ? (
                                            <div className="flex justify-center p-4">
                                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                            </div>
                                        ) : (
                                            <div className="grid gap-2">
                                                {filteredEmployees.map((member: any) => {
                                                    const currentAssignees = Array.isArray(task.assignedTo)
                                                        ? task.assignedTo
                                                        : (task.assignedTo ? [task.assignedTo] : []);
                                                    const isAssigned = currentAssignees.some((m: any) => m.name === member.name);

                                                    return (
                                                        <div
                                                            key={member.id}
                                                            className={`
                                                                flex items-center gap-3 p-3 rounded-lg border transition-all
                                                                ${isAssigned ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/20' : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'}
                                                                ${readOnly ? 'cursor-default opacity-80' : 'cursor-pointer'}
                                                            `}
                                                            onClick={() => handleAssignMember(member)}
                                                        >
                                                            <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                                                <AvatarImage src={member.avatar || ""} />
                                                                <AvatarFallback className="bg-slate-100 text-slate-500 font-medium text-xs">
                                                                    {member.name?.[0]}
                                                                </AvatarFallback>
                                                            </Avatar>
                                                            <div className="flex-1">
                                                                <p className={`text-sm font-bold ${isAssigned ? 'text-primary' : 'text-slate-700'}`}>
                                                                    {member.name}
                                                                </p>
                                                                <p className="text-xs text-slate-500">{member.role || "Team Member"}</p>
                                                            </div>
                                                            {isAssigned && <CheckCircle2 className="h-5 w-5 text-primary" />}
                                                        </div>
                                                    )
                                                })}

                                                {!employeesLoading && filteredEmployees.length === 0 && (
                                                    <div className="text-center py-8 text-slate-400">
                                                        <UserPlus className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                                        <p>No matching employees found</p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </TabsContent>
                        )}
                    </Tabs>
                </div>
            </SheetContent>
        </Sheet >
    )
}

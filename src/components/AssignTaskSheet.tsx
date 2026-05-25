import { useState, useEffect } from "react"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, Check, Loader2, ArrowRight, Trash2 } from "lucide-react"
import { useProjects } from "src/hooks/useProjects"
import { projectService } from "src/firebase/projectService"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface AssignTaskSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    employee: any // The employee from employeesWithProjects (has .projects array)
}

export function AssignTaskSheet({ open, onOpenChange, employee }: AssignTaskSheetProps) {
    const { projects: allProjects } = useProjects()
    const [step, setStep] = useState(1)
    const [selectedProject, setSelectedProject] = useState<any>(null)
    const [taskName, setTaskName] = useState("")
    const [searchQuery, setSearchQuery] = useState("")
    const [loading, setLoading] = useState(false)

    // Reset state when opening/employee changes
    useEffect(() => {
        if (open && employee) {
            const assignedProjects = employee.projects || []
            if (assignedProjects.length > 0) {
                setSelectedProject(assignedProjects[0])
                setStep(2) // Skip to Add Task
            } else {
                setSelectedProject(null)
                setStep(1) // Select Project
            }
            setTaskName("")
            setSearchQuery("")
        }
    }, [open, employee])

    const filteredProjects = allProjects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.client && p.client.toLowerCase().includes(searchQuery.toLowerCase()))
    )

    const handleAssign = async () => {
        if (!selectedProject || !taskName.trim()) {
            return
        }

        setLoading(true)
        try {
            const newTask = {
                id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                task: taskName.trim(),
                status: "Pending",
                date: new Date().toISOString().split('T')[0], // yyyy-MM-dd
                assignedTo: {
                    name: employee.name,
                    avatar: employee.avatar || "",
                    email: employee.email
                },
                notes: [],
                attachments: []
            }

            await projectService.addMilestone(selectedProject.id, newTask)


            toast.success(`Task added`)
            setTaskName("") // Clear for next task
        } catch (error) {
            console.error("Error assigning task:", error)
            toast.error("Failed to add task")
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteTask = async (taskId: string) => {
        try {
            const latestProject = allProjects.find(p => p.id === selectedProject.id) || selectedProject
            const currentMilestones = latestProject.milestones || []
            const updatedMilestones = currentMilestones.filter((m: any) => m.id !== taskId)

            await projectService.updateProject(selectedProject.id, {
                milestones: updatedMilestones
            })

            toast.success("Task removed")
        } catch (error) {
            console.error("Error deleting task:", error)
            toast.error("Failed to remove task")
        }
    }

    if (!employee) return null

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-[500px] flex flex-col h-full p-0 overflow-hidden">
                <div className="p-6 pb-4 flex-1 flex flex-col min-h-0">
                    <SheetHeader className="mb-6">
                        <SheetTitle>Assign Task to {employee.name}</SheetTitle>
                        <SheetDescription>
                            {step === 1 ? "Select a project to assign this employee to." : "Rapidly add tasks below."}
                        </SheetDescription>
                    </SheetHeader>

                    {step === 1 ? (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search projects..."
                                    className="pl-9"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && selectedProject) {
                                            setStep(2)
                                        }
                                    }}
                                />
                            </div>

                            <div className="grid gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                {filteredProjects.map((project) => (
                                    <button
                                        key={project.id}
                                        onClick={() => setSelectedProject(project)}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                                            selectedProject?.id === project.id
                                                ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                : "hover:border-primary/50 hover:bg-muted/50"
                                        )}
                                    >
                                        <Avatar className="h-10 w-10 border bg-white rounded-lg">
                                            <AvatarImage src={project.logo} />
                                            <AvatarFallback className="rounded-lg bg-primary/10 text-primary uppercase font-bold text-xs">
                                                {project.name.substring(0, 2)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm truncate">{project.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{project.client}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 animate-in slide-in-from-right duration-300">
                            {/* Project Picker Toggle */}
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-dashed text-xs">
                                <span className="font-bold text-muted-foreground uppercase tracking-widest">Project:</span>
                                <span className="font-bold text-foreground">{selectedProject?.name}</span>
                                <Button variant="link" className="h-auto p-0 text-[10px] ml-auto" onClick={() => setStep(1)}>Change</Button>
                            </div>

                            {/* Rapid Task Entry */}
                            <div className="space-y-2">
                                <div className="relative group">
                                    <Input
                                        id="taskName"
                                        placeholder="What's next? Type and hit Enter..."
                                        className="h-14 text-base font-semibold border-primary/30 focus-visible:ring-primary shadow-md pr-12 bg-primary/[0.02]"
                                        value={taskName}
                                        onChange={(e) => setTaskName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault()
                                                handleAssign()
                                            }
                                        }}
                                        autoFocus
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        {loading ? (
                                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        ) : (
                                            <div className="h-6 w-6 rounded flex items-center justify-center bg-primary/10 text-primary text-[10px] font-bold">
                                                ↵
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Active Tasks list */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Active Tasks</h4>
                                    <span className="text-[10px] font-bold text-primary/60">Live View</span>
                                </div>
                                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar pb-10">
                                    {(() => {
                                        const projectMilestones = allProjects.find(p => p.id === selectedProject?.id)?.milestones || []
                                        const employeeTasks = projectMilestones.filter((m: any) => {
                                            const assignees = Array.isArray(m.assignedTo) ? m.assignedTo : (m.assignedTo ? [m.assignedTo] : [])
                                            return assignees.some((a: any) => a.email === employee.email) && m.status !== 'Completed' && m.status !== 'Delivered'
                                        }).reverse()

                                        if (employeeTasks.length === 0) {
                                            return (
                                                <div className="text-center py-8 bg-muted/20 rounded-2xl border border-dashed">
                                                    <p className="text-xs text-muted-foreground font-medium">No tasks assigned yet.</p>
                                                </div>
                                            )
                                        }

                                        return employeeTasks.map((t: any) => (
                                            <div key={t.id} className="flex items-center gap-3 p-4 rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all group animate-in fade-in slide-in-from-bottom-2">
                                                <div className="h-8 w-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                                                    <Check className="h-4 w-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-slate-700 truncate">{t.task}</p>
                                                    <p className="text-[10px] text-muted-foreground font-medium">{t.date}</p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="px-2 py-1 rounded-full bg-blue-50 text-blue-600 text-[9px] font-black uppercase tracking-wider">
                                                        {t.status}
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all rounded-full"
                                                        onClick={() => handleDeleteTask(t.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    })()}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <SheetFooter className="mt-auto border-t p-6 bg-slate-50/50">
                    <div className="flex items-center gap-3 w-full">
                        <Button
                            variant="outline"
                            className="flex-1 rounded-xl h-12 font-bold"
                            onClick={() => onOpenChange(false)}
                        >
                            {step === 2 ? "Done" : "Cancel"}
                        </Button>
                        {step === 1 && (
                            <Button
                                className="flex-1 rounded-xl h-12 font-bold"
                                disabled={!selectedProject}
                                onClick={() => setStep(2)}
                            >
                                Continue <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}

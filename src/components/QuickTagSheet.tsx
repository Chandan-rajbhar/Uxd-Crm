import { useState, useMemo } from "react"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Search, Check, Loader2, UserPlus } from "lucide-react"
import { useEmployees } from "src/hooks/useEmployees"
import { projectService } from "src/firebase/projectService"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface QuickTagSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    task: any
    project: any
    currentUser: any
}

export function QuickTagSheet({ open, onOpenChange, task, project, currentUser }: QuickTagSheetProps) {
    const { employees } = useEmployees()
    const [selectedEmployees, setSelectedEmployees] = useState<any[]>([])
    const [note, setNote] = useState("")
    const [searchQuery, setSearchQuery] = useState("")
    const [loading, setLoading] = useState(false)

    const filteredEmployees = useMemo(() => {
        return employees.filter(emp =>
            emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            emp.role?.toLowerCase().includes(searchQuery.toLowerCase())
        ).filter(emp => emp.authUid !== currentUser?.uid); // Don't tag yourself (optional)
    }, [employees, searchQuery, currentUser])

    const toggleEmployee = (emp: any) => {
        setSelectedEmployees(prev => {
            const isSelected = prev.some(e => e.id === emp.id)
            if (isSelected) {
                return prev.filter(e => e.id !== emp.id)
            } else {
                return [...prev, emp]
            }
        })
    }

    const handleTag = async () => {
        if (selectedEmployees.length === 0 || !note.trim()) {
            toast.error("Please select at least one person and write a note")
            return
        }

        setLoading(true)
        try {
            // Update the task in the project milestones
            const currentMilestones = [...(project.milestones || [])]
            const taskIndex = currentMilestones.findIndex(m => m.id === task.id)

            if (taskIndex !== -1) {
                const targetTask = { ...currentMilestones[taskIndex] }
                const currentNotes = [...(targetTask.notes || [])]
                const currentAssignees = Array.isArray(targetTask.assignedTo)
                    ? [...targetTask.assignedTo]
                    : (targetTask.assignedTo ? [targetTask.assignedTo] : []);

                // Add notes and assignees for each selected person
                selectedEmployees.forEach((emp, index) => {
                    // Add note
                    const newNote = {
                        id: `${Date.now()}-${index}`,
                        text: `@${emp.name}: ${note.trim()}`,
                        createdAt: new Date().toISOString(),
                        sender: {
                            name: currentUser?.displayName || currentUser?.name || "System",
                            avatar: currentUser?.photoURL || currentUser?.avatar || "",
                            role: "employee"
                        },
                        isTag: true,
                        taggedUser: {
                            name: emp.name,
                            authUid: emp.authUid,
                            email: emp.email
                        }
                    }
                    currentNotes.push(newNote)

                    // Add to assignees if not already there
                    const isAlreadyAssigned = currentAssignees.some((a: any) => a.name === emp.name);
                    if (!isAlreadyAssigned) {
                        currentAssignees.push({
                            name: emp.name,
                            avatar: emp.avatar || "",
                            email: emp.email
                        })
                    }
                })

                targetTask.notes = currentNotes
                targetTask.assignedTo = currentAssignees
                targetTask.lastEditedAt = new Date().toISOString()

                currentMilestones[taskIndex] = targetTask
                await projectService.updateProject(project.id, { milestones: currentMilestones })

                toast.success(`Tagged ${selectedEmployees.length} people with your note`)
                resetAndClose()
            }
        } catch (error) {
            console.error("Error tagging people:", error)
            toast.error("Failed to tag people")
        } finally {
            setLoading(false)
        }
    }

    const resetAndClose = () => {
        setNote("")
        setSelectedEmployees([])
        setSearchQuery("")
        onOpenChange(false)
    }

    if (!task) return null

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-[500px] flex flex-col h-full p-0 overflow-hidden">
                <div className="p-6 pb-4 flex-1 flex flex-col min-h-0">
                    <SheetHeader className="mb-6">
                        <SheetTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <UserPlus className="h-5 w-5 text-primary" />
                                Tag People & Note
                            </div>
                            {selectedEmployees.length > 0 && (
                                <Badge variant="secondary" className="bg-primary/10 text-primary border-none">
                                    {selectedEmployees.length} Selected
                                </Badge>
                            )}
                        </SheetTitle>
                        <SheetDescription>
                            Assign <span className="font-bold text-foreground">"{task.task}"</span> to teammates with a quick context note.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="space-y-6 flex-1 flex flex-col min-h-0">
                        {/* Note Section */}
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] px-1">Quick Note</label>
                            <Textarea
                                placeholder="What do they need to know?"
                                className="min-h-[100px] resize-none border-primary/20 focus-visible:ring-primary bg-slate-50/50 text-sm leading-relaxed"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                autoFocus
                            />
                        </div>

                        {/* Search & List */}
                        <div className="space-y-3 flex-1 flex flex-col min-h-0">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Choose People</label>
                                {selectedEmployees.length > 0 && (
                                    <button
                                        onClick={() => setSelectedEmployees([])}
                                        className="text-[10px] font-bold text-primary hover:underline"
                                    >
                                        Clear All
                                    </button>
                                )}
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name or role..."
                                    className="pl-9 h-10 text-sm border-slate-200"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-2 mt-2">
                                {filteredEmployees.length > 0 ? (
                                    filteredEmployees.map((emp) => {
                                        const isSelected = selectedEmployees.some(e => e.id === emp.id)
                                        return (
                                            <button
                                                key={emp.id}
                                                onClick={() => toggleEmployee(emp)}
                                                className={cn(
                                                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left group",
                                                    isSelected
                                                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                                                        : "hover:border-primary/50 hover:bg-muted/50 border-transparent bg-slate-50/50"
                                                )}
                                            >
                                                <Avatar className="h-9 w-9 border bg-white">
                                                    <AvatarImage src={emp.avatar || undefined} />
                                                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                                                        {emp.name.substring(0, 2)}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">{emp.name}</p>
                                                    <p className="text-[10px] text-muted-foreground truncate uppercase font-bold tracking-wider">{emp.role || 'Teammate'}</p>
                                                </div>
                                                {isSelected && (
                                                    <div className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center animate-in zoom-in-50 duration-200">
                                                        <Check className="h-3 w-3" />
                                                    </div>
                                                )}
                                            </button>
                                        )
                                    })
                                ) : (
                                    <div className="text-center py-10 opacity-50">
                                        <p className="text-sm font-medium">No people found</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <SheetFooter className="mt-auto border-t p-6 bg-slate-50/50">
                    <div className="flex flex-col gap-3 w-full">
                        <Button
                            className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20"
                            disabled={selectedEmployees.length === 0 || !note.trim() || loading}
                            onClick={handleTag}
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <div className="flex items-center gap-2">
                                    <UserPlus className="h-4 w-4" />
                                    <span>Tag {selectedEmployees.length > 0 ? `${selectedEmployees.length} People` : 'People'}</span>
                                </div>
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full h-10 text-xs text-muted-foreground font-semibold hover:bg-transparent"
                            onClick={resetAndClose}
                        >
                            Cancel
                        </Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}

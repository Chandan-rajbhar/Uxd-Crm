import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format, isToday, isPast, formatDistanceToNow } from "date-fns"
import { Calendar, CheckCircle2, Circle, Clock, AlertCircle, Users } from "lucide-react"
import { cn } from "@/lib/utils"

interface TeamPreviewSheetProps {
    teamName: string;
    employees: any[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialSelectedEmployeeId?: string;
}

export function TeamPreviewSheet({ teamName, employees, open, onOpenChange, initialSelectedEmployeeId }: TeamPreviewSheetProps) {
    const navigate = useNavigate();
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

    // Reset selection when sheet opens or team changes
    useEffect(() => {
        if (open && employees.length > 0) {
            if (initialSelectedEmployeeId && employees.find(e => e.id === initialSelectedEmployeeId)) {
                setSelectedEmployeeId(initialSelectedEmployeeId);
            } else if (!initialSelectedEmployeeId || !employees.find(e => e.id === selectedEmployeeId)) {
                setSelectedEmployeeId(employees[0].id);
            }
        }
    }, [open, employees, initialSelectedEmployeeId]);

    if (!open) return null;

    const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || employees[0];

    // Extract all tasks across all projects for selected employee
    // Group tasks by project
    const projectGroups: { project: any, tasks: any[] }[] = []
    if (selectedEmployee?.projectTasks) {
        selectedEmployee.projectTasks.forEach((pt: any) => {
            const tasks = pt.tasks.map((task: any) => ({ ...task }))
            // Sort: active first (completed at bottom), then by due date
            tasks.sort((a: any, b: any) => {
                const aC = a.status === 'Completed' || a.status === 'Delivered'
                const bC = b.status === 'Completed' || b.status === 'Delivered'
                if (aC !== bC) return aC ? 1 : -1
                const dA = new Date(a.dueDate || '2099-01-01').getTime()
                const dB = new Date(b.dueDate || '2099-01-01').getTime()
                return dA - dB
            })
            if (tasks.length > 0) {
                projectGroups.push({ project: pt.project, tasks })
            }
        })
    }

    const totalTasks = projectGroups.reduce((sum, pg) => sum + pg.tasks.length, 0)

    const TaskRow = ({ task, projectId }: { task: any, projectId: string }) => {
        const isCompleted = task.status === 'Completed' || task.status === 'Delivered'
        const isMissed = task.dueDate && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && !isCompleted
        const subtasks = task.subtasks || []

        return (
            <div>
                <div 
                    className={cn(
                        "flex items-start gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-muted/40 min-w-0 cursor-pointer",
                        isMissed && "bg-red-50/40"
                    )}
                    onClick={() => {
                        navigate(`/tasks/${projectId}`);
                        onOpenChange(false);
                    }}
                >
                    <div className="shrink-0 mt-0.5">
                        {isCompleted ? (
                            <CheckCircle2 className={cn("h-4 w-4", task.status === 'Delivered' ? "text-purple-500" : "text-emerald-500")} />
                        ) : task.status === 'In Progress' ? (
                            <Clock className="h-4 w-4 text-yellow-500" />
                        ) : isMissed ? (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                        ) : (
                            <Circle className="h-4 w-4 text-red-400" />
                        )}
                    </div>
                    <span className={cn("flex-1 text-sm break-words min-w-0", isCompleted && "line-through opacity-50")}>{task.task}</span>
                    {task.createdAt && (
                        <span className="text-[10px] text-muted-foreground/50 shrink-0 hidden sm:block">
                            {formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })}
                        </span>
                    )}
                    {task.dueDate && (
                        <span className={cn("text-[10px] font-medium shrink-0 flex items-center gap-1",
                            isMissed ? "text-red-500" : isToday(new Date(task.dueDate)) ? "text-blue-500" : "text-muted-foreground"
                        )}>
                            <Calendar className="h-2.5 w-2.5" />
                            {isToday(new Date(task.dueDate)) ? 'Today' : format(new Date(task.dueDate), 'MMM d')}
                        </span>
                    )}
                    <Badge
                        className={cn(
                            "text-[10px] px-2 py-0 h-5 font-bold border-transparent shrink-0",
                            task.status === 'Completed' && "bg-emerald-600 hover:bg-emerald-700 text-white",
                            task.status === 'Delivered' && "bg-purple-600 hover:bg-purple-700 text-white",
                            task.status === 'In Progress' && "bg-yellow-500 hover:bg-yellow-600 text-white",
                            task.status === 'Pending' && "bg-red-600 hover:bg-red-700 text-white",
                            !task.status && "bg-slate-500 hover:bg-slate-600 text-white"
                        )}
                    >
                        {task.status || 'To Do'}
                    </Badge>
                </div>
                {subtasks.length > 0 && (
                    <div className="ml-7">
                        {subtasks.map((st: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-muted/40 min-w-0">
                                <div className="shrink-0 mt-0.5">
                                    {st.completed ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    ) : (
                                        <Circle className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </div>
                                <span className={cn("flex-1 text-sm break-words min-w-0", st.completed ? "line-through opacity-50" : "text-foreground")}>{st.title}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[60vw] sm:max-w-[60vw] overflow-hidden flex flex-col p-0 gap-0">
                <SheetHeader className="px-6 py-4 border-b bg-muted/20 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <Users className="h-5 w-5" />
                            </div>
                            <div>
                                <SheetTitle className="text-xl font-bold tracking-tight">{teamName}</SheetTitle>
                                <p className="text-sm text-muted-foreground">{employees.length} team members</p>
                            </div>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex flex-1 overflow-hidden h-full">
                    {/* Sidebar */}
                    <div className="w-[260px] border-r bg-muted/10 flex flex-col h-full">
                        <ScrollArea className="flex-1">
                            <div className="p-2 space-y-1">
                                {employees.map((emp) => {
                                    const totalActive = emp.totalActiveTasks || 0;
                                    const isSelected = selectedEmployeeId === emp.id;
                                    return (
                                        <button
                                            key={emp.id}
                                            onClick={() => setSelectedEmployeeId(emp.id)}
                                            className={cn(
                                                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all text-left",
                                                isSelected
                                                    ? "bg-primary text-primary-foreground shadow-sm"
                                                    : "hover:bg-muted/60 text-foreground"
                                            )}
                                        >
                                            <Avatar className={cn("h-8 w-8 border transition-colors", isSelected ? "border-primary-foreground/20" : "border-background")}>
                                                <AvatarImage src={emp.avatar} className="object-cover" />
                                                <AvatarFallback className={cn("text-[10px] font-bold", isSelected ? "bg-primary-foreground/10 text-primary-foreground" : "bg-primary/10 text-primary")}>
                                                    {emp.name ? emp.name[0] : "E"}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-xs truncate">{emp.name}</div>
                                                <div className={cn("text-[10px] truncate", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                                    {emp.role || 'Employee'}
                                                </div>
                                            </div>
                                            <Badge variant={isSelected ? "secondary" : "outline"} className={cn(
                                                "text-[10px] h-5 px-1.5 font-bold",
                                                isSelected
                                                    ? "bg-primary-foreground/20 text-primary-foreground border-transparent hover:bg-primary-foreground/30"
                                                    : totalActive === 0
                                                        ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                                                        : totalActive <= 3
                                                            ? "bg-blue-50 text-blue-600 border-blue-200"
                                                            : totalActive <= 6
                                                                ? "bg-amber-50 text-amber-600 border-amber-200"
                                                                : "bg-red-50 text-red-600 border-red-200"
                                            )}>
                                                {totalActive === 0 ? 'Free' : totalActive}
                                            </Badge>
                                        </button>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col bg-background h-full min-w-0 overflow-hidden">
                        {selectedEmployee ? (
                            <>
                                <div className="px-6 py-4 border-b shrink-0 flex justify-between items-center bg-card">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 border shadow-sm">
                                            <AvatarImage src={selectedEmployee.avatar} className="object-cover" />
                                            <AvatarFallback className="text-sm bg-primary/10 text-primary font-bold">
                                                {selectedEmployee.name ? selectedEmployee.name[0] : "E"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h3 className="text-base font-bold tracking-tight">{selectedEmployee.name}</h3>
                                            <span className="text-xs text-muted-foreground">{selectedEmployee.role || 'Employee'}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-black text-primary tracking-tighter leading-none">
                                            {totalTasks}
                                        </div>
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-0.5">Tasks</p>
                                    </div>
                                </div>

                                <ScrollArea className="flex-1">
                                    <div className="p-4 space-y-4 pb-10 overflow-hidden">
                                        {totalTasks === 0 ? (
                                            <div className="text-center py-20 bg-muted/10 rounded-2xl border border-dashed">
                                                <CheckCircle2 className="h-10 w-10 text-emerald-500/50 mx-auto mb-4" />
                                                <h3 className="text-lg font-bold text-foreground">All Caught Up!</h3>
                                                <p className="text-sm text-muted-foreground mt-1 max-w-[250px] mx-auto leading-relaxed">
                                                    {selectedEmployee.name} has no active tasks.
                                                </p>
                                            </div>
                                        ) : (
                                            projectGroups.map((pg, i) => (
                                                <div key={i}>
                                                    <div 
                                                        className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md cursor-pointer hover:bg-muted/80 transition-all"
                                                        onClick={() => {
                                                            navigate(`/tasks/${pg.project.id}`);
                                                            onOpenChange(false);
                                                        }}
                                                    >
                                                        <Avatar className="h-5 w-5 rounded shadow-sm border border-primary/10">
                                                            <AvatarImage src={pg.project.logo} className="object-cover" />
                                                            <AvatarFallback className="rounded text-[8px] bg-primary/5 text-primary">
                                                                {pg.project.name?.[0]}
                                                            </AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-xs font-bold tracking-tight flex-1">{pg.project.name}</span>
                                                        <span className="text-[10px] text-muted-foreground font-medium">{pg.tasks.length}</span>
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        {pg.tasks.map((task, j) => (
                                                            <TaskRow key={j} task={task} projectId={pg.project.id} />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </ScrollArea>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center text-muted-foreground">
                                    <Users className="h-10 w-10 mx-auto mb-4 opacity-20" />
                                    <p>Select a team member to view their tasks</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}

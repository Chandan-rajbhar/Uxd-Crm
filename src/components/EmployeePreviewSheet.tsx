import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { format, isToday, isPast } from "date-fns"
import { Calendar, CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react"
import { useNavigate } from "react-router-dom"

interface EmployeePreviewSheetProps {
    employee: any
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EmployeePreviewSheet({ employee, open, onOpenChange }: EmployeePreviewSheetProps) {
    const navigate = useNavigate()
    if (!employee) return null

    // Extract all tasks across all projects
    const allTasks: { project: any, task: any }[] = []

    if (employee.projectTasks) {
        employee.projectTasks.forEach((pt: any) => {
            pt.tasks.forEach((task: any) => {
                allTasks.push({
                    project: pt.project,
                    task: task
                })
            })
        })
    }

    // Sort tasks: pending/past due first, then today, then future
    const sortedTasks = allTasks.sort((a, b) => {
        const dateA = new Date(a.task.dueDate || new Date())
        const dateB = new Date(b.task.dueDate || new Date())
        return dateA.getTime() - dateB.getTime()
    })

    const todayTasks = sortedTasks.filter(t => t.task.dueDate && isToday(new Date(t.task.dueDate)))
    const pastPendingTasks = sortedTasks.filter(t =>
        t.task.dueDate &&
        isPast(new Date(t.task.dueDate)) &&
        !isToday(new Date(t.task.dueDate))
    )
    const upcomingTasks = sortedTasks.filter(t =>
        t.task.dueDate &&
        !isPast(new Date(t.task.dueDate)) &&
        !isToday(new Date(t.task.dueDate))
    )
    const noDeadlineTasks = sortedTasks.filter(t => !t.task.dueDate)

    const getStatusColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed':
            case 'delivered':
                return 'text-emerald-500 bg-emerald-50 border-emerald-200'
            case 'in progress':
                return 'text-blue-500 bg-blue-50 border-blue-200'
            case 'review':
                return 'text-amber-500 bg-amber-50 border-amber-200'
            default:
                return 'text-muted-foreground bg-muted border-input'
        }
    }

    const TaskCard = ({ item }: { item: { project: any, task: any } }) => {
        const isMissed = item.task.dueDate && isPast(new Date(item.task.dueDate)) && !isToday(new Date(item.task.dueDate))

        return (
            <div 
                className={`p-4 rounded-xl border ${isMissed ? 'bg-red-50/30 border-red-100 hover:border-red-200' : 'bg-card hover:border-primary/30'} transition-all group cursor-pointer`}
                onClick={() => {
                    navigate(`/tasks/${item.project.id}`);
                    onOpenChange(false);
                }}
            >
                <div className="flex gap-4">
                    <div className="mt-1">
                        {item.task.status === 'Completed' ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : item.task.status === 'In Progress' ? (
                            <Clock className="h-5 w-5 text-blue-500" />
                        ) : isMissed ? (
                            <AlertCircle className="h-5 w-5 text-red-500" />
                        ) : (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                    </div>
                    <div className="flex-1 space-y-2 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h4 className="font-medium text-sm leading-tight group-hover:text-primary transition-colors">{item.task.task}</h4>
                                <div className="flex items-center gap-2 mt-2">
                                    <Avatar className="h-5 w-5 rounded shadow-sm border border-primary/10">
                                        <AvatarImage src={item.project.logo} className="object-cover" />
                                        <AvatarFallback className="rounded text-[8px] bg-primary/5 text-primary">
                                            {item.project.name[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs font-semibold text-muted-foreground truncate max-w-[150px]">
                                        {item.project.name}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                                <Badge variant="outline" className={`text-[10px] px-2 py-0 h-5 font-semibold ${getStatusColor(item.task.status)}`}>
                                    {item.task.status || 'To Do'}
                                </Badge>
                                {item.task.dueDate && (
                                    <div className={`flex items-center gap-1 text-[10px] font-semibold ${isMissed ? 'text-red-500' : isToday(new Date(item.task.dueDate)) ? 'text-blue-500' : 'text-muted-foreground'}`}>
                                        <Calendar className="h-3 w-3" />
                                        {isToday(new Date(item.task.dueDate)) ? 'Today' : format(new Date(item.task.dueDate), 'MMM d, yyyy')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[50vw] sm:max-w-[50vw] overflow-hidden flex flex-col p-0">
                <SheetHeader className="p-6 border-b bg-muted/20 pb-6 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-14 w-14 border-2 border-background shadow-md">
                                <AvatarImage src={employee.avatar} className="object-cover" />
                                <AvatarFallback className="text-lg bg-primary/10 text-primary font-bold">
                                    {employee.name ? employee.name[0] : "E"}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <SheetTitle className="text-2xl font-bold tracking-tight">{employee.name}</SheetTitle>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="font-semibold text-xs border-primary/10 bg-primary/5 text-primary hover:bg-primary/10">
                                        {employee.role || 'Employee'}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                                        • {employee.team || 'Unassigned Team'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-black text-primary tracking-tighter">
                                {allTasks.length}
                            </div>
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-0.5">
                                Active Tasks
                            </p>
                        </div>
                    </div>
                </SheetHeader>

                <ScrollArea className="flex-1 p-6">
                    <div className="max-w-3xl mx-auto space-y-10 pb-10">
                        {allTasks.length === 0 ? (
                            <div className="text-center py-20 bg-muted/10 rounded-2xl border border-dashed">
                                <CheckCircle2 className="h-10 w-10 text-emerald-500/50 mx-auto mb-4" />
                                <h3 className="text-lg font-bold text-foreground">All Caught Up!</h3>
                                <p className="text-sm text-muted-foreground mt-1 max-w-[250px] mx-auto leading-relaxed">
                                    {employee.name} currently has no active tasks assigned across any projects.
                                </p>
                            </div>
                        ) : (
                            <>
                                {pastPendingTasks.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 border-b pb-2 border-red-100">
                                            <AlertCircle className="h-4 w-4 text-red-500" />
                                            <h3 className="text-sm font-bold text-red-600 uppercase tracking-widest">Past/Pending Due</h3>
                                            <Badge className="ml-auto bg-red-100 text-red-700 hover:bg-red-200 border-none">{pastPendingTasks.length}</Badge>
                                        </div>
                                        <div className="grid gap-3">
                                            {pastPendingTasks.map((t, i) => <TaskCard key={i} item={t} />)}
                                        </div>
                                    </div>
                                )}

                                {todayTasks.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 border-b pb-2 border-blue-100">
                                            <Clock className="h-4 w-4 text-blue-500" />
                                            <h3 className="text-sm font-bold text-blue-600 uppercase tracking-widest">Due Today</h3>
                                            <Badge className="ml-auto bg-blue-100 text-blue-700 hover:bg-blue-200 border-none">{todayTasks.length}</Badge>
                                        </div>
                                        <div className="grid gap-3">
                                            {todayTasks.map((t, i) => <TaskCard key={i} item={t} />)}
                                        </div>
                                    </div>
                                )}

                                {upcomingTasks.length > 0 && (
                                    <div className="space-y-4 opacity-80 hover:opacity-100 transition-opacity">
                                        <div className="flex items-center gap-2 border-b pb-2">
                                            <Calendar className="h-4 w-4 text-muted-foreground" />
                                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Upcoming</h3>
                                            <Badge variant="secondary" className="ml-auto">{upcomingTasks.length}</Badge>
                                        </div>
                                        <div className="grid gap-3">
                                            {upcomingTasks.map((t, i) => <TaskCard key={i} item={t} />)}
                                        </div>
                                    </div>
                                )}

                                {noDeadlineTasks.length > 0 && (
                                    <div className="space-y-4 opacity-80 hover:opacity-100 transition-opacity">
                                        <div className="flex items-center gap-2 border-b pb-2">
                                            <Circle className="h-4 w-4 text-muted-foreground" />
                                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No Deadline Set</h3>
                                            <Badge variant="secondary" className="ml-auto">{noDeadlineTasks.length}</Badge>
                                        </div>
                                        <div className="grid gap-3">
                                            {noDeadlineTasks.map((t, i) => <TaskCard key={i} item={t} />)}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    )
}

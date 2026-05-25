
import { useAuth } from "@/contexts/AuthContext"
import { useProjects } from "@/hooks/useProjects"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { format, isSameDay, parseISO, isValid, subDays } from "date-fns"
import {
    Activity,
    CheckCircle2,
    LayoutDashboard,
    ListTodo
} from "lucide-react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

export default function ClientDashboard() {
    const { user } = useAuth()
    const { projects, loading } = useProjects()

    // Filter projects for the current client
    const clientProjects = projects.filter(project => {
        // 1. Exact Email Match (Best)
        if (project.clientEmail && user?.email) {
            if (project.clientEmail.toLowerCase().trim() === user.email.toLowerCase().trim()) return true;
        }

        // 2. Name Match (Fallback)
        const clientName = project.client?.toLowerCase().trim();
        const userName = user?.displayName?.toLowerCase().trim();

        if (!clientName || !userName) return false;

        return clientName === userName || clientName.includes(userName) || userName.includes(clientName);
    })

    // Calculate Stats
    const totalProjects = clientProjects.length

    let totalTasks = 0
    let completedTasksLifetime = 0
    let inProgressTasks = 0
    let completedTasksToday = 0
    const today = new Date()

    // Initialize last 7 days data structure
    const last7DaysData = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(today, 6 - i);
        return {
            date: d,
            name: format(d, 'EEE'), // Mon, Tue
            completed: 0
        };
    });

    clientProjects.forEach(project => {
        if (project.milestones && Array.isArray(project.milestones)) {
            project.milestones.forEach((task: any) => {
                totalTasks++

                if (task.status === 'Completed' || task.status === 'Delivered') {
                    completedTasksLifetime++

                    // Check if completed today
                    let isToday = false;
                    let completionDate: Date | null = null;

                    if (task.completedAt) {
                        try {
                            const parsed = parseISO(task.completedAt);
                            if (isValid(parsed)) {
                                completionDate = parsed;
                                if (isSameDay(parsed, today)) isToday = true;
                            }
                        } catch (e) { console.error("Invalid date", task.completedAt) }
                    }

                    // Fallback to creation date if completedAt missing (heuristic)
                    if (!completionDate && task.date) {
                        // We interpret task.date as the relevant date if completion time is missing
                        // This is a weak fallback but ensures 'old' data shows up somewhere if needed, 
                        // though for Velocity strictly we prefer completedAt. 
                        // However, without completedAt, better to skip for Velocity to be accurate.
                        // User said "make everything dynamic". 
                        // Let's NOT assume creation date = completion date for the chart to avoid misleading spikes.

                        // Check strictly if date matches today for the "Today" counter fallback
                        const dateStr = task.date;
                        if (dateStr === format(today, 'yyyy-MM-dd') || dateStr === format(today, 'dd MMM, yyyy') || dateStr === format(today, 'MMM d, yyyy')) {
                            isToday = true;
                        }
                    }

                    if (isToday) {
                        completedTasksToday++
                    }

                    // Populate Chart Data
                    if (completionDate) {
                        const dayStat = last7DaysData.find(d => isSameDay(d.date, completionDate as Date));
                        if (dayStat) {
                            dayStat.completed++;
                        }
                    } else if (task.date) {
                        // Try to match task.date to chart for older tasks? 
                        // Only if strictly matches one of our 7 days strings.
                        // This handles the "I just marked it done but old system didn't save completedAt" case ONLY if date matches.
                        // Actually, let's just stick to completedAt for chart to be pure.
                    }

                } else if (task.status === 'In Progress') {
                    inProgressTasks++
                }
            })
        }
    })

    const taskCompletionData = last7DaysData.map(({ name, completed }) => ({ name, completed }));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen w-full bg-slate-50">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 min-h-screen bg-slate-50/50 overflow-x-hidden">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Welcome back, {user?.displayName?.split(' ')[0] || 'Client'}!</h2>
                    <p className="text-slate-500 mt-1 text-sm sm:text-base">Here's what's happening with your projects today.</p>
                </div>
                <div className="flex items-center space-x-2 bg-white p-1 rounded-lg border shadow-sm shrink-0">
                    <div className="px-3 py-1 text-sm font-medium text-slate-600 bg-slate-100 rounded-md whitespace-nowrap">
                        {format(new Date(), 'MMMM d, yyyy')}
                    </div>
                </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
                {/* Total Projects */}
                <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Total Projects</CardTitle>
                        <LayoutDashboard className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{totalProjects}</div>
                        <p className="text-xs text-slate-500 mt-1">Active projects</p>
                    </CardContent>
                </Card>

                {/* Tasks Completed Today */}
                <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-l-4 border-l-emerald-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Completed Today</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{completedTasksToday}</div>
                        <p className="text-xs text-slate-500 mt-1">Tasks finished today</p>
                    </CardContent>
                </Card>

                {/* In Progress Tasks */}
                <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-l-4 border-l-amber-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">In Progress</CardTitle>
                        <Activity className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{inProgressTasks}</div>
                        <p className="text-xs text-slate-500 mt-1">Currently being worked on</p>
                    </CardContent>
                </Card>

                {/* Lifetime Total Tasks */}
                <Card className="shadow-sm hover:shadow-md transition-all duration-300 border-l-4 border-l-purple-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-600">Lifetime Tasks</CardTitle>
                        <ListTodo className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{totalTasks}</div>
                        <p className="text-xs text-slate-500 mt-1">
                            <span className="text-emerald-600 font-medium">{completedTasksLifetime}</span> completed total
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
                {/* Chart Section */}
                <Card className="col-span-1 lg:col-span-4 shadow-sm">
                    <CardHeader>
                        <CardTitle>Task Completion Velocity</CardTitle>
                        <CardDescription>Tasks completed over the last 7 days</CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={taskCompletionData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Area type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorCompleted)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Project Progress Snapshot */}
                <Card className="col-span-1 lg:col-span-3 shadow-sm">
                    <CardHeader>
                        <CardTitle>Project Progress</CardTitle>
                        <CardDescription>Snapshot of your active projects</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {clientProjects.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No active projects found.
                                </div>
                            ) : (
                                clientProjects.slice(0, 4).map((project, i) => (
                                    <div key={i} className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></div>
                                                <span className="text-sm font-medium text-slate-700">{project.name}</span>
                                            </div>
                                            <span className="text-xs font-bold text-slate-500">{project.progress}%</span>
                                        </div>
                                        <Progress value={project.progress} className="h-2 bg-slate-100" indicatorClassName={
                                            project.status === 'Completed' ? 'bg-emerald-500' :
                                                project.status === 'In Progress' ? 'bg-blue-500' :
                                                    project.status === 'Planning' ? 'bg-amber-500' : 'bg-slate-300'
                                        } />
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Activity / Lifetime Stats Detail */}
            <div className="grid gap-4 md:grid-cols-1">
                <Card className="shadow-sm">
                    <CardHeader>
                        <CardTitle>Lifetime Overview</CardTitle>
                        <CardDescription>Summary of all activity across all projects</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div className="p-4 bg-slate-50 rounded-lg">
                                <div className="text-2xl sm:text-3xl font-bold text-slate-900">{totalTasks}</div>
                                <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mt-1">Total Tasks</div>
                            </div>
                            <div className="p-4 bg-emerald-50/50 rounded-lg">
                                <div className="text-2xl sm:text-3xl font-bold text-emerald-600">{completedTasksLifetime}</div>
                                <div className="text-xs text-emerald-600/80 uppercase tracking-wider font-semibold mt-1">Completed</div>
                            </div>
                            <div className="p-4 bg-blue-50/50 rounded-lg">
                                <div className="text-2xl sm:text-3xl font-bold text-blue-600">{Math.round((completedTasksLifetime / (totalTasks || 1)) * 100)}%</div>
                                <div className="text-xs text-blue-600/80 uppercase tracking-wider font-semibold mt-1">Completion Rate</div>
                            </div>
                            <div className="p-4 bg-amber-50/50 rounded-lg">
                                <div className="text-2xl sm:text-3xl font-bold text-amber-600">{clientProjects.filter(p => p.status === 'In Progress').length}</div>
                                <div className="text-xs text-amber-600/80 uppercase tracking-wider font-semibold mt-1">Active Projects</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

        </div>
    )
}

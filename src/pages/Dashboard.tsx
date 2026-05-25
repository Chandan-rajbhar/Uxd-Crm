import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Briefcase,
    Calendar,
    Users,
    MessageSquare,
    PackageCheck,
    AlertTriangle,
    Clock,
    Cake,
    Gift,
    PartyPopper
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { useAuth } from "@/contexts/AuthContext"
import { useClients } from "@/hooks/useClients"
import { useProjects } from "@/hooks/useProjects"
import { useEmployees } from "@/hooks/useEmployees"
import EmployeeDashboard from "@/pages/EmployeeDashboard"
import ClientDashboard from "@/pages/ClientDashboard"

// Mock Data Analysis
// Mock Data History

// Renamed from default export to local component
function AdminDashboard() {
    const navigate = useNavigate()
    const [timeRange, setTimeRange] = useState("today")
    const { clients } = useClients()
    const { projects } = useProjects()
    const { employees } = useEmployees()

    // Calculate employees with zero pending tasks across all projects
    const freeEmployees = useMemo(() => {
        // Define team filters to match the "Team View" in EmployeesPage
        const teamFilters = [
            (_e: any) => true // Include all employees/teams
        ];

        const assignedEmployeeNames = new Set(
            projects.flatMap(p => 
                (p.milestones || [])
                .filter(m => m.status !== 'Completed' && m.status !== 'Delivered')
                .map(m => Array.isArray(m.assignedTo) ? m.assignedTo.map((a: any) => a.name) : [m.assignedTo?.name])
            ).flat().filter(Boolean)
        );

        return employees.filter(emp => {
            const isInTeamView = teamFilters.some(filter => filter(emp));
            return isInTeamView && 
                   !assignedEmployeeNames.has(emp.name) && 
                   emp.status === 'Active' && 
                   !emp.isOnLeave;
        });
    }, [employees, projects]);

    const filterByDate = (dateField: any) => {
        if (timeRange === "alltime") return true;
        
        // Handle pending Firestore timestamp (null) -> it means it's literally happening right now
        if (dateField === null) return timeRange === "today" || timeRange === "1week" || timeRange === "1month";
        if (!dateField) return false;

        let date: Date;
        if (typeof dateField === 'object' && 'seconds' in dateField) {
            date = new Date(dateField.seconds * 1000);
        } else {
            date = new Date(dateField);
        }

        if (isNaN(date.getTime())) return false;

        const now = new Date();

        // Use toDateString for today comparison
        if (timeRange === "today") {
            return date.toDateString() === now.toDateString();
        }

        const msPerDay = 24 * 60 * 60 * 1000;
        // For week and month, we look at both last X days AND next X days (since interviews can be future)
        const diffDays = Math.abs(Math.floor((now.getTime() - date.getTime()) / msPerDay));

        if (timeRange === "1week") {
            return diffDays < 7;
        }
        if (timeRange === "1month") {
            return diffDays < 30;
        }

        return true;
    }

    const filteredClients = clients.filter(c => filterByDate((c as any).createdAt || c.lastSeen));
    const filteredProjects = projects.filter(p => filterByDate((p as any).createdAt || (p as any).startDate));

    // Calculate Client Replies from Projects
    const filteredReplies = useMemo(() => {
        const allReplies = projects.flatMap(p => 
            (p.receivedEmails || []).map(e => ({ 
                ...e, 
                projectName: p.name,
                projectId: p.id
            }))
        );
        return allReplies.filter(e => filterByDate(e.receivedAt || e.date));
    }, [projects, timeRange]);

    // Calculate Deliveries from Project Milestones
    const filteredDeliveries = useMemo(() => {
        const allDeliveries = projects.flatMap(p => 
            (p.milestones || []).filter(m => m.status === 'Delivered')
        );
        return allDeliveries.filter(m => filterByDate(m.deliveredAt || m.deliveredDate));
    }, [projects, timeRange]);

    // Calculate Projects with non-delivered (Completed) milestones
    const deliveryWarnings = useMemo(() => {
        return projects
            .filter(p => p.client !== 'Internal Project' && (p.milestones || []).some(m => m.status === 'Completed'))
            .map(p => {
                const milestones = p.milestones || [];
                const completedMilestones = milestones.filter(m => m.status === 'Completed');
                
                // Find most recent delivery date
                const deliveredMilestones = milestones.filter(m => m.status === 'Delivered');
                const lastDeliveredAt = deliveredMilestones.reduce((latest: string | null, m: any) => {
                    const current = m.deliveredAt || m.deliveredDate;
                    if (!latest) return current;
                    return new Date(current) > new Date(latest) ? current : latest;
                }, null);

                return {
                    ...p,
                    completedTaskCount: completedMilestones.length,
                    lastDeliveredAt: lastDeliveredAt
                };
            })
            .filter(p => p.lastDeliveredAt) // Only show projects with previous deliveries
            .sort((a, b) => {
                const dateA = new Date(a.lastDeliveredAt || 0).getTime();
                const dateB = new Date(b.lastDeliveredAt || 0).getTime();
                return dateA - dateB;
            });
    }, [projects]);



    return (
        <div className="flex-1 space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8 pt-4 sm:pt-6 min-h-screen overflow-x-hidden">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-2">
                <div className="min-w-0">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Dashboard</h2>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base">
                        Overview of your projects, finances, and client communication.
                    </p>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                    <Select value={timeRange} onValueChange={setTimeRange}>
                        <SelectTrigger className="flex w-[140px] h-9 bg-white shadow-sm font-medium">
                            <div className="flex items-center">
                                <Calendar className="mr-2 h-4 w-4 text-slate-500" />
                                <SelectValue placeholder="Time range" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="1week">1 Week</SelectItem>
                            <SelectItem value="1month">1 Month</SelectItem>
                            <SelectItem value="alltime">All Time</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="hidden md:flex items-center text-base lg:text-lg font-bold text-slate-800 tracking-tight whitespace-nowrap">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4">
                <Card className="bg-transparent border-0 shadow-md hover:shadow-lg transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                        <Users className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{filteredClients.length}</div>
                        <p className="text-xs text-muted-foreground flex items-center mt-1">
                            <span>{timeRange === 'alltime' ? 'All registered clients' : timeRange === 'today' ? 'Clients from today' : timeRange === '1week' ? 'Clients in the last week' : 'Clients in the last month'}</span>
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-transparent border-0 shadow-md hover:shadow-lg transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Projects</CardTitle>
                        <Briefcase className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{filteredProjects.length}</div>
                        <p className="text-xs text-muted-foreground flex items-center mt-1">
                            <span>{timeRange === 'alltime' ? 'All active projects' : timeRange === 'today' ? 'Projects added today' : timeRange === '1week' ? 'Projects in the last week' : 'Projects in the last month'}</span>
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-transparent border-0 shadow-md hover:shadow-lg transition-all overflow-hidden group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Client Replies</CardTitle>
                        <div className="p-2 bg-purple-50 rounded-lg group-hover:bg-purple-100 transition-colors">
                            <MessageSquare className="h-4 w-4 text-purple-600" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{filteredReplies.length}</div>
                        <p className="text-xs text-muted-foreground flex items-center mt-1">
                            <span>{timeRange === 'alltime' ? 'All client replies' : timeRange === 'today' ? 'Replies from today' : timeRange === '1week' ? 'Replies in the last week' : 'Replies in the last month'}</span>
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-transparent border-0 shadow-md hover:shadow-lg transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Deliveries</CardTitle>
                        <PackageCheck className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{filteredDeliveries.length}</div>
                        <p className="text-xs text-muted-foreground flex items-center mt-1">
                            <span>{timeRange === 'alltime' ? 'All project deliveries' : timeRange === 'today' ? 'Delivered today' : timeRange === '1week' ? 'Delivered this week' : 'Delivered this month'}</span>
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts & Analytics Section */}
            <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
                <Card className="col-span-1 lg:col-span-4 bg-transparent border-0 shadow-md hover:shadow-lg transition-all overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                        <div className="space-y-1">
                            <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-slate-500" />
                                Pending Delivery Warnings
                            </CardTitle>
                            <CardDescription>
                                Projects with completed tasks waiting for update (Last Delivered First).
                            </CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 font-bold hover:bg-slate-200">
                             {deliveryWarnings.length} Alert{deliveryWarnings.length !== 1 ? 's' : ''}
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[300px] pr-4 -mr-4">
                            <div className="space-y-3">
                                {deliveryWarnings.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 text-center">
                                        <div className="p-4 rounded-full bg-emerald-50 mb-4 shadow-inner">
                                            <PackageCheck className="h-8 w-8 text-emerald-500" />
                                        </div>
                                        <p className="text-slate-600 font-semibold text-lg">All caught up!</p>
                                        <p className="text-slate-400 text-sm mt-1">Every completed task has been delivered to clients.</p>
                                    </div>
                                ) : (
                                    deliveryWarnings.map((project, i) => (
                                        <div 
                                            key={i} 
                                            className="group flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-all cursor-pointer border-b border-slate-50 last:border-0"
                                            onClick={() => navigate('/daily-updates')}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="relative">
                                                    <Avatar className="h-8 w-8 transition-all">
                                                        <AvatarImage src={project.logo} />
                                                        <AvatarFallback className="bg-slate-100 text-slate-600 text-[10px] font-bold">{project.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div className="absolute -top-1.5 -right-1.5 h-4 w-4 flex items-center justify-center bg-slate-900 rounded-full text-[9px] font-bold text-white ring-2 ring-white">
                                                        {project.completedTaskCount}
                                                    </div>
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-bold text-slate-800 uppercase tracking-tight leading-none">{project.name}</p>
                                                    <p className="text-[10px] text-slate-600 font-medium">{project.client}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 group-hover:text-slate-900 transition-colors">
                                                <Clock className="h-3 w-3" />
                                                <span>{project.lastDeliveredAt ? new Date(project.lastDeliveredAt).toLocaleDateString() : 'Never'}</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="col-span-1 lg:col-span-3 bg-transparent border-0 shadow-md hover:shadow-lg transition-all overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                        <div className="space-y-1">
                            <CardTitle>Client Replies</CardTitle>
                            <CardDescription>Latest communication on daily updates.</CardDescription>
                        </div>
                        <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-100 font-bold">
                            {filteredReplies.length}
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[300px] pr-4 -mr-4">
                            <div className="space-y-4">
                                {filteredReplies.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="p-3 rounded-full bg-slate-50 mb-3">
                                            <MessageSquare className="h-6 w-6 text-slate-300" />
                                        </div>
                                        <p className="text-sm text-slate-500 font-medium">No recent replies</p>
                                        <p className="text-xs text-slate-400 mt-1">When clients reply to updates, they'll appear here.</p>
                                    </div>
                                ) : (
                                    filteredReplies.map((reply, i) => (
                                        <div 
                                            key={i} 
                                            className="group relative flex flex-col space-y-2 p-3 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50/30 transition-all cursor-pointer"
                                            onClick={() => navigate('/daily-updates')}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6 border border-white shadow-sm">
                                                        <AvatarFallback className="text-[10px] bg-purple-100 text-purple-700 font-bold uppercase">
                                                            {reply.sender[0]}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-xs font-bold text-slate-900 truncate max-w-[120px]">
                                                        {reply.projectName}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] font-medium text-slate-400">
                                                    {new Date(reply.receivedAt || reply.date).toLocaleDateString(undefined, { 
                                                        month: 'short', 
                                                        day: 'numeric' 
                                                    })}
                                                </span>
                                            </div>
                                            
                                            <div className="relative">
                                                <p className="text-xs text-slate-600 line-clamp-2 pl-2 border-l-2 border-purple-100 group-hover:border-purple-300 transition-colors italic">
                                                    "{reply.content}"
                                                </p>
                                            </div>

                                            <div className="flex items-center justify-between pt-1">
                                                <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                                                    {reply.sender.split(' ')[0]}
                                                </span>
                                                <span className="text-[10px] font-bold text-slate-400 group-hover:text-purple-600 transition-colors uppercase tracking-wider">
                                                    View update →
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Details Section */}
            <div className="grid gap-4 grid-cols-1">
                {/* Available Employees Section */}
                <Card className="col-span-1 bg-transparent border-0 shadow-md hover:shadow-lg transition-all overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                        <div className="space-y-1">
                            <CardTitle className="text-lg font-bold">Available Talent</CardTitle>
                            <CardDescription>Active team members with no pending tasks.</CardDescription>
                        </div>
                        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100 font-bold">
                            {freeEmployees.length} Free
                        </Badge>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[300px] pr-4 -mr-4">
                            <div className="space-y-3">
                                {freeEmployees.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="p-3 rounded-full bg-slate-50 mb-3">
                                            <Users className="h-6 w-6 text-slate-300" />
                                        </div>
                                        <p className="text-sm text-slate-500 font-medium">No free employees</p>
                                        <p className="text-xs text-slate-400 mt-1">Everyone is currently assigned to a task.</p>
                                    </div>
                                ) : (
                                    freeEmployees.map((emp, i) => (
                                        <div 
                                            key={i} 
                                            className="group flex items-center justify-between p-2 rounded-lg hover:bg-emerald-50/50 transition-all cursor-pointer border-b border-slate-50 last:border-0"
                                            onClick={() => navigate('/employees')}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8 ring-2 ring-white shadow-sm transition-transform group-hover:scale-110">
                                                    <AvatarImage src={emp.avatar || undefined} />
                                                    <AvatarFallback className="bg-slate-100 text-[10px] font-bold text-slate-500">
                                                        {emp.name.split(' ').map(n => n[0]).join('')}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">{emp.name}</p>
                                                    <p className="text-[10px] text-slate-500 font-medium">{emp.role}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">Available</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}



function HRDashboardView() {
    const { employees } = useEmployees()

    const hrData = useMemo(() => {
        const today = new Date()
        const todayMonthDay = format(today, 'MM-dd')
        
        const birthdaysToday = employees.filter(emp => {
            if (!emp.dateOfBirth) return false
            // Support both YYYY-MM-DD and MM-DD
            return emp.dateOfBirth.includes(todayMonthDay)
        })

        const anniversariesToday = employees.filter(emp => {
            if (!emp.joiningDate) return false
            try {
                const joinedDate = parseISO(emp.joiningDate)
                if (isNaN(joinedDate.getTime())) return false
                
                const joinedMonthDay = format(joinedDate, 'MM-dd')
                if (joinedMonthDay !== todayMonthDay) return false
                
                const years = today.getFullYear() - joinedDate.getFullYear()
                return years > 0
            } catch (e) {
                return false
            }
        }).map(emp => {
            const joinedDate = parseISO(emp.joiningDate!)
            const years = today.getFullYear() - joinedDate.getFullYear()
            return { ...emp, years }
        })

        return { birthdaysToday, anniversariesToday }
    }, [employees])

    return (
        <div className="flex-1 space-y-8 p-8 pt-6 min-h-screen bg-slate-50/30">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900">HR Dashboard</h2>
                    <p className="text-muted-foreground mt-1">
                        Welcome back! Here's what's happening today in the team.
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-primary" />
                        {format(new Date(), 'EEEE, MMMM do')}
                    </div>
                </div>
            </div>

            <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                {/* Birthdays Card */}
                <Card className="border-0 shadow-lg shadow-pink-100/50 bg-white overflow-hidden">
                    <CardHeader className="bg-pink-50/50 pb-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-bold flex items-center gap-2 text-pink-700">
                                <Cake className="h-5 w-5" />
                                Birthdays Today
                            </CardTitle>
                            <Badge variant="secondary" className="bg-pink-100 text-pink-700 font-bold border-0">
                                {hrData.birthdaysToday.length}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[350px] p-6">
                            {hrData.birthdaysToday.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="p-4 rounded-full bg-slate-50 mb-4 opacity-50">
                                        <Cake className="h-8 w-8 text-slate-300" />
                                    </div>
                                    <p className="text-slate-500 font-medium">No birthdays today</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {hrData.birthdaysToday.map((emp, i) => (
                                        <div key={i} className="flex items-center gap-4 p-3 rounded-2xl bg-pink-50/30 border border-pink-100/50 group hover:scale-[1.02] transition-all">
                                            <Avatar className="h-12 w-12 border-2 border-white shadow-sm ring-2 ring-pink-100">
                                                <AvatarImage src={emp.avatar || undefined} />
                                                <AvatarFallback className="bg-pink-100 text-pink-700 font-bold">
                                                    {emp.name[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-slate-900 uppercase tracking-tight text-sm">{emp.name}</h4>
                                                <p className="text-xs text-pink-600 font-semibold">{emp.role}</p>
                                            </div>
                                            <div className="p-2 rounded-full bg-white shadow-sm">
                                                <PartyPopper className="h-4 w-4 text-pink-500" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* Anniversaries Card */}
                <Card className="border-0 shadow-lg shadow-blue-100/50 bg-white overflow-hidden">
                    <CardHeader className="bg-blue-50/50 pb-4">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg font-bold flex items-center gap-2 text-blue-700">
                                <Gift className="h-5 w-5" />
                                Work Anniversaries
                            </CardTitle>
                            <Badge variant="secondary" className="bg-blue-100 text-blue-700 font-bold border-0">
                                {hrData.anniversariesToday.length}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[350px] p-6">
                            {hrData.anniversariesToday.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="p-4 rounded-full bg-slate-50 mb-4 opacity-50">
                                        <Gift className="h-8 w-8 text-slate-300" />
                                    </div>
                                    <p className="text-slate-500 font-medium">No anniversaries today</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {hrData.anniversariesToday.map((emp, i) => (
                                        <div key={i} className="flex items-center gap-4 p-3 rounded-2xl bg-blue-50/30 border border-blue-100/50 group hover:scale-[1.02] transition-all">
                                            <Avatar className="h-12 w-12 border-2 border-white shadow-sm ring-2 ring-blue-100">
                                                <AvatarImage src={emp.avatar || undefined} />
                                                <AvatarFallback className="bg-blue-100 text-blue-700 font-bold">
                                                    {emp.name[0]}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <h4 className="font-bold text-slate-900 uppercase tracking-tight text-sm">{emp.name}</h4>
                                                <p className="text-xs text-blue-600 font-semibold">Completing {emp.years} {emp.years === 1 ? 'Year' : 'Years'}!</p>
                                            </div>
                                            <Badge className="bg-blue-600 text-white font-bold h-8 w-8 rounded-full flex items-center justify-center p-0">
                                                {emp.years}y
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Existing KPI Cards adapt for HR */}
            <div className="grid gap-6 grid-cols-2">
                <Card className="bg-white shadow-sm border-0">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">Total Employees</CardTitle>
                        <Users className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-slate-900 tracking-tighter">{employees.length}</div>
                    </CardContent>
                </Card>
                <Card className="bg-white shadow-sm border-0">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">On Leave</CardTitle>
                        <Clock className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-slate-900 tracking-tighter">
                            {employees.filter(e => e.isOnLeave).length}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}



export default function Dashboard() {
    const { role, loading, user } = useAuth()
    const { employees } = useEmployees()

    const isHR = useMemo(() => {
        if (!user || !employees.length) return false;
        
        // Find current user's employee record
        const currentEmployee = employees.find(e => 
            e.authUid === user.uid || 
            (e.email && user.email && e.email.toLowerCase() === user.email.toLowerCase())
        );
        
        if (!currentEmployee) return false;

        const checkHR = (val?: string) => {
            if (!val) return false;
            const n = val.trim().toLowerCase();
            return /\bhr\b/.test(n) || n.includes('human') || n.includes('humar') || n.includes('recruitment') || n.includes('talent');
        }

        return checkHR(currentEmployee.team) || checkHR(currentEmployee.department);
    }, [user, employees]);

    if (loading) return (
        <div className="flex bg-slate-50 items-center justify-center h-screen w-full">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
    )

    if (role === 'employee') {
        if (isHR) return <HRDashboardView />
        return <EmployeeDashboard />
    }

    if (role === 'client') {
        return <ClientDashboard />
    }

    // Default to Admin or HR if specifically determined (e.g. for Admin accounts that are also HR)
    if (isHR) return <HRDashboardView />
    return <AdminDashboard />
}

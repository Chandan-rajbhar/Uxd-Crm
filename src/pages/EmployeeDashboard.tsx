import { cn } from '@/lib/utils'
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useEmployees } from '@/hooks/useEmployees'
import { useProjects } from '@/hooks/useProjects'
import { employeeService } from '@/firebase/employeeService'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, Clock, CheckCircle2, Coffee, Info, Briefcase, Circle, Loader2 } from 'lucide-react'
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, TooltipPortal } from '@/components/ui/tooltip'
import SettingsPage from '@/pages/Settings'
// Ensure strict import
import type { LeaveRecord } from '@/store/slices/employeesSlice';
import { LayoutDashboard, Settings as SettingsIconTab } from 'lucide-react'

export default function EmployeeDashboard() {
    const navigate = useNavigate()
    const { user, loading: authLoading } = useAuth()
    const { employees, loading: employeesLoading } = useEmployees()
    const { projects } = useProjects()
    const [currentEmployee, setCurrentEmployee] = useState<any>(null)
    const [isProcessing, setIsProcessing] = useState(false)

    // Find the current employee record based on Auth UID
    useEffect(() => {
        if (user && employees.length > 0) {
            const found = employees.find(e => e.authUid === user.uid || e.email === user.email)
            setCurrentEmployee(found || null)
        }
    }, [user, employees])

    const handleLeaveToggle = async (checked: boolean) => {
        if (!currentEmployee || !currentEmployee.id) return
        setIsProcessing(true)

        try {
            const today = new Date().toISOString()
            let newHistory = currentEmployee.leaveHistory || []

            if (checked) {
                // MARKING AS ON LEAVE
                const newRecord: LeaveRecord = {
                    id: `leave-${Date.now()}`,
                    date: today,
                    type: 'Full Day',
                    status: 'Approved',
                    reason: 'Full Day Leave (10am - 7pm)'
                }
                newHistory = [newRecord, ...newHistory]

                await employeeService.updateEmployee(currentEmployee.id, {
                    isOnLeave: true,
                    leaveDate: today,
                    leaveHistory: newHistory
                })
                toast.success("You are now marked as On Leave")
            } else {
                // MARKING AS AVAILABLE
                // We keep the history record, just update current status
                await employeeService.updateEmployee(currentEmployee.id, {
                    isOnLeave: false,
                    leaveDate: null
                })
                toast.success("Welcome back! You are marked as Available")
            }
        } catch (error) {
            console.error(error)
            toast.error("Failed to update status")
        } finally {
            setIsProcessing(false)
        }
    }

    // Compute Work Stats
    const myProjects = useMemo(() => {
        if (!currentEmployee) return [];
        const myName = currentEmployee.name;

        return projects.filter(p => {
            if (!myName) return false;

            // 0. Check Assigned Team
            if (currentEmployee.team?.trim()) {
                const team = currentEmployee.team.trim();
                if (p.assignedTeams?.includes(team)) return true;
                if (p.assignedTeam?.trim() && p.assignedTeam.trim() === team) return true;
            }

            // 1. Check Dev Team
            const inDevTeam = p.devTeam?.some((dev: any) => (typeof dev === 'string' ? dev : dev.name) === myName);
            if (inDevTeam) return true;

            // 2. Check Assigned Tasks
            if (p.milestones && Array.isArray(p.milestones)) {
                return p.milestones.some((task: any) => {
                    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
                    return assignees.some((a: any) => (typeof a === 'string' ? a : a.name) === myName);
                });
            }
            return false;
        });
    }, [currentEmployee, projects]);

    const workStats = useMemo(() => {
        if (!currentEmployee) return { projects: 0, pending: 0, inProgress: 0, completed: 0 }

        let pending = 0;
        let inProgress = 0;
        let completed = 0;
        const myName = currentEmployee.name;

        myProjects.forEach(p => {
            const milestones = p.milestones || [];
            milestones.forEach((task: any) => {
                const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
                const isAssigned = assignees.some((a: any) => (typeof a === 'string' ? a : a.name) === myName);
                if (isAssigned) {
                    if (task.status === 'Pending') pending++;
                    else if (task.status === 'In Progress') inProgress++;
                    else if (task.status === 'Completed' || task.status === 'Delivered') completed++;
                }
            });
        });

        return { projects: myProjects.length, pending, inProgress, completed };
    }, [myProjects, currentEmployee]);

    if (authLoading || (employeesLoading && !currentEmployee)) {
        return (
            <div className="flex bg-slate-50 items-center justify-center h-screen w-full">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        )
    }

    if (!currentEmployee) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50 gap-4">
                <p className="text-muted-foreground">Profile not found. Please contact admin.</p>
                <div className="text-xs text-slate-400">
                    Debug: {user?.email} (Auth) vs {employees.length} employees loaded.
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50/50 pb-10 overflow-x-hidden">
            {/* Header / Welcome Section */}
            <div className="relative bg-white border-b overflow-hidden shadow-sm">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-50 to-indigo-50/50 opacity-50"></div>
                <div className="relative px-4 sm:px-6 pt-6 sm:pt-8 pb-0">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                        <div className="space-y-1">
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                                Welcome back, {currentEmployee.name.split(' ')[0]}!
                            </h1>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <span className="flex items-center gap-1.5 text-sm font-medium">
                                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    {currentEmployee.authUid ? currentEmployee.authUid.substring(0, 4) : 'sksn'} • {currentEmployee.department}
                                </span>
                            </div>
                        </div>

                        <Card className="border-none shadow-sm bg-white/50 backdrop-blur-sm">
                            <CardContent className="p-3 flex items-center gap-4">
                                <div className="text-right hidden sm:block">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date</p>
                                    <p className="text-sm font-semibold text-slate-700">{format(new Date(), 'EEE, MMM d')}</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Tabs defaultValue="overview" className="w-full">
                        <div className="flex flex-col gap-0">
                            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-8">
                                <TabsTrigger 
                                    value="overview" 
                                    className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 py-4 text-sm font-bold flex items-center gap-2"
                                >
                                    <LayoutDashboard className="h-4 w-4" />
                                    Overview
                                </TabsTrigger>
                                <TabsTrigger 
                                    value="settings" 
                                    className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 py-4 text-sm font-bold flex items-center gap-2"
                                >
                                    <SettingsIconTab className="h-4 w-4" />
                                    Settings
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="overview" className="p-4 sm:p-6 space-y-6 m-0 focus-visible:outline-none">
                                {/* Main Status Grid */}
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

                                    {/* Daily Status Card */}
                                    <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300 md:col-span-1 bg-white ring-1 ring-slate-100">
                                        <div className="absolute top-0 right-0 p-3 opacity-5">
                                            <Coffee className="h-24 w-24 translate-x-4 -translate-y-4" />
                                        </div>
                                        <CardHeader className="pb-2">
                                            <div className="flex items-center gap-2 text-rose-500 mb-1">
                                                <Clock className="h-4 w-4" />
                                                <span className="text-xs font-bold uppercase tracking-wider">Attendance</span>
                                            </div>
                                            <CardTitle className="text-lg">Daily Check-in</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 mt-2">
                                                <div className="space-y-0.5">
                                                    <label className="text-sm font-semibold text-slate-900 block">
                                                        Mark Leave
                                                    </label>
                                                    <span className="text-xs text-muted-foreground">
                                                        Check in for full day (10am - 7pm)
                                                    </span>
                                                </div>
                                                <Switch
                                                    checked={isProcessing ? !currentEmployee.isOnLeave : currentEmployee.isOnLeave}
                                                    onCheckedChange={handleLeaveToggle}
                                                    disabled={isProcessing}
                                                    className="data-[state=checked]:bg-rose-500"
                                                />
                                            </div>
                                            {currentEmployee.isOnLeave && (
                                                <div className="flex items-start gap-3 p-3 bg-amber-50 text-amber-800 rounded-lg text-sm border border-amber-100 animate-in fade-in slide-in-from-top-1 mt-4">
                                                    <Info className="h-5 w-5 shrink-0 text-amber-600" />
                                                    <p>You are marked as on leave for today (10am - 7pm).</p>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Work Overview Stats */}
                                    <Card className="border-none shadow-md md:col-span-2 bg-white ring-1 ring-slate-100">
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-lg">Work Overview</CardTitle>
                                            <CardDescription>Your current project workload and task status.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                                            {/* Total Projects */}
                                            <div className="flex flex-col p-4 rounded-xl bg-purple-50/50 border border-purple-100/50 transition-colors hover:bg-purple-50">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Briefcase className="h-4 w-4 text-purple-600" />
                                                    <span className="text-[10px] font-bold text-purple-600/80 uppercase tracking-wider">Projects</span>
                                                </div>
                                                <span className="text-2xl font-bold text-slate-900">{workStats.projects}</span>
                                            </div>

                                            {/* In Progress */}
                                            <div className="flex flex-col p-4 rounded-xl bg-blue-50/50 border border-blue-100/50 transition-colors hover:bg-blue-50">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                                                    <span className="text-[10px] font-bold text-blue-600/80 uppercase tracking-wider">In Progress</span>
                                                </div>
                                                <span className="text-2xl font-bold text-slate-900">{workStats.inProgress}</span>
                                            </div>

                                            {/* Completed */}
                                            <div className="flex flex-col p-4 rounded-xl bg-emerald-50/50 border border-emerald-100/50 transition-colors hover:bg-emerald-50">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                    <span className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-wider">Completed</span>
                                                </div>
                                                <span className="text-2xl font-bold text-slate-900">{workStats.completed}</span>
                                            </div>

                                            {/* Pending */}
                                            <div className="flex flex-col p-4 rounded-xl bg-amber-50/50 border border-amber-100/50 transition-colors hover:bg-amber-50">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Circle className="h-4 w-4 text-amber-600" />
                                                    <span className="text-[10px] font-bold text-amber-600/80 uppercase tracking-wider">Pending</span>
                                                </div>
                                                <span className="text-2xl font-bold text-slate-900">{workStats.pending}</span>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* Assigned Projects Table */}
                                    <Card className="col-span-1 md:col-span-2 lg:col-span-3 shadow-md border-0 bg-white ring-1 ring-slate-100 mt-0">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-lg">Assigned Projects</CardTitle>
                                            <CardDescription>Projects you are part of.</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            {myProjects.length === 0 ? (
                                                <div className="text-center py-8 text-muted-foreground text-sm">
                                                    No projects assigned.
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <Table>
                                                        <TableHeader className="bg-slate-50">
                                                            <TableRow>
                                                                <TableHead className="font-semibold text-slate-500">Project Name</TableHead>
                                                                <TableHead className="font-semibold text-slate-500">Client</TableHead>
                                                                <TableHead className="font-semibold text-slate-500">Status</TableHead>
                                                                <TableHead className="font-semibold text-slate-500 text-right">End Date</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {myProjects.map((project: any) => (
                                                                <TableRow
                                                                    key={project.id}
                                                                    className="hover:bg-slate-50/50 cursor-pointer"
                                                                    onClick={() => navigate(`/tasks/${project.id}`)}
                                                                >
                                                                    <TableCell className="font-medium text-slate-900">
                                                                        <div className="flex items-center gap-2">
                                                                            {project.name}
                                                                            {project.trackerComment && (
                                                                                <TooltipProvider delayDuration={0}>
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger asChild>
                                                                                            <Info className="h-4 w-4 text-red-600 animate-pulse shrink-0" />
                                                                                        </TooltipTrigger>
                                                                                        <TooltipPortal>
                                                                                            <TooltipContent className="max-w-[400px] p-5 bg-white shadow-2xl border-2 border-red-500 rounded-xl text-slate-900">
                                                                                                <p className="text-xs font-semibold text-red-600 uppercase tracking-tight mb-2">Admin Note</p>
                                                                                                <p className="text-sm leading-relaxed font-medium">{project.trackerComment}</p>
                                                                                            </TooltipContent>
                                                                                        </TooltipPortal>
                                                                                    </Tooltip>
                                                                                </TooltipProvider>
                                                                            )}
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="text-slate-500">
                                                                        {project.client}
                                                                    </TableCell>
                                                                    <TableCell>
                                                                        <Badge variant="outline" className={cn(
                                                                            "font-normal border-slate-200",
                                                                            project.status === 'Completed' ? "bg-emerald-50 text-emerald-600" :
                                                                                project.status === 'In Progress' ? "bg-blue-50 text-blue-600" :
                                                                                    "bg-slate-100 text-slate-600"
                                                                        )}>
                                                                            {project.status}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="text-slate-500 text-right">
                                                                        {project.endDate || "—"}
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </div>

                                {/* Leave History Table */}
                                <Card className="shadow-md border-0 bg-white ring-1 ring-slate-100">
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <div>
                                            <CardTitle>Leave History</CardTitle>
                                            <CardDescription>A record of all your past leaves.</CardDescription>
                                        </div>

                                    </CardHeader>
                                    <CardContent>
                                        {!currentEmployee.leaveHistory || currentEmployee.leaveHistory.length === 0 ? (
                                            <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed">
                                                <div className="mx-auto h-12 w-12 text-slate-300 mb-3">
                                                    <CalendarIcon className="h-full w-full" />
                                                </div>
                                                <h3 className="text-lg font-medium text-slate-900">No leave history</h3>
                                                <p className="text-slate-500 max-w-sm mx-auto mt-1">
                                                    You haven't taken any leaves yet. Consistent attendance is key to success!
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border overflow-hidden">
                                                <Table>
                                                    <TableHeader className="bg-slate-50">
                                                        <TableRow>
                                                            <TableHead className="font-semibold text-slate-500">Date</TableHead>
                                                            <TableHead className="font-semibold text-slate-500">Type</TableHead>
                                                            <TableHead className="font-semibold text-slate-500">Reason</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {[...currentEmployee.leaveHistory].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((record: any) => (
                                                            <TableRow key={record.id} className="hover:bg-slate-50/50">
                                                                <TableCell className="font-medium text-slate-900">
                                                                    {(() => {
                                                                        try {
                                                                            return format(new Date(record.date), 'MMMM d, yyyy')
                                                                        } catch (e) {
                                                                            return record.date
                                                                        }
                                                                    })()}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className="font-normal bg-slate-100 text-slate-600 border-slate-200">
                                                                        {record.type}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-slate-500 max-w-[200px] truncate">
                                                                    {record.reason || "—"}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="settings" className="m-0 focus-visible:outline-none">
                                <SettingsPage />
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </div>

        </div>
    )
}

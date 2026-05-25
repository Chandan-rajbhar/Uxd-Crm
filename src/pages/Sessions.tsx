import { useEffect, useState, useMemo } from 'react'
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "src/components/ui/table"
import { Badge } from "src/components/ui/badge"
import { Button } from "src/components/ui/button"
import { Input } from "src/components/ui/input"
import { 
    Search, 
    Monitor, 
    Clock, 
    Loader2, 
    Smartphone, 
    Laptop, 
    User as UserIcon,
    LogOut,
    ShieldAlert,
    Settings2,
    ArrowRight
} from "lucide-react"

interface EnrichedSession {
    id: string;
    uid: string;
    sessionId: string;
    deviceName: string;
    lastSeen: number;
    userAgent: string;
    isCurrent?: boolean;
    location?: string;
    ip?: string;
    resolution?: string;
    network?: string;
    registeredAt?: any;
    employeeName: string;
    employeeEmail: string;
    employeeId: string | undefined;
    permittedDevices: number;
    isActive: boolean;
    isPriority: boolean;
}
import { subscribeToDetailedSessions } from "src/firebase/sessionService"
import { useEmployees } from "src/hooks/useEmployees"
import { employeeService } from "src/firebase/employeeService"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { httpsCallable } from "firebase/functions"
import { functions } from "src/firebase/config"
import { toast } from "sonner"
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
} from "src/components/ui/alert-dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "src/components/ui/select"

interface Session {
    id: string;
    uid: string;
    sessionId: string;
    deviceName: string;
    lastSeen: number;
    userAgent: string;
    isCurrent?: boolean;
    isActive?: boolean;
}

export default function SessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [search, setSearch] = useState('')
    const { employees, loading: employeesLoading } = useEmployees()
    const [revokingId, setRevokingId] = useState<string | null>(null)
    const [updatingLimitId, setUpdatingLimitId] = useState<string | null>(null)
    const [showAll, setShowAll] = useState(false)

    useEffect(() => {
        const unsubscribe = subscribeToDetailedSessions((allSessions) => {
            setSessions(allSessions);
            setIsLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const enrichedSessions = useMemo((): EnrichedSession[] => {
        const rows: EnrichedSession[] = [];
        const now = Date.now();
        const activeThreshold = 24 * 60 * 60 * 1000;

        const isPriorityMember = (employee: any) => {
            const dept = (employee.department || '').toLowerCase();
            const role = (employee.role || '').toLowerCase();
            return dept.includes('hr') || 
                   dept.includes('marketing') || 
                   dept.includes('bde') || 
                   role.includes('hr') || 
                   role.includes('marketing') || 
                   role.includes('bd');
        };

        employees.forEach(employee => {
            const employeeSessions = sessions.filter(s => s.uid === (employee.authUid || employee.uid || employee.id));
            const priority = isPriorityMember(employee);
            
            if (employeeSessions.length === 0) {
                // No session ever recorded
                rows.push({
                    id: `empty-${employee.id}`,
                    uid: employee.authUid || employee.uid || employee.id || '',
                    sessionId: '',
                    deviceName: 'No active device',
                    lastSeen: 0,
                    userAgent: '',
                    employeeId: employee.id,
                    employeeName: employee.name,
                    employeeEmail: employee.email,
                    permittedDevices: employee.permittedDevices ?? 1,
                    isActive: false,
                    isPriority: priority
                } as EnrichedSession);
            } else {
                // Separate active and inactive
                const activeSessions = employeeSessions.filter(s => {
                    const isWithinThreshold = (now - s.lastSeen) < activeThreshold;
                    return s.isActive !== false && isWithinThreshold;
                });
                
                if (activeSessions.length > 0) {
                    activeSessions.forEach(session => {
                        rows.push({
                            ...session,
                            employeeId: employee.id,
                            employeeName: employee.name,
                            employeeEmail: employee.email,
                            permittedDevices: employee.permittedDevices ?? 1,
                            isActive: true,
                            isPriority: priority
                        } as EnrichedSession);
                    });
                } else {
                    // All inactive, show the most recent one to see the "Last seen" info
                    const mostRecent = [...employeeSessions].sort((a,b) => b.lastSeen - a.lastSeen)[0];
                    rows.push({
                        ...mostRecent,
                        employeeId: employee.id,
                        employeeName: employee.name,
                        employeeEmail: employee.email,
                        permittedDevices: employee.permittedDevices ?? 1,
                        isActive: false,
                        isPriority: priority
                    } as EnrichedSession);
                }
            }
        });

        return rows.sort((a, b) => {
            // Sort by priority first (true > false)
            if (a.isPriority && !b.isPriority) return -1;
            if (!a.isPriority && b.isPriority) return 1;
            
            // Then by active (true > false)
            if (a.isActive && !b.isActive) return -1;
            if (!a.isActive && b.isActive) return 1;
            
            return a.employeeName.localeCompare(b.employeeName);
        });
    }, [sessions, employees]);

    const filteredSessions = enrichedSessions.filter(s => 
        s.employeeName.toLowerCase().includes(search.toLowerCase()) ||
        s.employeeEmail.toLowerCase().includes(search.toLowerCase()) ||
        s.deviceName.toLowerCase().includes(search.toLowerCase())
    );

    const displaySessions = useMemo(() => {
        if (showAll || search.trim() !== '') return filteredSessions;
        return filteredSessions.filter(s => s.isPriority);
    }, [filteredSessions, showAll, search]);

    const hiddenCount = filteredSessions.length - displaySessions.length;

    const handleUpdateLimit = async (employeeId: string, limit: number, uid?: string, name?: string) => {
        setUpdatingLimitId(employeeId);
        try {
            await employeeService.updateEmployee(employeeId, { permittedDevices: limit });
            toast.success(limit === 0 ? "User blocked and sessions revoked" : "Device limit updated successfully");
            
            // If blocking (limit 0), also force logout all devices immediately
            if (limit === 0 && uid && name) {
                await handleForceLogout(uid, name);
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to update device limit");
        } finally {
            setUpdatingLimitId(null);
        }
    };

    const handleForceLogout = async (uid: string, employeeName: string) => {
        setRevokingId(uid);
        try {
            const logoutFn = httpsCallable(functions, 'logoutAllDevices');
            await logoutFn({ targetUid: uid });
            toast.success(`Successfully revoked all sessions for ${employeeName}`);
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to revoke sessions.");
        } finally {
            setRevokingId(null);
        }
    };

    const getDeviceIcon = (deviceName: string) => {
        const name = deviceName.toLowerCase();
        if (name.includes('iphone') || name.includes('android')) return <Smartphone className="h-4 w-4" />;
        if (name.includes('mac') || name.includes('windows') || name.includes('linux') || name.includes('pc')) return <Laptop className="h-4 w-4" />;
        return <Monitor className="h-4 w-4" />;
    };

    if (isLoading || employeesLoading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse font-medium">Monitoring active sessions...</p>
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-4 p-4 pt-3 md:p-8 md:pt-6 min-h-[calc(100vh-4.5rem)]">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-xl md:text-3xl font-bold tracking-tight">Session Management</h2>
                    <p className="text-muted-foreground text-xs md:text-sm mt-1">
                        Monitoring active device sessions across the organization.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-48 md:w-72">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search employee or device..."
                            className="pl-9 h-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="md:hidden space-y-3">
                {displaySessions.map((session) => {
                    const userSessionsCount = enrichedSessions.filter(s => s.uid === session.uid && s.isActive).length;
                    const isOverLimit = userSessionsCount > session.permittedDevices;
                    
                    return (
                        <div key={session.id} className={cn(
                            "bg-white rounded-xl border p-4 shadow-sm transition-all",
                            isOverLimit && "border-destructive/30 bg-destructive/[0.01]"
                        )}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/5 flex items-center justify-center">
                                        <UserIcon className="h-5 w-5 text-primary" />
                                    </div>
                                    <div className="flex flex-col">
                                        <h3 className="text-sm font-bold text-slate-900 leading-tight flex items-center gap-1.5">
                                            {session.employeeName}
                                            {isOverLimit && <ShieldAlert className="h-3.5 w-3.5 text-destructive" />}
                                        </h3>
                                        <p className="text-[11px] text-slate-500 font-medium">{session.employeeEmail}</p>
                                    </div>
                                </div>
                                <Badge variant={session.isActive ? "secondary" : "outline"} className={cn(
                                    "font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full",
                                    session.isActive 
                                        ? "bg-emerald-50 text-emerald-600 border-emerald-200" 
                                        : "bg-slate-50 text-slate-400 border-slate-200"
                                )}>
                                    {session.isActive ? 'Active' : 'Idle'}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                                <div className="space-y-2">
                                    <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Device Details</span>
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                                            {getDeviceIcon(session.deviceName)}
                                            {session.deviceName}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                            <Monitor className="h-3 w-3" />
                                            {session.resolution || 'Auto'}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest">Network / Loc</span>
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                            {session.location?.split(',')[0] || 'Unknown'}
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-mono pl-3">{session.ip || '0.0.0.0'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[10px] text-slate-400 font-medium">Device Usage</span>
                                        <div className={cn(
                                            "text-xs font-black px-2 py-0.5 rounded-md border tabular-nums",
                                            isOverLimit ? "bg-destructive text-white border-destructive" : "bg-blue-50 text-blue-600 border-blue-100"
                                        )}>
                                            {userSessionsCount} / {session.permittedDevices}
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-0.5">
                                        <span className="text-[10px] text-slate-400 font-medium text-right">Last Action</span>
                                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                                            <Clock className="h-3 w-3 text-slate-400" />
                                            {session.lastSeen > 0 ? formatDistanceToNow(session.lastSeen, { addSuffix: true }) : 'Never'}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2 border-t border-slate-100">
                                    <Select
                                        value={session.permittedDevices.toString()}
                                        onValueChange={(val) => session.employeeId && handleUpdateLimit(session.employeeId, parseInt(val), session.uid, session.employeeName)}
                                        disabled={updatingLimitId === session.employeeId}
                                    >
                                        <SelectTrigger className="h-9 text-[11px] bg-white flex-1 font-bold">
                                            <div className="flex items-center gap-2">
                                                <Settings2 className="h-3.5 w-3.5" />
                                                Max: <SelectValue />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {[0, 1, 2, 3, 4, 5, 10, 20].map(num => (
                                                <SelectItem key={num} value={num.toString()} className="text-[11px] font-medium">
                                                    {num === 0 ? '0 (Blocked)' : `${num} ${num === 1 ? 'Device' : 'Devices'}`}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="h-9 text-destructive border-destructive/20 hover:bg-destructive/5 hover:text-destructive text-[11px] font-bold px-4"
                                                disabled={revokingId === session.uid}
                                            >
                                                {revokingId === session.uid ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                                                ) : (
                                                    <LogOut className="h-3.5 w-3.5 mr-2" />
                                                )}
                                                Force Terminate
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Kill All Sessions?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will instantly log **{session.employeeName}** out from **all {userSessionsCount}** active devices.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction 
                                                    onClick={() => handleForceLogout(session.uid, session.employeeName)}
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                    Confirm Kill
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </div>
                        </div>
                    );
                })}
                {hiddenCount > 0 && !showAll && !search && (
                    <div className="flex justify-center p-4">
                        <button 
                            onClick={() => setShowAll(true)}
                            className="text-sm font-medium text-primary hover:underline transition-all"
                        >
                            See {hiddenCount} more members
                        </button>
                    </div>
                )}
            </div>

            <div className="hidden md:block">
                <Table>
                    <TableHeader className="bg-gray-50/50">
                        <TableRow>
                            <TableHead className="w-[250px] py-3 text-xs font-semibold text-slate-500">Employee</TableHead>
                            <TableHead className="py-3 text-xs font-semibold text-slate-500">Device</TableHead>
                            <TableHead className="py-3 text-xs font-semibold text-slate-500">Location</TableHead>
                            <TableHead className="py-3 text-xs font-semibold text-slate-500">Activity</TableHead>
                            <TableHead className="py-3 text-xs font-semibold text-slate-500">Usage</TableHead>
                            <TableHead className="w-[120px] py-3 text-xs font-semibold text-slate-500">Max Limit</TableHead>
                            <TableHead className="text-right py-3 text-xs font-semibold text-slate-500">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredSessions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                                    No active sessions found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            displaySessions.map((session) => {
                                const userSessionsCount = enrichedSessions.filter(s => s.uid === session.uid && s.isActive).length;
                                const isOverLimit = userSessionsCount > session.permittedDevices;
                                
                                return (
                                    <TableRow key={session.id} className={cn(
                                        "hover:bg-slate-50/50 transition-colors border-b border-slate-100",
                                        isOverLimit && "bg-destructive/[0.02]"
                                    )}>
                                        <TableCell className="py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                                    <UserIcon className="h-4 w-4 text-slate-500" />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-sm font-medium text-slate-900 truncate">
                                                            {session.employeeName}
                                                        </span>
                                                        {isOverLimit && <ShieldAlert className="h-3.5 w-3.5 text-destructive" />}
                                                    </div>
                                                    <span className="text-[11px] text-slate-400 truncate">
                                                        {session.employeeEmail}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <div className="flex items-center gap-2 text-slate-600">
                                                {getDeviceIcon(session.deviceName)}
                                                <span className="text-xs font-medium">{session.deviceName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-medium text-slate-600">{session.location || 'Unknown'}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">{session.ip || '0.0.0.0'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-1.5">
                                                    <div className={cn(
                                                        "h-1.5 w-1.5 rounded-full",
                                                        session.isActive ? "bg-emerald-500" : "bg-slate-300"
                                                    )} />
                                                    <span className="text-[11px] font-medium text-slate-600">
                                                        {session.isActive ? 'Active' : 'Offline'}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] text-slate-400 pl-3">
                                                    {session.lastSeen > 0 ? formatDistanceToNow(session.lastSeen, { addSuffix: true }) : 'Never'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <Badge variant="outline" className={cn(
                                                "font-semibold text-[10px] px-2 py-0 rounded-md tabular-nums",
                                                isOverLimit 
                                                    ? "bg-destructive/5 text-destructive border-destructive/20" 
                                                    : "bg-blue-50/50 text-blue-600 border-blue-100"
                                            )}>
                                                {userSessionsCount} / {session.permittedDevices}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="py-3">
                                            <Select
                                                value={session.permittedDevices.toString()}
                                                onValueChange={(val) => session.employeeId && handleUpdateLimit(session.employeeId, parseInt(val), session.uid, session.employeeName)}
                                                disabled={updatingLimitId === session.employeeId}
                                            >
                                                <SelectTrigger className="w-24 h-7 text-[11px] font-medium bg-white border-slate-200">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[0, 1, 2, 3, 4, 5, 10, 20].map(num => (
                                                        <SelectItem key={num} value={num.toString()} className="text-[11px] font-medium">
                                                            {num === 0 ? '0 (Blocked)' : `${num} ${num === 1 ? 'Device' : 'Devices'}`}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="text-right py-3">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="sm" 
                                                        className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/5 rounded-md"
                                                        disabled={revokingId === session.uid}
                                                    >
                                                        {revokingId === session.uid ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <LogOut className="h-3.5 w-3.5" />
                                                        )}
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Revoke Session Access?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Logout **{session.employeeName}** from all active devices.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction 
                                                            onClick={() => handleForceLogout(session.uid, session.employeeName)}
                                                            className="bg-destructive text-white hover:bg-destructive/90"
                                                        >
                                                            Revoke Access
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                        {hiddenCount > 0 && !showAll && !search && (
                            <TableRow>
                                <TableCell colSpan={7} className="py-6">
                                    <div className="flex justify-center">
                                        <button 
                                            onClick={() => setShowAll(true)}
                                            className="text-sm font-medium text-primary hover:underline transition-all flex items-center gap-2"
                                        >
                                            <span>See {hiddenCount} more members</span>
                                            <ArrowRight className="h-3 w-3" />
                                        </button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}

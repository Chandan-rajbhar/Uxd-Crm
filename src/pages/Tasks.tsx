import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useNavigate } from "react-router-dom"
import { useProjects } from "src/hooks/useProjects"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { projectService } from "src/firebase/projectService"
import { ClipboardList, /* Mail, */ Lock, Users, UserX } from "lucide-react"
import { format, isToday, parseISO } from "date-fns"
import { toast } from "sonner"
import { useRef, useEffect, useState } from "react"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "src/components/ui/empty"
import { MagnifyingGlassLoader } from "@/components/MagnifyingGlassLoader"
import { settingsService } from "src/firebase/settingsService"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { ProjectCredentialsSheet } from "@/components/ProjectCredentialsSheet"
import { SendAIUpdateSheet } from "src/components/SendAIUpdateSheet"
import { MailHistorySheet } from "src/components/MailHistorySheet"
import { CommentHistorySheet } from "src/components/CommentHistorySheet"
import { parseRobustDate } from "src/utils/dateUtils"
import { useAuth } from "src/contexts/AuthContext"
import { useEmployees } from "src/hooks/useEmployees"
import { History, Send, Loader2 } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"


export default function TasksPage() {
    const navigate = useNavigate()
    const { projects, loading } = useProjects()
    const [tasks, setTasks] = useState<any[]>([])
    const processingRefs = useRef<Set<string>>(new Set());

    // Filter State
    const [selectedTeam, setSelectedTeam] = useState<string>(() => localStorage.getItem('tracker_selectedTeam') || "all")
    const [selectedCategory, setSelectedCategory] = useState<string>(() => localStorage.getItem('tracker_selectedCategory') || "Development")
    const [availableTeams, setAvailableTeams] = useState<string[]>([])
    const [showUnassignedOnly, setShowUnassignedOnly] = useState<boolean>(() => localStorage.getItem('tracker_showUnassignedOnly') === 'true')
    // Mail State
    const [isMailSheetOpen, setIsMailSheetOpen] = useState(false)
    const [projectForMail, setProjectForMail] = useState<any>(null)
    const [historyProject, setHistoryProject] = useState<any>(null)
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [selectedProjectCreds, setSelectedProjectCreds] = useState<any>(null)
    const [isCredsOpen, setIsCredsOpen] = useState(false)

    const { user, isAdmin } = useAuth()
    const { employees } = useEmployees()
    const currentEmployee = employees.find(e => e.authUid === user?.uid || e.email === user?.email)

    // Reset team when Switching to Digital Marketing
    useEffect(() => {
        if (selectedCategory === "Digital Marketing") {
            setSelectedTeam("all");
        }
        localStorage.setItem('tracker_selectedCategory', selectedCategory);
    }, [selectedCategory]);

    // Save Other Filters
    useEffect(() => {
        localStorage.setItem('tracker_selectedTeam', selectedTeam);
    }, [selectedTeam]);

    useEffect(() => {
        localStorage.setItem('tracker_showUnassignedOnly', String(showUnassignedOnly));
    }, [showUnassignedOnly]);

    // Subscribe to teams
    useEffect(() => {
        const unsubscribe = settingsService.subscribeToTeams((teams: any) => {
            setAvailableTeams(teams || []);
        });
        return () => unsubscribe();
    }, []);

    // Sync projects to local tasks state and handle day rollover
    useEffect(() => {
        if (projects.length > 0) {
            const todayStr = format(new Date(), 'yyyy-MM-dd');

            const mappedTasks = projects.map(p => {
                // Check if we need to migrate yesterday's tasks to timeline
                const lastDate = p.lastTaskDate || null;

                // Support both locale-specific and ISO dates for comparison
                let needsMigration = false;
                if (((p.notes && p.notes.trim().length > 0) || (p.trackerComment && p.trackerComment.trim().length > 0)) && lastDate) {
                    try {
                        // If it matches todayStr exactly, no migration
                        if (lastDate !== todayStr) {
                            // Verify if it's actually a different day to be safe
                            const lastDateObj = lastDate.includes('-') ? parseISO(lastDate) : new Date(lastDate);
                            if (!isToday(lastDateObj)) {
                                needsMigration = true;
                            }
                        }
                    } catch (e) {
                        // Fallback to simple string comparison if parsing fails
                        needsMigration = lastDate !== todayStr;
                    }
                }

                if (needsMigration && !processingRefs.current.has(p.id!)) {
                    return { ...p, needsMigration: true, oldNotes: p.notes, oldComment: p.trackerComment } as any;
                }

                // Calculate unique assignees from team and visible milestones
                const milestoneAssignees = (p.milestones || []).flatMap((m: any) => {
                    if (!m.assignedTo) return [];
                    return Array.isArray(m.assignedTo) ? m.assignedTo : [m.assignedTo];
                });

                const allAssignees = [
                    ...(p.devTeam || []),
                    ...(p.qaTeam || []),
                    ...milestoneAssignees
                ];

                // Deduplicate by name and filter out Unassigned
                const uniqueAssignees = Array.from(
                    new Map(allAssignees.map((a: any) => [a.name, a])).values()
                ).filter((a: any) => a.name && a.name !== 'Unassigned');

                return {
                    id: p.id,
                    project: {
                        name: p.name,
                        logo: p.logo
                    },
                    todaysTasks: p.notes ? p.notes.split('\n') : [""],
                    milestones: p.milestones || [],
                    devAssigned: uniqueAssignees,
                    qaAssigned: [], // Combined into devAssigned for display
                    team: p.assignedTeam || (p.assignedTeams && p.assignedTeams[0]) || "Team A",
                    category: p.category || "Development",
                    status: p.status,
                    lastTaskDate: p.lastTaskDate
                };
            });

            // Handle migrations
            // We filter out the ones that aren't the mapped structure above
            const tasksToView = mappedTasks.filter(t => !t.needsMigration);
            setTasks(tasksToView);

            // Process migrations
            mappedTasks.filter(t => t.needsMigration).forEach(async (p: any) => {
                if (processingRefs.current.has(p.id)) return;
                processingRefs.current.add(p.id);

                try {
                    // 1. Create milestones from old notes
                    const tasksFromNotes = p.oldNotes.split('\n').filter((t: string) => t.trim().length > 0);
                    if (tasksFromNotes.length === 0) {
                        await projectService.updateProject(p.id, { lastTaskDate: todayStr });
                        processingRefs.current.delete(p.id);
                        return;
                    }

                    // Perform the migration via a transaction to ensure no data loss
                    await projectService.migrateTasks(p.id, tasksFromNotes, p.lastTaskDate || todayStr, todayStr, p.oldComment);

                } catch (err) {
                    console.error("Migration failed for", p.name, err);
                } finally {
                    setTimeout(() => {
                        processingRefs.current.delete(p.id);
                    }, 2000);
                }
            });

        }
    }, [projects])

    // Filter tasks based on selections
    const filteredTasks = tasks.filter(task => {
        // Find the original project object to check assigned teams accurately
        const p = projects.find(proj => proj.id === task.id);
        if (!p) return false;

        const isInternal = p.category === 'Internal' || !p.client || p.client === 'None' || p.client?.toLowerCase().includes('internal');

        let categoryMatch = false;
        if (selectedCategory === 'Internal') {
            categoryMatch = isInternal;
        } else {
            categoryMatch = p.category === selectedCategory && !isInternal;
        }

        const teamMatch = selectedTeam === "all" ||
            (p.assignedTeam === selectedTeam) ||
            (Array.isArray(p.assignedTeams) && p.assignedTeams.includes(selectedTeam));

        // Unassigned Check:
        // 1. No team assigned AND no teams in assignedTeams array
        // 2. OR No individual employees assigned to any milestones (Assigned To column empty)
        const isTeamUnassigned = !p.assignedTeam && (!p.assignedTeams || p.assignedTeams.length === 0);
        const isIndividualUnassigned = task.devAssigned.length === 0;

        const isUnassigned = isTeamUnassigned || isIndividualUnassigned;
        const unassignedMatch = !showUnassignedOnly || isUnassigned;

        return teamMatch && categoryMatch && unassignedMatch;
    });

    const handleViewDetails = (taskId: string) => {
        navigate(`/tasks/${taskId}`)
    }

    const handleOpenMailSheet = (project: any) => {
        setProjectForMail(project)
        setIsMailSheetOpen(true)
    }

    const handleOpenHistory = (project: any) => {
        setHistoryProject(project)
        setIsHistoryOpen(true)
    }

    return (
        <div className="flex flex-1 flex-col space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Project Tracker</h1>
                    <p className="text-muted-foreground">
                        Track daily tasks and team assignments.
                    </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-3 py-1 rounded-full border border-slate-100 shadow-sm">
                        {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>

                    <div className="flex items-center gap-6 bg-white/50 backdrop-blur-sm p-1.5 rounded-2xl border border-slate-200/60 shadow-sm">
                        {/* Team Filters - Only show for non-Digital Marketing categories */}
                        {selectedCategory !== "Digital Marketing" && (
                            <>
                                <div className="flex items-center gap-1.5 px-2">
                                    <Users className="h-3.5 w-3.5 text-slate-400 mr-1" />
                                    <button
                                        onClick={() => setSelectedTeam("all")}
                                        className={cn(
                                            "px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                                            selectedTeam === "all"
                                                ? "bg-blue-50/80 text-blue-600 shadow-sm border border-blue-100 scale-105"
                                                : "text-slate-400 hover:bg-slate-100/50 hover:text-slate-600"
                                        )}
                                    >
                                        All Teams
                                    </button>
                                    {(availableTeams.length > 0 ? availableTeams : ['Team A', 'Team B', 'Team C', 'Team D'])
                                        .filter(team => ['Team A', 'Team B', 'Team C', 'Team D'].includes(team))
                                        .map(team => (
                                            <button
                                                key={team}
                                                onClick={() => setSelectedTeam(team)}
                                                className={cn(
                                                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                                                    selectedTeam === team
                                                        ? "bg-primary text-white shadow-md shadow-primary/20 scale-105"
                                                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                                )}
                                            >
                                                {team}
                                            </button>
                                        ))}
                                </div>
                                <Separator orientation="vertical" className="h-6 bg-slate-200" />
                            </>
                        )}

                        {/* Category Filter Tabs */}
                        <div className="flex items-center gap-1.5 px-2">
                            <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-[450px]">
                                <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
                                    <TabsTrigger value="Development" className="data-[state=active]:bg-white data-[state=active]:shadow-sm py-1.5 text-xs font-bold">Development</TabsTrigger>
                                    <TabsTrigger value="Digital Marketing" className="data-[state=active]:bg-white data-[state=active]:shadow-sm py-1.5 text-xs font-bold">Digital Marketing</TabsTrigger>
                                    <TabsTrigger value="Internal" className="data-[state=active]:bg-white data-[state=active]:shadow-sm py-1.5 text-xs font-bold">Internal</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>

                        <Separator orientation="vertical" className="h-6 bg-slate-200" />

                        {/* Unassigned Filter */}
                        <div className="flex items-center gap-2 px-3 group cursor-pointer select-none" onClick={() => setShowUnassignedOnly(!showUnassignedOnly)}>
                            <div className={cn(
                                "flex items-center justify-center h-5 w-5 rounded-md border-2 transition-all",
                                showUnassignedOnly
                                    ? "bg-rose-500 border-rose-500 shadow-sm shadow-rose-200"
                                    : "border-slate-300 group-hover:border-rose-300"
                            )}>
                                <UserX className={cn("h-3 w-3", showUnassignedOnly ? "text-white" : "text-slate-300 transition-colors group-hover:text-rose-300")} />
                            </div>
                            <span className={cn(
                                "text-[10px] font-black uppercase tracking-wider transition-colors",
                                showUnassignedOnly ? "text-rose-600" : "text-slate-400 group-hover:text-rose-400"
                            )}>
                                Unassigned
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1">
                {loading ? (
                    <MagnifyingGlassLoader />
                ) : tasks.length > 0 ? (
                    <Table>
                        <TableHeader className="bg-gray-50">
                            <TableRow>
                                <TableHead className="py-3">Project</TableHead>
                                <TableHead className="py-3">Task Progress</TableHead>
                                <TableHead className="py-3">Admin Comments</TableHead>
                                <TableHead className="py-3">Last Delivered</TableHead>
                                <TableHead className="py-3">Mail History</TableHead>
                                <TableHead className="py-3 text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTasks.map((item) => (
                                <TableRow
                                    key={item.id}
                                    className="cursor-pointer hover:bg-muted/50 transition-colors group"
                                    onClick={(e) => {
                                        if ((e.target as HTMLElement).closest('input, button, [role="combobox"]')) return;
                                        handleViewDetails(item.id)
                                    }}
                                >
                                    <TableCell className="py-3">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8 rounded-lg border bg-background">
                                                <AvatarImage src={item.project.logo} />
                                                <AvatarFallback>{item.project.name[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-semibold relative">
                                                {item.project.name}
                                                {(projects.find(proj => proj.id === item.id) as any)?.hasUnreadReplies && (
                                                    <span className="absolute -top-1 -right-2 flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                                    </span>
                                                )}
                                            </span>

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/10 hover:text-primary"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const fullProject = projects.find(p => p.id === item.id);
                                                    setSelectedProjectCreds(fullProject);
                                                    setIsCredsOpen(true);
                                                }}
                                            >
                                                <Lock className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        {item.status === 'In Progress' && item.milestones.length > 0 && (
                                            <div className="flex flex-col gap-1.5 min-w-[120px]">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                                    <span>Progress</span>
                                                    <span>{Math.round((item.milestones.filter((m: any) => m.status === 'Completed' || m.status === 'Delivered').length / item.milestones.length) * 100)}%</span>
                                                </div>
                                                <Progress 
                                                    value={(item.milestones.filter((m: any) => m.status === 'Completed' || m.status === 'Delivered').length / item.milestones.length) * 100} 
                                                    className="h-1.5 bg-slate-100"
                                                />
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <AdminCommentCell 
                                            project={projects.find(p => p.id === item.id)} 
                                            isAdmin={!!(isAdmin || currentEmployee?.isTeamLead)} 
                                        />
                                    </TableCell>
                                    <TableCell className="py-3">
                                        {(() => {
                                            const p = projects.find(proj => proj.id === item.id);
                                            if (!p) return null;

                                            let lastTaskUnix = 0;
                                            let lastTaskDisplayDate = '';
                                            let lastTaskTitle = '';

                                            const deliveredTasks = (p.milestones || []).filter((m: any) => m.status === 'Delivered');
                                            if (deliveredTasks.length > 0) {
                                                const sortedTasks = [...deliveredTasks].sort((a: any, b: any) => {
                                                    const timeA = a.deliveredAt ? new Date(a.deliveredAt).getTime() : (a.deliveredDate ? new Date(a.deliveredDate).getTime() : 0);
                                                    const timeB = b.deliveredAt ? new Date(b.deliveredAt).getTime() : (b.deliveredDate ? new Date(b.deliveredDate).getTime() : 0);
                                                    return timeB - timeA;
                                                });
                                                const lastDelivered = sortedTasks[0];
                                                const dtStr = lastDelivered.deliveredAt || lastDelivered.deliveredDate || lastDelivered.date || '';
                                                const parsed = parseRobustDate(dtStr);
                                                if (parsed) {
                                                    lastTaskUnix = parsed.getTime();
                                                    lastTaskDisplayDate = format(parsed, 'EEE, MMM d');
                                                } else {
                                                    lastTaskDisplayDate = dtStr;
                                                }
                                                lastTaskTitle = lastDelivered.task;
                                            }

                                            let lastMailUnix = 0;
                                            let lastMailDisplayDate = '';
                                            let lastMailTitle = '';

                                            const lastEmailMeta = (p as any).lastEmailSent;
                                            const lastSent = lastEmailMeta || p.sentEmails?.[0];

                                            if (lastSent) {
                                                const dtStr = lastSent.date || '';
                                                const parsed = parseRobustDate(dtStr);
                                                if (parsed) {
                                                    lastMailUnix = parsed.getTime();
                                                    lastMailDisplayDate = format(parsed, 'EEE, MMM d');
                                                } else {
                                                    lastMailDisplayDate = dtStr;
                                                }
                                                lastMailTitle = (lastSent.subject || '').split(':').pop()?.trim() || 'General Update';
                                            }

                                            if (!lastTaskUnix && !lastMailUnix) {
                                                return <span className="text-muted-foreground text-sm italic">No deliveries</span>;
                                            }

                                            if (lastMailUnix >= lastTaskUnix) {
                                                return (
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-green-600 whitespace-nowrap">{lastMailDisplayDate}</span>
                                                        <span className="text-xs text-muted-foreground italic truncate max-w-[150px]" title={lastMailTitle}>
                                                            {lastMailTitle}
                                                        </span>
                                                    </div>
                                                );
                                            } else {
                                                return (
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium text-slate-600 whitespace-nowrap">{lastTaskDisplayDate}</span>
                                                        <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={lastTaskTitle}>
                                                            {lastTaskTitle}
                                                        </span>
                                                    </div>
                                                );
                                            }
                                        })()}
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className={cn(
                                                "gap-2 text-muted-foreground hover:text-foreground relative",
                                                (projects.find(proj => proj.id === item.id) as any)?.hasUnreadReplies && "text-rose-600 hover:text-rose-700 bg-rose-50/50"
                                            )}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const p = projects.find(proj => proj.id === item.id);
                                                handleOpenHistory(p);
                                            }}
                                        >
                                            <div className="relative">
                                                <History className="h-4 w-4" />
                                                {(projects.find(proj => proj.id === item.id) as any)?.hasUnreadReplies && (
                                                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                                                    </span>
                                                )}
                                            </div>
                                            {(() => {
                                                const p = projects.find(proj => proj.id === item.id) as any;
                                                if (!p) return 'View History';
                                                if (p.hasUnreadReplies) return 'New Replies';
                                                const hasSubcollectionEmails = !!p.lastEmailSent;
                                                const sentCount = p.sentEmails?.length || 0;
                                                const receivedCount = p.receivedEmails?.length || 0;
                                                if (hasSubcollectionEmails) return 'View History';
                                                if (sentCount === 0 && receivedCount === 0) return 'View History';
                                                if (receivedCount > 0) return `${sentCount} Sent / ${receivedCount} Replied`;
                                                return `${sentCount} Sent`;
                                            })()}
                                        </Button>
                                    </TableCell>
                                    <TableCell className="py-3 text-right">
                                        {(isAdmin || currentEmployee?.isTeamLead) && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="gap-2 shadow-sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const p = projects.find(proj => proj.id === item.id);
                                                    handleOpenMailSheet(p);
                                                }}
                                            >
                                                <Send className="h-3.5 w-3.5" />
                                                Send Mail
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-200px)]">
                        <Empty className="max-w-md">
                            <EmptyMedia className="h-20 w-20 bg-primary/10 rounded-full mb-4">
                                <ClipboardList className="h-10 w-10 text-primary/40" />
                            </EmptyMedia>
                            <EmptyHeader>
                                <EmptyTitle className="text-2xl">Project Tracker is empty</EmptyTitle>
                                <EmptyDescription className="text-base leading-relaxed">
                                    Track daily tasks and assign team members. Start by adding a project in the Projects section to see it here.
                                </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                                <Button variant="outline" onClick={() => navigate('/projects')}>
                                    Go to Projects
                                </Button>
                            </EmptyContent>
                        </Empty>
                    </div>
                )}
            </div>
            <ProjectCredentialsSheet
                project={selectedProjectCreds}
                open={isCredsOpen}
                onOpenChange={setIsCredsOpen}
            />
            <SendAIUpdateSheet
                project={projectForMail}
                open={isMailSheetOpen}
                onOpenChange={setIsMailSheetOpen}
            />
            <MailHistorySheet
                project={historyProject}
                open={isHistoryOpen}
                onOpenChange={setIsHistoryOpen}
                onReply={(p) => {
                    setIsHistoryOpen(false);
                    handleOpenMailSheet(p);
                }}
            />
        </div>
    )
}

function AdminCommentCell({ project, isAdmin }: { project: any, isAdmin: boolean }) {
    const [comment, setComment] = useState(project?.trackerComment || "")
    const [isSaving, setIsSaving] = useState(false)
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)

    useEffect(() => {
        setComment(project?.trackerComment || "")
    }, [project?.trackerComment])

    const handleSave = async () => {
        const normalizedOld = project?.trackerComment || ""
        if (!project?.id || comment === normalizedOld) return
        
        setIsSaving(true)
        try {
            await projectService.updateProject(project.id, { trackerComment: comment })
            toast.success("Comment saved")
        } catch (error) {
            console.error("Failed to save comment:", error)
            toast.error("Failed to save comment")
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="flex items-center gap-2 min-w-[500px] max-w-[800px]">
            <div className="relative group flex-1">
                {isAdmin ? (
                    <>
                        <Input 
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            onBlur={handleSave}
                            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                            placeholder="Add comment..."
                            className="h-9 text-xs bg-transparent border-none hover:bg-muted/30 focus-visible:ring-1 focus-visible:ring-primary transition-all pr-8 overflow-hidden text-ellipsis shadow-none"
                        />
                        {isSaving && <Loader2 className="absolute right-2 top-2.5 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    </>
                ) : (
                    <p className="text-xs text-muted-foreground italic line-clamp-4 leading-relaxed">{comment || "No comments"}</p>
                )}
            </div>
            
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary hover:bg-primary/5"
                onClick={() => setIsHistoryOpen(true)}
                title="View Comment History"
            >
                <History className="h-3.5 w-3.5" />
            </Button>

            <CommentHistorySheet 
                projectId={project?.id || ""} 
                projectName={project?.name || ""}
                open={isHistoryOpen} 
                onOpenChange={setIsHistoryOpen} 
            />
        </div>
    )
}

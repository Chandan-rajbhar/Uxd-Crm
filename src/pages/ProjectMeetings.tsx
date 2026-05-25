import { useNavigate, useParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { storage } from "src/firebase/config"
import { ref, uploadBytes } from "firebase/storage"
import { ArrowLeft, Plus, CalendarDays, Calendar as CalendarIcon, Video, StopCircle, Trash2, FileText, ListTodo, Info, CheckCircle2, Upload, RefreshCw, MessageSquareReply, Clock, Users } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useState, useMemo, useEffect } from "react"
import { useProjects } from "src/hooks/useProjects"
import { format } from "date-fns"
import { ScheduleMeetingSheet } from "@/components/ScheduleMeetingSheet"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Loader2 } from "lucide-react"
import { projectService } from "src/firebase/projectService"
import { useEmployees } from "src/hooks/useEmployees"
import { toast } from "sonner"
import { functions } from "src/firebase/config"
import { httpsCallable } from "firebase/functions"

export default function ProjectMeetingsPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { projects, loading } = useProjects()
    const { employees } = useEmployees()
    const [isScheduleOpen, setIsScheduleOpen] = useState(false)
    const [selectedMeeting, setSelectedMeeting] = useState<any>(null)
    const [isCheckingReplies, setIsCheckingReplies] = useState(false)
    const [lazyMeetings, setLazyMeetings] = useState<any[]>([])
    const [isLoadingMeetings, setIsLoadingMeetings] = useState(false)

    const project = useMemo(() =>
        projects.find(p => p.id === id),
        [projects, id])

    const fetchMeetings = async () => {
        if (!id) return;
        setIsLoadingMeetings(true);
        try {
            const data = await projectService.getMeetings(id);
            setLazyMeetings(data);
        } catch (error) {
            console.error("Failed to fetch meetings:", error);
        } finally {
            setIsLoadingMeetings(false);
        }
    };

    useEffect(() => {
        fetchMeetings();
    }, [id]);

    // Keep selectedMeeting in sync with project updates (e.g. when AI updates transcription)
    useEffect(() => {
        if (selectedMeeting && project) {
            // Check legacy first
            let updatedMeeting = project.meetings?.find((m: any) => m.id === selectedMeeting.id);
            
            // Check lazy if not found in legacy
            if (!updatedMeeting) {
                updatedMeeting = lazyMeetings.find(m => m.id === selectedMeeting.id);
            }

            if (updatedMeeting) {
                // Only update if there are changes to avoid loop
                if (updatedMeeting.transcription !== selectedMeeting.transcription ||
                    updatedMeeting.transcriptionStatus !== selectedMeeting.transcriptionStatus ||
                    JSON.stringify(updatedMeeting.tasks) !== JSON.stringify(selectedMeeting.tasks)) {
                    setSelectedMeeting(updatedMeeting);
                }
            }
        }
    }, [project, lazyMeetings, selectedMeeting])

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, meetingId: string) => {
        const file = event.target.files?.[0];
        if (!file || !project?.id) return;

        if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
            toast.error("Please upload an audio or video file.");
            return;
        }

        const toastId = toast.loading("Uploading recording...");
        try {
            const extension = file.name.split('.').pop() || 'mp3';
            const storagePath = `projects/${project.id}/meetings/${meetingId}/recording.${extension}`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, file, { contentType: file.type });

            const isLegacy = project.meetings?.some((m: any) => m.id === meetingId);

            if (isLegacy) {
                const updatedMeetings = (project.meetings || []).map((m: any) => {
                    if (m.id === meetingId) {
                        return { ...m, transcriptionStatus: 'processing' };
                    }
                    return m;
                });
                await projectService.updateProject(project.id, { meetings: updatedMeetings });
            } else {
                await projectService.updateMeeting(project.id, meetingId, { transcriptionStatus: 'processing' });
                await fetchMeetings();
            }

            setSelectedMeeting((prev: any) => ({ ...prev, transcriptionStatus: 'processing' }));

            toast.success("Recording uploaded! AI processing started.", { id: toastId });
        } catch (error) {
            console.error("Upload failed", error);
            toast.error("Upload failed", { id: toastId });
        }
    }

    const handleSyncMeeting = async (meetingId: string, meetLink: string) => {
        if (!project || !project.id) return

        const loadingId = toast.loading("Syncing with Google Meet (fetching transcript)...")
        try {
            await projectService.syncMeetingData(project.id, meetingId, meetLink)
            toast.success("Meeting transcript synced successfully!", { id: loadingId })

            // Re-fetch project explicitly or rely on subscription?
            // Subscription should handle it, but we can force refresh if needed.
            // For now, simple toast is good.
        } catch (error: any) {
            console.error("Failed to sync:", error)
            // Check for common internal errors
            const msg = error.message || "Failed to sync. Ensure meeting has ended."
            toast.error(msg, { id: loadingId })
        }
    }

    const handleCheckReplies = async () => {
        setIsCheckingReplies(true)
        try {
            const checkFn = httpsCallable(functions, 'checkIncomingEmails')
            const result: any = await checkFn()
            if (result?.data?.processed > 0) {
                toast.success(`Fetched ${result.data.processed} new reply(s)!`)
            } else {
                toast.info("No new replies found.")
            }
        } catch (error: any) {
            console.error("Failed to check replies:", error)
            toast.error("Failed to check replies: " + (error.message || "Unknown error"))
        } finally {
            setIsCheckingReplies(false)
        }
    }

    // Auto-check for meeting replies on page load + poll every 30s
    useEffect(() => {
        const checkEmails = async () => {
            try {
                const checkFn = httpsCallable(functions, 'checkIncomingEmails')
                await checkFn()
            } catch (error) {
                console.error("Auto-check failed:", error)
            }
        }
        checkEmails()
        const interval = setInterval(checkEmails, 30000)
        return () => clearInterval(interval)
    }, [project?.id])

    const getNextUpcomingMeeting = (meetingsList: any[]) => {
        const futureMeetings = meetingsList
            .filter((m: any) => new Date(m.date) >= new Date())
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return futureMeetings.length > 0 ? futureMeetings[0].date : null;
    }

    const handleEndMeeting = async (meetingId: string) => {
        if (!project || !project.id) return

        const isLegacy = project.meetings?.some((m: any) => m.id === meetingId);
        
        if (isLegacy) {
            const updatedMeetings = (project.meetings || []).map((m: any) => 
                m.id === meetingId ? { ...m, date: new Date().toISOString() } : m
            );
            const newUpcomingMeeting = getNextUpcomingMeeting(updatedMeetings);
            await projectService.updateProject(project.id, {
                meetings: updatedMeetings,
                upcomingMeeting: newUpcomingMeeting
            });
        } else {
            await projectService.updateMeeting(project.id, meetingId, { date: new Date().toISOString() });
            
            // Re-calculate upcoming meeting using merged lists
            const currentSubCols = await projectService.getMeetings(project.id);
            const merged = mergeMeetings(project.meetings || [], currentSubCols);
            const newUpcoming = getNextUpcomingMeeting(merged);
            
            await projectService.updateProject(project.id, { upcomingMeeting: newUpcoming });
            await fetchMeetings();
        }
        
        toast.success("Meeting ended and archived")
    }

    const mergeMeetings = (legacy: any[], current: any[]) => {
        const merged = [...current];
        legacy.forEach(l => {
            if (!merged.some(c => c.id === l.id)) merged.push(l);
        });
        return merged;
    }

    const handleDeleteMeeting = async (meetingId: string) => {
        if (!project || !project.id) return

        const isLegacy = project.meetings?.some((m: any) => m.id === meetingId);
        
        try {
            if (isLegacy) {
                const updatedMeetings = (project.meetings || []).filter((m: any) => m.id !== meetingId);
                const newUpcoming = getNextUpcomingMeeting(updatedMeetings);
                await projectService.updateProject(project.id, {
                    meetings: updatedMeetings,
                    upcomingMeeting: newUpcoming
                });
            } else {
                await projectService.removeMeeting(project.id, meetingId);
                const currentSubCols = await projectService.getMeetings(project.id);
                const merged = mergeMeetings(project.meetings || [], currentSubCols);
                const newUpcoming = getNextUpcomingMeeting(merged);
                await projectService.updateProject(project.id, { upcomingMeeting: newUpcoming });
                await fetchMeetings();
            }
            toast.success("Meeting deleted")
            if (selectedMeeting?.id === meetingId) setSelectedMeeting(null);
        } catch (error) {
            console.error("Failed to delete meeting:", error)
            toast.error("Failed to delete meeting")
        }
    }

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 h-[80vh]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse font-medium">Loading session history...</p>
            </div>
        )
    }

    if (!project) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4 h-[80vh]">
                <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center">
                    <CalendarDays className="h-10 w-10 text-muted-foreground/30" />
                </div>
                <div className="text-center">
                    <h3 className="text-xl font-bold">Project Not Found</h3>
                    <p className="text-muted-foreground">The project session timeline could not be located.</p>
                </div>
                <Button onClick={() => navigate('/meetings')} variant="outline" className="rounded-lg">
                    Back to All Meetings
                </Button>
            </div>
        )
    }

    return (
        <div className="flex-1 p-8 pt-6 min-h-[calc(100vh-4.5rem)]">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
                <div className="flex items-center gap-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(-1)}
                        className="h-9 w-9 rounded-full border hover:bg-muted"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14 rounded-lg border shadow-sm">
                            <AvatarImage
                                src={project.logo}
                                className={project.logoFit === 'contain' ? 'object-contain p-1' : 'object-cover'}
                            />
                            <AvatarFallback className="rounded-lg bg-muted">{project.name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h1 className="text-xl font-bold text-foreground leading-tight">{project.name}</h1>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                <span className="font-medium">{project.client}</span>
                                <span>•</span>
                                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider py-0 px-1.5 h-4">
                                    {project.status}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleCheckReplies}
                        disabled={isCheckingReplies}
                        className="rounded-lg font-bold shadow-sm"
                    >
                        {isCheckingReplies ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Check Replies
                    </Button>
                    <Button
                        onClick={() => setIsScheduleOpen(true)}
                        className="rounded-lg font-bold shadow-sm"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Schedule Meeting
                    </Button>
                </div>
            </div>

            <div className="">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="py-4 font-semibold text-xs uppercase tracking-wider pl-4">Meeting Title</TableHead>
                            <TableHead className="py-4 font-semibold text-xs uppercase tracking-wider">Date & Time</TableHead>
                            <TableHead className="py-4 font-semibold text-xs uppercase tracking-wider">Client Response</TableHead>
                            <TableHead className="py-4 font-semibold text-xs uppercase tracking-wider">Action Items</TableHead>
                            <TableHead className="py-4 font-semibold text-xs uppercase tracking-wider text-right pr-4">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoadingMeetings ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-24 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading sessions...</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            <>
                                {(() => {
                                    const allMeetings = mergeMeetings(project.meetings || [], lazyMeetings);
                                    if (allMeetings.length === 0) return (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-24 text-center">
                                                <div className="flex flex-col items-center max-w-xs mx-auto space-y-3">
                                                    <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                                                        <CalendarDays className="h-8 w-8 text-muted-foreground/20" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <h3 className="font-bold">No meetings scheduled</h3>
                                                        <p className="text-sm text-balance text-muted-foreground">
                                                            There are no historical or upcoming sessions recorded for this project yet.
                                                        </p>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setIsScheduleOpen(true)}
                                                        className="mt-4"
                                                    >
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Record First Session
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );

                                    return allMeetings
                                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                        .map((meeting: any) => (
                                            <TableRow
                                                key={meeting.id}
                                                className="hover:bg-muted/50 transition-colors border-b group cursor-pointer"
                                                onClick={() => setSelectedMeeting(meeting)}
                                            >
                                    <TableCell className="py-5 pl-4">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-foreground text-base">
                                                    {meeting.title || "Project Sync Session"}
                                                </span>
                                                <Badge
                                                    variant={new Date(meeting.date) < new Date() ? "secondary" : "default"}
                                                    className="font-bold text-[9px] uppercase px-1.5 h-4"
                                                >
                                                    {new Date(meeting.date) < new Date() ? "Archived" : "Upcoming"}
                                                </Badge>
                                            </div>
                                            {meeting.notes && (
                                                <span className="text-sm text-muted-foreground line-clamp-1 italic mt-0.5">
                                                    {meeting.notes}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-5">
                                        <div className="flex flex-col leading-tight">
                                            <div className="flex items-center gap-2 font-medium">
                                                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                                {format(new Date(meeting.date), 'MMM dd, yyyy')}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 ml-5">
                                                {format(new Date(meeting.date), 'h:mm a')}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-5">
                                        {meeting.clientReply ? (() => {
                                            const status = meeting.clientReplyStatus || 'replied';
                                            if (status === 'reschedule') return (
                                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 font-bold text-[10px] px-2 py-0.5 flex gap-1 items-center w-fit">
                                                    <Clock className="h-2.5 w-2.5" /> Reschedule
                                                </Badge>
                                            );
                                            if (status === 'not_available') return (
                                                <Badge className="bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-100 font-bold text-[10px] px-2 py-0.5 flex gap-1 items-center w-fit">
                                                    <StopCircle className="h-2.5 w-2.5" /> Not Available
                                                </Badge>
                                            );
                                            if (status === 'available') return (
                                                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-bold text-[10px] px-2 py-0.5 flex gap-1 items-center w-fit">
                                                    <CheckCircle2 className="h-2.5 w-2.5" /> Available
                                                </Badge>
                                            );
                                            return (
                                                <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 font-bold text-[10px] px-2 py-0.5 flex gap-1 items-center w-fit">
                                                    <MessageSquareReply className="h-2.5 w-2.5" /> Replied
                                                </Badge>
                                            );
                                        })() : (
                                            <span className="text-xs text-muted-foreground/40 italic flex items-center gap-1">
                                                <Clock className="h-3 w-3" /> Awaiting reply
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-5">
                                        {meeting.tasks && meeting.tasks.length > 0 ? (
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10 font-bold text-[10px] px-2 py-0 h-5 flex gap-1 items-center">
                                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                                    {meeting.tasks.length} {meeting.tasks.length === 1 ? 'Task' : 'Tasks'} Identified
                                                </Badge>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground/40 italic">No tasks fetched</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="py-5 text-right pr-4">
                                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setSelectedMeeting(meeting)}
                                                className="h-9 w-9 p-0 rounded-lg hover:bg-muted text-muted-foreground"
                                                title="View Details"
                                            >
                                                <Info className="h-4 w-4" />
                                            </Button>

                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => window.open(meeting.meetLink, '_blank')}
                                                className="h-9 rounded-lg hover:bg-primary/10 hover:text-primary font-bold group"
                                            >
                                                <Video className="h-4 w-4 md:mr-2" />
                                                <span className="hidden md:inline">Join</span>
                                            </Button>

                                            {new Date(meeting.date) >= new Date() && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleEndMeeting(meeting.id)}
                                                    className="h-9 w-9 rounded-lg text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                                                    title="End Meeting Now"
                                                >
                                                    <StopCircle className="h-4 w-4" />
                                                </Button>
                                            )}

                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => handleDeleteMeeting(meeting.id)}
                                                className="h-9 w-9 rounded-lg text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                                title="Delete Record"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                            </TableRow>
                                        ))
                                    })()}
                            </>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Sheet open={!!selectedMeeting} onOpenChange={(open) => !open && setSelectedMeeting(null)}>
                <SheetContent className="sm:max-w-xl md:max-w-2xl overflow-y-auto w-full">
                    {selectedMeeting && (
                        <>
                            <SheetHeader className="pb-6 border-b">
                                <div className="flex items-center gap-3 mb-4">
                                    <Badge variant="outline" className="text-[10px] bg-muted/50">
                                        {format(new Date(selectedMeeting.date), 'MMM dd, yyyy')}
                                    </Badge>
                                    <Badge variant={new Date(selectedMeeting.date) < new Date() ? "secondary" : "default"} className="text-[10px] uppercase">
                                        {new Date(selectedMeeting.date) < new Date() ? "Archived" : "Upcoming"}
                                    </Badge>
                                </div>
                                <SheetTitle className="text-2xl font-bold">{selectedMeeting.title || "Meeting Details"}</SheetTitle>
                                <SheetDescription className="text-sm">
                                    Review the comprehensive session summary, tasks, and full transcript below.
                                </SheetDescription>
                            </SheetHeader>

                            <div className="py-8 space-y-10">
                                {/* Meeting Summary Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                                        <Info className="h-4 w-4 text-primary" />
                                        MEETING SUMMARY
                                    </div>
                                    <div className="bg-muted/30 border rounded-2xl p-6 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                        {selectedMeeting.notes || "No summary available."}
                                    </div>
                                </div>

                                {/* Attendees Section */}
                                {selectedMeeting.attendees && selectedMeeting.attendees.length > 0 && (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                                            <Users className="h-4 w-4 text-primary" />
                                            ATTENDEES
                                        </div>
                                        <div className="flex flex-wrap gap-3 p-4 bg-muted/30 border rounded-2xl">
                                            {selectedMeeting.attendees.map((attendeeId: string) => {
                                                const employee = employees.find(e => e.id === attendeeId);
                                                if (!employee) return null;
                                                return (
                                                    <div key={attendeeId} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                                                        <Avatar className="h-6 w-6">
                                                            <AvatarImage src={employee.avatar || undefined} />
                                                            <AvatarFallback className="text-[10px]">{employee.name.substring(0, 2)}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-xs font-semibold text-slate-700">{employee.name}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Client Response Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                                        <MessageSquareReply className="h-4 w-4 text-primary" />
                                        CLIENT RESPONSE
                                    </div>
                                    <div className="bg-muted/30 border rounded-2xl p-6 text-sm text-muted-foreground leading-relaxed">
                                        {selectedMeeting.clientReply ? (
                                            <div className="space-y-3">
                                                {(() => {
                                                    const status = selectedMeeting.clientReplyStatus || 'replied';
                                                    if (status === 'reschedule') return (
                                                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 font-bold text-xs px-3 py-1 flex gap-1.5 items-center w-fit">
                                                            <Clock className="h-3 w-3" /> Wants to Reschedule
                                                        </Badge>
                                                    );
                                                    if (status === 'not_available') return (
                                                        <Badge className="bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-100 font-bold text-xs px-3 py-1 flex gap-1.5 items-center w-fit">
                                                            <StopCircle className="h-3 w-3" /> Not Available
                                                        </Badge>
                                                    );
                                                    if (status === 'available') return (
                                                        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100 font-bold text-xs px-3 py-1 flex gap-1.5 items-center w-fit">
                                                            <CheckCircle2 className="h-3 w-3" /> Available / Confirmed
                                                        </Badge>
                                                    );
                                                    return (
                                                        <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100 font-bold text-xs px-3 py-1 flex gap-1.5 items-center w-fit">
                                                            <MessageSquareReply className="h-3 w-3" /> Client Replied
                                                        </Badge>
                                                    );
                                                })()}
                                                <div className="mt-3 bg-white border rounded-xl p-4 text-sm text-slate-700 whitespace-pre-wrap">
                                                    {selectedMeeting.clientReply}
                                                </div>
                                                {selectedMeeting.clientReplyDate && (
                                                    <p className="text-xs text-muted-foreground/60 mt-1">
                                                        Replied on {format(new Date(selectedMeeting.clientReplyDate), 'MMM dd, yyyy \at h:mm a')}
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center py-6 text-muted-foreground/40 gap-3">
                                                <Clock className="h-8 w-8 opacity-20" />
                                                <p className="text-[10px] uppercase font-bold tracking-widest text-center">Awaiting Client Response</p>
                                                <p className="text-xs text-center text-muted-foreground/50">The client has been asked to reply whether they are available, need to reschedule, or are not available.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Action Items Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                                            <ListTodo className="h-4 w-4 text-primary" />
                                            ASSIGNED ACTION ITEMS
                                        </div>
                                        {selectedMeeting.tasks?.length > 0 && (
                                            <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px]">
                                                {selectedMeeting.tasks.length} Items Identified
                                            </Badge>
                                        )}
                                    </div>

                                    <div className="bg-muted/30 border rounded-2xl p-6 min-h-[150px]">
                                        {selectedMeeting.tasks && selectedMeeting.tasks.length > 0 ? (
                                            <ul className="space-y-4">
                                                {selectedMeeting.tasks.map((task: any, idx: number) => (
                                                    <li key={idx} className="flex gap-4 group/item">
                                                        <div className="mt-1 h-5 w-5 rounded-full border border-primary/20 flex items-center justify-center bg-white shadow-sm group-hover/item:border-primary transition-colors">
                                                            <div className="h-2 w-2 rounded-full bg-primary opacity-0 group-hover/item:opacity-100 transition-opacity" />
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <span className="text-sm font-bold text-slate-800 leading-tight">{task.task}</span>
                                                            {task.description && <span className="text-xs text-muted-foreground leading-relaxed">{task.description}</span>}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center py-8 text-muted-foreground/40 gap-3">
                                                <ListTodo className="h-10 w-10 opacity-20" />
                                                <p className="text-[10px] uppercase font-bold tracking-widest text-center">No Tasks Identifed</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Transcription Section */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 font-bold text-sm text-foreground">
                                        <FileText className="h-4 w-4 text-primary" />
                                        MEETING TRANSCRIPTION
                                    </div>
                                    <div className="bg-white border rounded-2xl p-6 text-sm text-muted-foreground leading-relaxed h-[400px] overflow-y-auto font-medium shadow-sm">
                                        {selectedMeeting.transcription ? (
                                            <div className="whitespace-pre-wrap">{selectedMeeting.transcription}</div>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center py-8 text-muted-foreground/30 gap-4">
                                                {selectedMeeting.transcriptionStatus === 'processing' ? (
                                                    <>
                                                        <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
                                                        <p className="text-[10px] uppercase font-black tracking-tighter">AI Processing in Progress...</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-[10px] uppercase font-black tracking-tighter mb-2">No recording found</p>
                                                        {selectedMeeting.meetLink && selectedMeeting.meetLink.includes('meet.google.com') && (
                                                            <>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleSyncMeeting(selectedMeeting.id, selectedMeeting.meetLink)}
                                                                    className="w-full max-w-[200px] border-primary/20 text-primary hover:bg-primary/5 hover:text-primary transition-colors font-semibold mb-3"
                                                                >
                                                                    <RefreshCw className="h-3.5 w-3.5 mr-2" /> Sync from Meet
                                                                </Button>
                                                                <div className="flex items-center gap-2 w-full max-w-[200px] justify-center text-muted-foreground/40 text-[10px] mb-3">
                                                                    <div className="h-[1px] bg-border flex-1"></div>
                                                                    <span className="font-bold tracking-wider">OR</span>
                                                                    <div className="h-[1px] bg-border flex-1"></div>
                                                                </div>
                                                            </>
                                                        )}
                                                        <Button variant="outline" size="sm" onClick={() => document.getElementById(`upload-${selectedMeeting.id}`)?.click()}>
                                                            <Upload className="h-4 w-4 mr-2" /> Upload Recording
                                                        </Button>
                                                        <input
                                                            type="file"
                                                            id={`upload-${selectedMeeting.id}`}
                                                            className="hidden"
                                                            accept="audio/*,video/*"
                                                            onChange={(e) => handleFileUpload(e, selectedMeeting.id)}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            <ScheduleMeetingSheet
                open={isScheduleOpen}
                onOpenChange={setIsScheduleOpen}
                project={project}
            />
        </div>
    )
}

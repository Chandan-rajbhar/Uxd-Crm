import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
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
} from "@/components/ui/alert-dialog"
import {
    Calendar,
    Mail,
    Trash2,
    Send,
    Inbox,
    Paperclip,
    CheckCheck,
    Reply,
    Eye,
    Loader2,
    FileText,
    ImageIcon,
    File
} from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { format, isValid, parse } from "date-fns"
import { projectService } from "src/firebase/projectService"
import { type Project } from "src/store/slices/projectsSlice"
import { generateEmailTemplate, cleanReplyContent, generateReplyTemplate } from "@/utils/emailTemplate"
import { useAuth } from "src/contexts/AuthContext"
import { httpsCallable } from "firebase/functions"
import { functions } from "src/firebase/config"

interface MailHistorySheetProps {
    project: Project | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onReply?: (project: Project) => void
}

const parseSafeDate = (dateStr: any) => {
    if (!dateStr) return new Date(NaN);
    if (dateStr instanceof Date) return dateStr;
    
    const s = String(dateStr).trim();
    
    // Check for DD/MM/YYYY or D/M/YYYY
    if (s.includes('/') && !s.includes('-')) {
        const parts = s.split('/');
        if (parts.length === 3) {
            // Ensure year is 4 digits for dd/MM/yyyy
            const d = parts[0].padStart(2, '0');
            const m = parts[1].padStart(2, '0');
            const y = parts[2];
            if (y.length === 4) {
                const parsed = parse(`${d}/${m}/${y}`, 'dd/MM/yyyy', new Date());
                if (isValid(parsed)) return parsed;
            }
        }
    }
    
    const date = new Date(s);
    return date;
}

export function MailHistorySheet({ project, open, onOpenChange, onReply }: MailHistorySheetProps) {
    const { isAdmin } = useAuth()
    const [activeTab, setActiveTab] = useState("all")
    const [viewingEmailIndex, setViewingEmailIndex] = useState<number | null>(null)
    const [selectedEmailIndices, setSelectedEmailIndices] = useState<number[]>([])
    const [isDeleting, setIsDeleting] = useState(false)
    const [isLoadingHistory, setIsLoadingHistory] = useState(false)
    
    // Lazy Loading States
    const [lazySentEmails, setLazySentEmails] = useState<any[]>([])
    const [lazyReceivedEmails, setLazyReceivedEmails] = useState<any[]>([])

    useEffect(() => {
        const fetchHistory = async () => {
            if (open && project?.id) {
                setIsLoadingHistory(true);
                try {
                    const [sentCols, receivedCols] = await Promise.all([
                        projectService.getSentEmails(project.id),
                        projectService.getReceivedEmails(project.id)
                    ]);
                    
                    setLazySentEmails(sentCols);
                    setLazyReceivedEmails(receivedCols);
                    
                    if (sentCols.length || receivedCols.length || (project as any).sentEmails?.length || (project as any).receivedEmails?.length) {
                        setViewingEmailIndex(0)
                        
                        // Mark the first email as read if it's a received one
                        const firstEmail = [...receivedCols, ...sentCols].sort((a, b) => parseSafeDate(b.date).getTime() - parseSafeDate(a.date).getTime())[0];
                        if (firstEmail?.msgType === 'received' && !firstEmail.read && firstEmail.id) {
                            projectService.updateReceivedEmail(project.id, firstEmail.id, { read: true });
                        }
                    } else {
                        setViewingEmailIndex(null)
                    }

                    // Clear project level unread flag
                    if ((project as any).hasUnreadReplies) {
                        projectService.updateProject(project.id, { hasUnreadReplies: false });
                    }
                } catch (error) {
                    console.error("Failed to load email history:", error);
                } finally {
                    setIsLoadingHistory(false);
                }
            }
        };
        fetchHistory();
    }, [open, project?.id])

    // Poll for new emails when open
    useEffect(() => {
        if (!open || !project?.id) return;

        const pollCheck = async () => {
            try {
                const check = httpsCallable(functions, 'checkIncomingEmails');
                await check({ lookbackDays: 3 });
                
                // Re-fetch received emails to show new ones
                const receivedCols = await projectService.getReceivedEmails(project.id!);
                setLazyReceivedEmails(receivedCols);
            } catch (error) {
                console.error("Poll email check failed:", error);
            }
        };

        const interval = setInterval(pollCheck, 60000);
        return () => clearInterval(interval);
    }, [open, project?.id])

    const allEmails = useMemo(() => {
        if (!project) return [];
        
        const legacySent = ((project as any).sentEmails || []).map((e: any) => ({ ...e, msgType: 'sent' }));
        const currentSent = (lazySentEmails || []).map((e: any) => ({ ...e, msgType: 'sent' }));
        
        const allSent = [...currentSent];
        legacySent.forEach((ls: any) => {
            const isDuplicate = allSent.some(cs => cs.date === ls.date && cs.subject === ls.subject);
            if (!isDuplicate) allSent.push(ls);
        });

        const legacyReceived = ((project as any).receivedEmails || []).map((e: any) => ({ ...e, msgType: 'received' }));
        const currentReceived = (lazyReceivedEmails || []).map((e: any) => ({ ...e, msgType: 'received' }));
        
        const allReceived = [...currentReceived];
        legacyReceived.forEach((lr: any) => {
            const isDuplicate = allReceived.some(cr => cr.date === lr.date && cr.subject === lr.subject);
            if (!isDuplicate) allReceived.push(lr);
        });

        return [...allSent, ...allReceived].sort((a, b) => {
            const getTimestamp = (e: any) => {
                if (e.createdAt?.seconds) return e.createdAt.seconds * 1000;
                if (e.savedAt?.seconds) return e.savedAt.seconds * 1000;
                if (e.createdAt && typeof e.createdAt === 'string') return new Date(e.createdAt).getTime();
                if (e.receivedAt) return new Date(e.receivedAt).getTime();
                if (e.date) return parseSafeDate(e.date).getTime();
                return 0;
            };
            return getTimestamp(b) - getTimestamp(a);
        });
    }, [project, lazySentEmails, lazyReceivedEmails]);

    const filteredEmails = useMemo(() => {
        if (activeTab === 'all') return allEmails;
        if (activeTab === 'sent') return allEmails.filter(e => e.msgType === 'sent');
        if (activeTab === 'replies') return allEmails.filter(e => e.msgType === 'received');
        return allEmails;
    }, [allEmails, activeTab]);

    const handleDeleteEmail = async () => {
        if (viewingEmailIndex === null || !project || !project.id) return;
        const emailToDelete = filteredEmails[viewingEmailIndex];
        if (!emailToDelete) return;

        setIsDeleting(true);
        try {
            if (emailToDelete.msgType === 'sent') {
                if (emailToDelete.id) {
                    await projectService.removeSentEmail(project.id, emailToDelete.id);
                    setLazySentEmails(prev => prev.filter(e => e.id !== emailToDelete.id));
                } else {
                    const updatedSent = ((project as any).sentEmails || []).filter((e: any) => 
                        e.date !== emailToDelete.date || e.subject !== emailToDelete.subject
                    );
                    await projectService.updateProject(project.id, { sentEmails: updatedSent });
                }
            } else {
                const updatedReceived = ((project as any).receivedEmails || []).filter((e: any) => 
                    e.date !== emailToDelete.date || e.subject !== emailToDelete.subject
                );
                await projectService.updateProject(project.id, { receivedEmails: updatedReceived });
            }
            toast.success("Email deleted successfully");
            setViewingEmailIndex(null);
            setSelectedEmailIndices(prev => prev.filter(idx => idx !== viewingEmailIndex));
        } catch (error) {
            console.error("Failed to delete email:", error);
            toast.error("Failed to delete email");
        } finally {
            setIsDeleting(false);
        }
    }

    const handleDeleteSelectedEmails = async () => {
        if (selectedEmailIndices.length === 0 || !project || !project.id) return;
        
        setIsDeleting(true);
        try {
            const emailsToDelete = selectedEmailIndices.map(idx => filteredEmails[idx]).filter(Boolean);
            
            for (const email of emailsToDelete) {
                if (email.msgType === 'sent') {
                    if (email.id) {
                        await projectService.removeSentEmail(project.id, email.id);
                    } else {
                        // Handle legacy sentEmails array (sequential is slow but safe here for few items)
                        const currentProj = await projectService.getProjectById(project.id);
                        const updatedSent = ((currentProj as any).sentEmails || []).filter((e: any) => 
                            e.date !== email.date || e.subject !== email.subject
                        );
                        await projectService.updateProject(project.id, { sentEmails: updatedSent });
                    }
                } else {
                    const currentProj = await projectService.getProjectById(project.id);
                    const updatedReceived = ((currentProj as any).receivedEmails || []).filter((e: any) => 
                        e.date !== email.date || e.subject !== email.subject
                    );
                    await projectService.updateProject(project.id, { receivedEmails: updatedReceived });
                }
            }

            // Refresh lazy states
            const [sentCols, receivedCols] = await Promise.all([
                projectService.getSentEmails(project.id),
                projectService.getReceivedEmails(project.id)
            ]);
            setLazySentEmails(sentCols);
            setLazyReceivedEmails(receivedCols);
            
            toast.success(`${emailsToDelete.length} email(s) deleted`);
            setSelectedEmailIndices([]);
            setViewingEmailIndex(null);
        } catch (error) {
            console.error("Failed to delete selected emails:", error);
            toast.error("Failed to delete selected emails");
        } finally {
            setIsDeleting(false);
        }
    }

    const getFileIcon = (type: string) => {
        if (type?.startsWith('image/')) return <ImageIcon className="h-4 w-4 text-blue-500" />
        if (type?.includes('pdf')) return <FileText className="h-4 w-4 text-red-500" />
        return <File className="h-4 w-4 text-gray-500" />
    }

    return (
        <Sheet open={open} onOpenChange={(val) => {
            if (!val) {
                setSelectedEmailIndices([]);
                setViewingEmailIndex(null);
            }
            onOpenChange(val);
        }}>
            <SheetContent className="overflow-hidden sm:max-w-[70vw] w-full flex flex-col h-full p-0">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                    <div className="p-6 border-b flex justify-between items-start">
                        <div>
                            <SheetHeader>
                                <SheetTitle>Mail History</SheetTitle>
                                <SheetDescription>
                                    Past updates & replies for <strong>{project?.name}</strong>.
                                </SheetDescription>
                            </SheetHeader>
                            <TabsList className="mt-4">
                                <TabsTrigger value="all">All Mail</TabsTrigger>
                                <TabsTrigger value="sent">Sent Updates</TabsTrigger>
                                <TabsTrigger value="replies">Replies</TabsTrigger>
                            </TabsList>
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        {/* Sidebar List */}
                        <div className="w-[320px] border-r overflow-y-auto p-4 space-y-3 bg-muted/5 no-scrollbar">
                            {!isLoadingHistory && filteredEmails.length > 0 && (
                                <div className="flex items-center justify-between pb-2 border-b">
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            checked={selectedEmailIndices.length === filteredEmails.length && filteredEmails.length > 0}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedEmailIndices(filteredEmails.map((_, i) => i));
                                                } else {
                                                    setSelectedEmailIndices([]);
                                                }
                                            }}
                                        />
                                        <span className="text-xs font-medium text-muted-foreground">
                                            {selectedEmailIndices.length > 0 ? `${selectedEmailIndices.length} selected` : 'Select All'}
                                        </span>
                                    </div>
                                    {selectedEmailIndices.length > 0 && isAdmin && (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="h-7 text-xs px-2 text-red-600 hover:text-red-700 hover:bg-red-50 gap-1"
                                            onClick={handleDeleteSelectedEmails}
                                            disabled={isDeleting}
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Delete
                                        </Button>
                                    )}
                                </div>
                            )}
                            {isLoadingHistory ? (
                                <div className="flex flex-col items-center justify-center py-10 space-y-2 opacity-50">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    <span className="text-[10px] font-black tracking-widest">LOADING...</span>
                                </div>
                            ) : filteredEmails.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8 text-sm">No emails found.</p>
                            ) : (
                                filteredEmails.map((email: any, i: number) => (
                                    <div
                                        key={i}
                                        onClick={() => {
                                            setViewingEmailIndex(i);
                                            const email = filteredEmails[i];
                                            if (email.msgType === 'received' && !email.read && email.id && project?.id) {
                                                projectService.updateReceivedEmail(project.id, email.id, { read: true });
                                                // Optimistic update
                                                setLazyReceivedEmails(prev => prev.map(re => re.id === email.id ? { ...re, read: true } : re));
                                            }
                                        }}
                                        className={cn(
                                            "group flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors text-left",
                                            viewingEmailIndex === i ? "bg-primary/5 border-primary shadow-sm" : "hover:bg-white bg-card"
                                        )}
                                    >
                                        <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                            <Checkbox
                                                checked={selectedEmailIndices.includes(i)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setSelectedEmailIndices([...selectedEmailIndices, i]);
                                                    } else {
                                                        setSelectedEmailIndices(selectedEmailIndices.filter(idx => idx !== i));
                                                    }
                                                }}
                                                className={cn(
                                                    "transition-opacity",
                                                    selectedEmailIndices.includes(i) || selectedEmailIndices.length > 0 ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                                )}
                                            />
                                        </div>
                                        <div className="flex-1 flex flex-col space-y-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-muted-foreground flex items-center">
                                                    <Calendar className="h-3 w-3 mr-1" />
                                                    {isValid(parseSafeDate(email.date)) ? format(parseSafeDate(email.date), 'do MMMM') : 'Unknown'}
                                                </span>
                                                <div className="flex items-center gap-1">
                                                    {email.msgType === 'received' && (
                                                        email.read ? (
                                                            <Badge variant="outline" className="text-[10px] h-5 px-1 bg-blue-50 text-blue-700 border-blue-200">Inbox</Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[10px] h-5 px-1 bg-rose-50 text-rose-700 border-rose-200 animate-pulse font-bold">Unread</Badge>
                                                        )
                                                    )}
                                                    {email.msgType === 'sent' && (
                                                        email.opened ? (
                                                            <Badge variant="outline" className="text-[10px] h-5 px-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                                                                <CheckCheck className="h-3 w-3 mr-1" /> Read
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[10px] h-5 px-1 bg-gray-50 text-gray-500 border-gray-200">
                                                                <CheckCheck className="h-3 w-3 mr-1 opacity-50" /> Sent
                                                            </Badge>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                            <span className="font-medium text-sm line-clamp-2">{email.subject}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Content Panel */}
                        <div className="flex-1 overflow-y-auto bg-white no-scrollbar">
                            {viewingEmailIndex !== null && filteredEmails[viewingEmailIndex] ? (
                                <div className="p-6 space-y-6">
                                    <div className="space-y-4 pb-6 border-b">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-3 flex-1">
                                                {filteredEmails[viewingEmailIndex].msgType === 'received' ? <Inbox className="h-5 w-5 text-blue-600" /> : <Send className="h-5 w-5 text-muted-foreground" />}
                                                <h2 className="text-xl font-bold leading-tight">
                                                    {filteredEmails[viewingEmailIndex].subject}
                                                </h2>
                                                {filteredEmails[viewingEmailIndex].msgType === 'sent' && (
                                                    filteredEmails[viewingEmailIndex].opened ? (
                                                        <Badge variant="outline" className="shrink-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                                                            <CheckCheck className="h-4 w-4 mr-1.5" /> Read
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="shrink-0 bg-gray-50 text-gray-500 border-gray-200">
                                                            <CheckCheck className="h-4 w-4 mr-1.5 opacity-50" /> Sent
                                                        </Badge>
                                                    )
                                                )}
                                            </div>

                                            {isAdmin && (
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-red-600">
                                                            <Trash2 className="h-5 w-5" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete Email?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                This action cannot be undone.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={handleDeleteEmail} className="bg-red-600 hover:bg-red-700">
                                                                Delete
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                                            <div className="flex items-center gap-4">
                                                <span className="flex items-center bg-muted px-2 py-1 rounded">
                                                    <Calendar className="h-4 w-4 mr-2" />
                                                    {isValid(parseSafeDate(filteredEmails[viewingEmailIndex].date)) ? format(parseSafeDate(filteredEmails[viewingEmailIndex].date), 'do MMMM') : 'Unknown'}
                                                </span>
                                                <span>From: {filteredEmails[viewingEmailIndex].sender}</span>
                                            </div>
                                            {filteredEmails[viewingEmailIndex].msgType === 'received' && onReply && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-2 text-primary border-primary/20 hover:bg-primary/5"
                                                    onClick={() => project && onReply(project)}
                                                >
                                                    <Reply className="h-4 w-4" />
                                                    Reply
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {(() => {
                                        const email = filteredEmails[viewingEmailIndex];
                                        let htmlToRender = email.htmlContent || null;

                                        if (!htmlToRender && email.msgType === 'sent') {
                                            htmlToRender = generateEmailTemplate({
                                                projectName: project?.name || '',
                                                clientName: project?.client?.split(' ')[0] || '',
                                                summary: email.content || "",
                                                date: email.date,
                                                credentials: project?.credentials?.all || []
                                            });
                                        }

                                        if (!htmlToRender && email.msgType === 'received') {
                                            const cleanedContent = cleanReplyContent(email.content);
                                            htmlToRender = generateReplyTemplate({
                                                senderName: email.sender ? email.sender.split('<')[0].trim().replace(/^"|"$/g, '') : "Unknown",
                                                content: cleanedContent,
                                                date: isValid(parseSafeDate(email.date)) ? format(parseSafeDate(email.date), 'do MMMM') : "Unknown",
                                                subject: email.subject
                                            });
                                        }

                                        return (
                                            <div
                                                className="border rounded-md bg-white p-4 overflow-x-auto"
                                                dangerouslySetInnerHTML={{ __html: htmlToRender || '' }}
                                            />
                                        )
                                    })()}

                                    {filteredEmails[viewingEmailIndex].attachments?.length > 0 && (
                                        <div className="pt-6 border-t mt-8">
                                            <h3 className="text-sm font-semibold mb-3 flex items-center">
                                                <Paperclip className="h-4 w-4 mr-2" />
                                                Attachments ({filteredEmails[viewingEmailIndex].attachments.length})
                                            </h3>
                                            <div className="flex flex-wrap gap-3">
                                                {filteredEmails[viewingEmailIndex].attachments.map((att: any, idx: number) => (
                                                    <div 
                                                        key={idx} 
                                                        className="group relative w-[180px] border rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-all"
                                                        onClick={() => window.open(att.url, '_blank')}
                                                    >
                                                        <div className="aspect-video bg-muted flex items-center justify-center p-4">
                                                            {getFileIcon(att.type)}
                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                                <Eye className="h-5 w-5 text-white" />
                                                            </div>
                                                        </div>
                                                        <div className="p-2 border-t bg-white">
                                                            <div className="text-xs font-medium truncate" title={att.name}>{att.name}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                                    <Mail className="h-12 w-12 mb-4 opacity-20" />
                                    <p>Select an email to view details.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </Tabs>
            </SheetContent>
        </Sheet>
    )
}

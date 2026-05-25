import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Calendar as LucideCalendar, FolderIcon, Globe, Check, X, Facebook, Instagram, Linkedin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useState, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { useProjects } from "@/hooks/useProjects"
import type { Project } from "src/store/slices/projectsSlice"
import { projectService } from "@/firebase/projectService"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { useAuth } from "@/contexts/AuthContext"
import { useEmployees } from "@/hooks/useEmployees"

export default function Calendar() {
    const { user, isAdmin } = useAuth()
    const { employees } = useEmployees()
    const [currentDate, setCurrentDate] = useState(new Date())
    const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate())
    const { projects } = useProjects()

    // Get current employee details to check team/department
    const currentEmployee = employees.find(e => e.authUid === user?.uid || e.uid === user?.uid || e.email?.toLowerCase() === user?.email?.toLowerCase())
    const isDigitalMarketing = currentEmployee?.department?.toLowerCase().includes('digital') ||
        currentEmployee?.team?.toLowerCase().includes('digital') ||
        currentEmployee?.role?.toLowerCase().includes('digital')

    const [activeTab, setActiveTab] = useState(isAdmin || isDigitalMarketing ? "digital-posts" : "dev")

    // Dialog state
    const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false)
    const [linkProject, setLinkProject] = useState<any>(null)
    const [linkPlatform, setLinkPlatform] = useState("")
    const [linkTargetDate, setLinkTargetDate] = useState("")
    const [postLink, setPostLink] = useState("")
    const [isSavingLink, setIsSavingLink] = useState(false)

    // Delete confirmation state
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [deleteProject, setDeleteProject] = useState<any>(null)
    const [deletePlatform, setDeletePlatform] = useState("")
    const [deleteTargetDate, setDeleteTargetDate] = useState("")
    const [isDeletingLink, setIsDeletingLink] = useState(false)

    const hasActiveTasks = (p: Project) => p.milestones?.some((m: any) => m.status === 'In Progress' || m.status === 'Completed')

    const devProjects = projects.filter(p =>
        p.category === 'Development' &&
        p.client &&
        !p.client?.toLowerCase().includes('uxd') &&
        !p.client?.toLowerCase().includes('internal') &&
        !p.name?.toLowerCase().includes('internal') &&
        p.name?.toLowerCase() !== 'builtraa' &&
        p.assignedTeam?.toLowerCase() !== 'internal' &&
        hasActiveTasks(p)
    )

    const baseDigital = projects.filter(p =>
        p.category === 'Digital Marketing' &&
        p.client &&
        !p.client?.toLowerCase().includes('uxd') &&
        !p.client?.toLowerCase().includes('internal') &&
        !p.name?.toLowerCase().includes('internal') &&
        p.assignedTeam?.toLowerCase() !== 'internal' &&
        hasActiveTasks(p)
    )

    const digitalPosts = projects.filter(p =>
        p.category === 'Digital Marketing' &&
        p.client &&
        !p.client?.toLowerCase().includes('uxd') &&
        !p.client?.toLowerCase().includes('internal') &&
        !p.name?.toLowerCase().includes('internal') &&
        p.assignedTeam?.toLowerCase() !== 'internal'
    )

    const digitalUpdates = baseDigital
    
    // Performance Optimization: Hybrid Fetching for Subcollections
    const [lazySentEmails, setLazySentEmails] = useState<Record<string, any[]>>({});

    useEffect(() => {
        const fetchLazyEmails = async () => {
            const targetProjects = activeTab === 'dev' ? devProjects : activeTab === 'digital-posts' ? digitalPosts : digitalUpdates;
            const newEmails: Record<string, any[]> = {};
            let updated = false;

            await Promise.all(targetProjects.map(async (p) => {
                if (!lazySentEmails[p.id!]) {
                    const emails = await projectService.getSentEmails(p.id!);
                    newEmails[p.id!] = emails;
                    updated = true;
                }
            }));

            if (updated) {
                setLazySentEmails(prev => ({ ...prev, ...newEmails }));
            }
        };
        fetchLazyEmails();
    }, [activeTab, projects, currentDate]);

    const getMergedSentEmails = (project: any) => {
        const legacy = project.sentEmails || [];
        const recent = lazySentEmails[project.id!] || [];
        const merged = [...recent];
        legacy.forEach((l: any) => {
            if (!merged.some(m => m.id === l.id)) merged.push(l);
        });
        return merged;
    };

    // Robust date parser — handles all locale variations (US M/D/Y, Indian D/M/Y, ISO YYYY-MM-DD, ISO timestamps)
    const parseRobustDate = (rawStr: string): Date | null => {
        if (!rawStr) return null;
        let d = new Date(rawStr);
        if (rawStr.includes('/')) {
            const parts = rawStr.split('/');
            if (parts.length === 3) {
                const p0 = parseInt(parts[0], 10);
                const p1 = parseInt(parts[1], 10);
                const p2 = parseInt(parts[2], 10);
                if (p1 > 12 && p0 <= 12) {
                    // M/DD/YYYY — US format where day > 12
                    d = new Date(p2, p0 - 1, p1, 12, 0, 0);
                } else if (p0 > 12 && p1 <= 12) {
                    // DD/MM/YYYY — Indian/UK format where day > 12
                    d = new Date(p2, p1 - 1, p0, 12, 0, 0);
                } else if (p0 <= 12 && p1 <= 12) {
                    // Ambiguous (both <= 12) — treat as M/D/Y (US default, matching toLocaleDateString behavior)
                    d = new Date(p2, p0 - 1, p1, 12, 0, 0);
                }
                if (isNaN(d.getTime())) d = new Date(rawStr);
            }
        }
        return isNaN(d.getTime()) ? null : d;
    };

    // Compare two date strings robustly
    const isSameDay = (date1: string, date2: string) => {
        if (!date1 || !date2) return false;
        const d1 = parseRobustDate(date1);
        const d2 = parseRobustDate(date2);
        if (!d1 || !d2) return false;
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    }

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear()
        const month = date.getMonth()
        const firstDay = new Date(year, month, 1).getDay()
        const daysInMonth = new Date(year, month + 1, 0).getDate()

        const days = []
        // Add padding for previous month
        for (let i = 0; i < firstDay; i++) {
            days.push(null)
        }
        // Add days of current month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i)
        }
        return days
    }

    const days = getDaysInMonth(currentDate)
    const monthName = currentDate.toLocaleString('default', { month: 'long' })
    const year = currentDate.getFullYear()

    const prevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
    }

    const nextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
    }

    const handleDayClick = (day: number | null) => {
        if (day) {
            setSelectedDay(day)
        }
    }

    const getSelectedFullDate = () => {
        if (!selectedDay) return ""
        const date = new Date(year, currentDate.getMonth(), selectedDay)
        return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    }

    const handleSocialClick = (project: any, platform: string, targetDate: string) => {
        const mergedEmails = getMergedSentEmails(project);
        const posts = mergedEmails.filter((e: any) =>
            isSameDay(e.date, targetDate) && e.subject?.toLowerCase().includes(platform)
        ) || [];

        if (posts.length > 0) {
            const linkMatch = posts[0].content?.match(/https?:\/\/[^\s]+/);
            if (linkMatch) {
                window.open(linkMatch[0], '_blank');
            } else {
                toast.info(`No link found for this ${platform} post`);
            }
        }
    };

    const handleSocialDoubleClick = (project: any, platform: string, targetDate: string) => {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        if (!isSameDay(targetDate, todayStr)) {
            toast.error("You can only add links for today's date");
            return;
        }

        setLinkProject(project);
        setLinkPlatform(platform);
        setLinkTargetDate(targetDate);
        setPostLink("");
        setIsLinkDialogOpen(true);
    };

    const handleSaveLink = async () => {
        if (!postLink || !postLink.startsWith('http')) {
            toast.error("Please enter a valid URL starting with http");
            return;
        }

        setIsSavingLink(true);
        try {
            await projectService.addSentEmail(linkProject.id!, {
                date: linkTargetDate,
                subject: `${linkPlatform.charAt(0).toUpperCase() + linkPlatform.slice(1)} Post`,
                content: `Social media post shared on ${linkPlatform}. Link: ${postLink}`,
                sender: "System",
                attachmentCount: 0
            });
            toast.success(`${linkPlatform} post link saved!`);
            
            // Instantly update the lazy cache so it shows on UI
            const newEmail = {
                id: Date.now().toString(),
                date: linkTargetDate,
                subject: `${linkPlatform.charAt(0).toUpperCase() + linkPlatform.slice(1)} Post`,
                content: `Social media post shared on ${linkPlatform}. Link: ${postLink}`,
                sender: "System",
                attachmentCount: 0
            };
            setLazySentEmails(prev => ({
                ...prev,
                [linkProject.id!]: [newEmail, ...(prev[linkProject.id!] || [])]
            }));
            
            setIsLinkDialogOpen(false);
        } catch (err) {
            toast.error("Failed to save link");
        } finally {
            setIsSavingLink(false);
        }
    };

    const handleSocialRightClick = (e: React.MouseEvent, project: any, platform: string, targetDate: string) => {
        e.preventDefault();

        const mergedEmails = getMergedSentEmails(project);
        const hasPost = mergedEmails.some((e: any) =>
            isSameDay(e.date, targetDate) && e.subject?.toLowerCase().includes(platform)
        );

        if (!hasPost) return;

        setDeleteProject(project);
        setDeletePlatform(platform);
        setDeleteTargetDate(targetDate);
        setIsDeleteDialogOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!deleteProject) return;

        setIsDeletingLink(true);
        try {
            const mergedEmails = getMergedSentEmails(deleteProject);
            const emailToDel = mergedEmails.find((e: any) => 
                isSameDay(e.date, deleteTargetDate) && e.subject?.toLowerCase().includes(deletePlatform)
            );
            
            if (emailToDel) {
                await projectService.removeSentEmail(deleteProject.id!, emailToDel.id);
            }
            
            // Remove from local cache optimistically
            setLazySentEmails(prev => ({
                ...prev,
                [deleteProject.id!]: (prev[deleteProject.id!] || []).filter(e => {
                    const isTargetPlatform = e.subject?.toLowerCase().includes(deletePlatform);
                    return !(isSameDay(e.date, deleteTargetDate) && isTargetPlatform);
                })
            }));
            
            toast.success(`${deletePlatform} post record deleted`);
            setIsDeleteDialogOpen(false);
        } catch (err) {
            toast.error("Failed to delete record");
        } finally {
            setIsDeletingLink(false);
        }
    };

    // Precompute the entire month's activities into an O(1) map
    const activityMap = useMemo(() => {
        const targetProjects = activeTab === 'dev' ? devProjects : activeTab === 'digital-posts' ? digitalPosts : digitalUpdates;
        const map = new Map<string, Map<string, any>>();
        
        targetProjects.forEach(project => {
            const mergedEmails = getMergedSentEmails(project);
            
            mergedEmails.forEach((email: any) => {
                const dateObj = parseRobustDate(email.date);
                if (!dateObj) return;
                
                const dateStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                
                if (!map.has(dateStr)) map.set(dateStr, new Map());
                const dayMap = map.get(dateStr)!;
                
                if (!dayMap.has(project.id!)) {
                    dayMap.set(project.id!, { hasActivity: false, posts: { facebook: false, instagram: false, linkedin: false } });
                }
                const activity = dayMap.get(project.id!)!;
                
                const sub = email.subject?.toLowerCase() || "";
                if (sub.includes('facebook')) activity.posts.facebook = true;
                if (sub.includes('instagram')) activity.posts.instagram = true;
                if (sub.includes('linkedin')) activity.posts.linkedin = true;
                
                activity.hasActivity = activeTab === 'digital-posts' ? 
                    (activity.posts.facebook || activity.posts.instagram || activity.posts.linkedin) : 
                    true;
            });
        });
        
        return map;
    }, [activeTab, devProjects, digitalPosts, digitalUpdates, lazySentEmails]);

    const getProjectActivityPrecomputed = (project: any, targetDateStr: string) => {
        const defaultActivity = { hasActivity: false, posts: { facebook: false, instagram: false, linkedin: false } };
        const dayMap = activityMap.get(targetDateStr);
        if (!dayMap) return defaultActivity;
        return dayMap.get(project.id!) || defaultActivity;
    }

    return (
        <div className="p-4 pt-2 space-y-4 animate-in fade-in duration-500">

            <div className="flex flex-col lg:flex-row gap-6 h-[92vh] w-full">
                {/* Calendar Section (Stretches to fill space) */}
                <Card className="flex-1 border-none shadow-2xl shadow-slate-200/50 bg-white/80 backdrop-blur-xl overflow-hidden rounded-3xl flex flex-col">
                    <CardHeader className="border-b bg-slate-50/50 px-8 py-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <CardTitle className="text-2xl font-bold text-slate-800">
                                    {monthName} <span className="text-slate-400 font-medium ml-1">{year}</span>
                                </CardTitle>
                                <div className="flex items-center bg-slate-100/50 p-1 rounded-2xl h-10">
                                    {(isAdmin || isDigitalMarketing) && (
                                        <>
                                            <button
                                                onClick={() => setActiveTab('digital-posts')}
                                                className={cn(
                                                    "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                                                    activeTab === 'digital-posts' ? "bg-primary text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                                                )}
                                            >Digital Posts</button>
                                            <button
                                                onClick={() => setActiveTab('digital-updates')}
                                                className={cn(
                                                    "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                                                    activeTab === 'digital-updates' ? "bg-primary text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                                                )}
                                            >Digital Updates</button>
                                        </>
                                    )}
                                    {(isAdmin || !isDigitalMarketing) && (
                                        <button
                                            onClick={() => setActiveTab('dev')}
                                            className={cn(
                                                "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                                                activeTab === 'dev' ? "bg-primary text-white shadow-sm" : "text-slate-400 hover:text-slate-600"
                                            )}
                                        >Dev</button>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2 bg-white p-1 rounded-2xl shadow-sm border">
                                <Button variant="ghost" size="icon" onClick={prevMonth} className="rounded-xl hover:bg-slate-100 h-9 w-9">
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => {
                                    const today = new Date()
                                    setCurrentDate(today)
                                    setSelectedDay(today.getDate())
                                }} className="px-4 font-semibold text-slate-600 rounded-xl hover:bg-slate-100">
                                    Today
                                </Button>
                                <Button variant="ghost" size="icon" onClick={nextMonth} className="rounded-xl hover:bg-slate-100 h-9 w-9">
                                    <ChevronRight className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 flex flex-col">
                        <div className="grid grid-cols-7 border-b bg-slate-50/30">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                                <div key={day} className="py-4 text-center text-xs font-bold uppercase tracking-widest text-slate-400">
                                    {day}
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 flex-1">
                            {days.map((day, idx) => {
                                const isToday = day === new Date().getDate() &&
                                    currentDate.getMonth() === new Date().getMonth() &&
                                    currentDate.getFullYear() === new Date().getFullYear();

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => handleDayClick(day)}
                                        className={cn(
                                            "min-h-[100px] p-4 border-r border-b last:border-r-0 relative transition-all group hover:bg-slate-50/50 cursor-pointer",
                                            !day && "bg-slate-50/20",
                                            day === selectedDay && "bg-primary/[0.03] ring-1 ring-inset ring-primary/20"
                                        )}
                                    >
                                        {day && (
                                            <>
                                                <span className={cn(
                                                    "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold transition-all relative z-10",
                                                    isToday
                                                        ? "bg-primary text-white shadow-lg shadow-primary/40 scale-110"
                                                        : day === selectedDay
                                                            ? "bg-primary/20 text-primary"
                                                            : "text-slate-600 group-hover:text-primary"
                                                )}>
                                                    {day}
                                                </span>

                                                {/* Global Activity Indicators */}
                                                {(() => {
                                                    const cellDate = new Date(year, currentDate.getMonth(), day);
                                                    const today = new Date();
                                                    today.setHours(23, 59, 59, 999);

                                                    // Don't show badges for future dates
                                                    if (cellDate > today) return null;

                                                    const dateStr = `${cellDate.getFullYear()}-${String(cellDate.getMonth() + 1).padStart(2, '0')}-${String(cellDate.getDate()).padStart(2, '0')}`;

                                                    const targetProjects = activeTab === 'dev' ? devProjects : activeTab === 'digital-posts' ? digitalPosts : digitalUpdates;
                                                    const stats = targetProjects.reduce((acc: any, p: any) => {
                                                        const activity = getProjectActivityPrecomputed(p, dateStr);

                                                        if (activeTab === 'digital-posts') {
                                                            // Count each platform separately
                                                            if (activity.posts.facebook) acc.sent++; else acc.pending++;
                                                            if (activity.posts.instagram) acc.sent++; else acc.pending++;
                                                            if (activity.posts.linkedin) acc.sent++; else acc.pending++;
                                                        } else {
                                                            if (activity.hasActivity) acc.sent++;
                                                            else acc.pending++;
                                                        }
                                                        return acc;
                                                    }, { sent: 0, pending: 0 });

                                                    if (targetProjects.length === 0) return null;

                                                    return (
                                                        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2.5 px-2">
                                                            {stats.sent > 0 && (
                                                                <div className="h-6 min-w-[24px] px-1.5 py-0.5 rounded-full bg-emerald-100 border-2 border-emerald-200/50 flex items-center justify-center animate-in zoom-in duration-300 shadow-sm">
                                                                    <span className="text-[11px] font-black text-emerald-700 leading-none">{stats.sent}</span>
                                                                </div>
                                                            )}
                                                            {stats.pending > 0 && (
                                                                <div className="h-6 min-w-[24px] px-1.5 py-0.5 rounded-full bg-rose-100 border-2 border-rose-200/50 flex items-center justify-center animate-in zoom-in duration-300 shadow-sm">
                                                                    <span className="text-[11px] font-black text-rose-700 leading-none">{stats.pending}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>

                {/* Details Section */}
                <Card className="lg:w-[450px] shrink-0 border-none shadow-2xl shadow-slate-200/50 bg-white/90 backdrop-blur-xl overflow-hidden rounded-3xl flex flex-col animate-in slide-in-from-right duration-500">
                    <CardHeader className="pb-6 border-b bg-slate-50/30">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <LucideCalendar className="h-5 w-5" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest text-primary/70">Day Details</span>
                        </div>
                        <CardTitle className="text-xl font-bold text-slate-900 leading-tight">
                            {selectedDay ? getSelectedFullDate() : "Select a day"}
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="flex-1 overflow-y-auto py-6 px-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        {!selectedDay ? (
                            <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                <div className="p-4 bg-slate-50 rounded-full mb-4">
                                    <CalendarIcon className="h-8 w-8 text-slate-300" />
                                </div>
                                <p className="text-slate-500 font-medium">Click on a date to view <br /> daily details.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                        {activeTab === 'dev' ? 'Dev Activities' : activeTab === 'digital-posts' ? 'Social Content' : 'Marketing Updates'}
                                    </h4>
                                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                        {activeTab === 'dev' ? devProjects.length : activeTab === 'digital-posts' ? digitalPosts.length : digitalUpdates.length}
                                    </span>
                                </div>
                                <div className="grid gap-4">
                                    {(() => {
                                        const projectList = activeTab === 'dev' ? devProjects : activeTab === 'digital-posts' ? digitalPosts : digitalUpdates;
                                        const date = new Date(year, currentDate.getMonth(), selectedDay);
                                        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

                                        const sortedProjects = [...projectList].sort((a, b) => {
                                            const activityA = getProjectActivityPrecomputed(a, dateStr).hasActivity;
                                            const activityB = getProjectActivityPrecomputed(b, dateStr).hasActivity;
                                            if (activityA === activityB) return 0;
                                            return activityA ? -1 : 1;
                                        });

                                        const ProjectLogo = ({ project }: { project: any }) => {
                                            const [imgError, setImgError] = useState(false);
                                            const showFallback = !project.logo || imgError;

                                            return (
                                                <div className={cn(
                                                    "h-8 w-8 rounded-lg shrink-0 flex items-center justify-center overflow-hidden border border-slate-50 shadow-inner bg-white",
                                                    showFallback && (activeTab === 'digital' ? "bg-emerald-50 text-emerald-500" : "bg-blue-50 text-blue-500")
                                                )}>
                                                    {!showFallback ? (
                                                        <img
                                                            src={project.logo}
                                                            alt={project.name}
                                                            onError={() => setImgError(true)}
                                                            className={cn(
                                                                "h-full w-full object-center transition-transform group-hover:scale-110 duration-500",
                                                                project.logoFit === 'contain' ? "object-contain p-0.5" : "object-cover"
                                                            )}
                                                        />
                                                    ) : (
                                                        activeTab === 'digital' ? <Globe className="h-4 w-4" /> : <FolderIcon className="h-4 w-4" />
                                                    )}
                                                </div>
                                            );
                                        };

                                        return sortedProjects.length > 0 ? sortedProjects.map((project) => {
                                            const projectActivity = getProjectActivityPrecomputed(project, dateStr);
                                            const { hasActivity } = projectActivity;

                                            return (
                                                <div key={project.id} className="group p-2.5 rounded-xl border bg-white border-slate-100 shadow-sm transition-all hover:bg-slate-50/50">
                                                    <div className="flex items-center gap-3">
                                                        <ProjectLogo project={project} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-bold text-slate-800 truncate">{project.name}</p>
                                                            <p className="text-[10px] text-slate-400 font-medium truncate">{project.client}</p>
                                                        </div>
                                                        <div className="shrink-0">
                                                            {activeTab === 'digital-posts' ? (
                                                                <div className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-lg border border-slate-100 shadow-inner">
                                                                    <Facebook
                                                                        className={cn("h-4 w-4 cursor-pointer transition-all hover:scale-125", projectActivity.posts.facebook ? "text-blue-600 fill-blue-600/10 opacity-100" : "text-slate-300 opacity-40 hover:opacity-80")}
                                                                        onClick={() => handleSocialClick(project, 'facebook', dateStr)}
                                                                        onDoubleClick={() => handleSocialDoubleClick(project, 'facebook', dateStr)}
                                                                        onContextMenu={(e) => handleSocialRightClick(e, project, 'facebook', dateStr)}
                                                                    />
                                                                    <Instagram
                                                                        className={cn("h-4 w-4 cursor-pointer transition-all hover:scale-125", projectActivity.posts.instagram ? "text-rose-500 opacity-100" : "text-slate-300 opacity-40 hover:opacity-80")}
                                                                        onClick={() => handleSocialClick(project, 'instagram', dateStr)}
                                                                        onDoubleClick={() => handleSocialDoubleClick(project, 'instagram', dateStr)}
                                                                        onContextMenu={(e) => handleSocialRightClick(e, project, 'instagram', dateStr)}
                                                                    />
                                                                    <Linkedin
                                                                        className={cn("h-4 w-4 cursor-pointer transition-all hover:scale-125", projectActivity.posts.linkedin ? "text-blue-700 fill-blue-700/10 opacity-100" : "text-slate-300 opacity-40 hover:opacity-80")}
                                                                        onClick={() => handleSocialClick(project, 'linkedin', dateStr)}
                                                                        onDoubleClick={() => handleSocialDoubleClick(project, 'linkedin', dateStr)}
                                                                        onContextMenu={(e) => handleSocialRightClick(e, project, 'linkedin', dateStr)}
                                                                    />
                                                                </div>
                                                            ) : hasActivity ? (
                                                                <div className="h-7 w-7 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-200">
                                                                    <Check className="h-4 w-4 text-white" />
                                                                </div>
                                                            ) : (
                                                                <div className="h-7 w-7 rounded-full bg-rose-500 flex items-center justify-center shadow-sm shadow-rose-200">
                                                                    <X className="h-4 w-4 text-white" />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }) : (
                                            <div className="py-8 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
                                                <p className="text-xs text-slate-400 font-medium">No projects found in this category</p>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            {/* Link Entry Dialog */}
            <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
                <DialogContent className="sm:max-w-md rounded-3xl border-none shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 capitalize text-xl font-bold text-slate-800">
                            {linkPlatform === 'facebook' && <Facebook className="h-5 w-5 text-blue-600" />}
                            {linkPlatform === 'instagram' && <Instagram className="h-5 w-5 text-rose-500" />}
                            {linkPlatform === 'linkedin' && <Linkedin className="h-5 w-5 text-blue-700" />}
                            Add {linkPlatform} Post Link
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="post-link" className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                                Paste the live post URL below
                            </Label>
                            <Input
                                id="post-link"
                                placeholder="https://..."
                                value={postLink}
                                onChange={(e) => setPostLink(e.target.value)}
                                className="h-12 rounded-2xl border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-primary/20 transition-all"
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setIsLinkDialogOpen(false)} disabled={isSavingLink} className="rounded-2xl font-bold text-slate-400 hover:text-slate-600">
                            Cancel
                        </Button>
                        <Button onClick={handleSaveLink} disabled={isSavingLink} className="rounded-2xl px-8 bg-primary hover:bg-primary/90 font-bold shadow-lg shadow-primary/20">
                            {isSavingLink ? "Saving..." : "Save Link"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-xl font-bold text-slate-800">Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-500 font-medium pt-2">
                            This will permanently delete the <span className="text-slate-800 font-bold capitalize">{deletePlatform}</span> post record for <span className="text-slate-800 font-bold">{deleteTargetDate}</span>.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
                        <AlertDialogCancel className="rounded-2xl font-bold text-slate-400 hover:text-slate-600 border-none bg-slate-100/50">
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleConfirmDelete();
                            }}
                            className="rounded-2xl px-8 bg-rose-500 hover:bg-rose-600 stroke-none font-bold shadow-lg shadow-rose-200"
                        >
                            {isDeletingLink ? "Deleting..." : "Delete Record"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

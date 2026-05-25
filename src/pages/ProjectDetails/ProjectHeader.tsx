import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { 
    ArrowLeft, MessageSquare, Paperclip, Sparkles, Zap, 
    Calendar, ChevronLeft, ChevronRight, Eye, EyeOff, ClipboardList
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ProjectHeaderProps {
    project: any;
    navigate: any;
    isAdmin: boolean;
    isClient: boolean;
    currentEmployee: any;
    selectedMonth: string;
    onViewPrevMonth: () => void;
    onViewNextMonth: () => void;
    onOpenChat: () => void;
    onOpenResources: () => void;
    onOpenAISheet: () => void;
    onOpenPostGen: () => void;
    onOpenTemplateTasks: () => void;
    onClearAll: () => void;
    statusFilter: string;
    setStatusFilter: (s: string) => void;
    showMyTasks: boolean;
    setShowMyTasks: (b: boolean) => void;
}

export function ProjectHeader({
    project, navigate, isAdmin, isClient, selectedMonth,
    onViewPrevMonth, onViewNextMonth, onOpenChat, onOpenResources,
    onOpenAISheet, onOpenPostGen, onOpenTemplateTasks, onClearAll,
    statusFilter, setStatusFilter, showMyTasks, setShowMyTasks
}: ProjectHeaderProps) {
    if (!project) return null;

    return (
        <div className="flex flex-col space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/tasks')} className="rounded-full">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12 rounded-xl border-2 border-slate-100 shadow-sm">
                            <AvatarImage src={project.logo} className={project.logoFit === 'contain' ? 'object-contain p-1' : 'object-cover'} />
                            <AvatarFallback className="bg-primary/5 text-primary text-xl font-bold">{project.name[0]}</AvatarFallback>
                        </Avatar>
                        <div>jsdfjbf</div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{project.name}</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200">
                                    {project.category}
                                </Badge>
                                <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Started {project.startDate || "N/A"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="hidden md:flex flex-col items-end mr-4">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Project Progress</span>
                        <div className="flex items-center gap-3 w-48">
                            <Progress value={project.progress || 0} className="h-2 bg-slate-100" />
                            <span className="text-xs font-bold text-slate-700">{project.progress || 0}%</span>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={onOpenChat}>
                        <MessageSquare className="h-4 w-4 text-primary" />
                        Team Chat
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={onOpenResources}>
                        <Paperclip className="h-4 w-4 text-slate-500" />
                        Resources
                    </Button>
                    {isAdmin && (
                        <Button className="gap-2 rounded-xl shadow-lg shadow-primary/20" onClick={() => navigate(`/projects`)}>
                            Manage Project
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-primary/20 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <ClipboardList className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Tasks Completed</p>
                            <h3 className="text-2xl font-bold text-slate-900">
                                {(project.milestones || []).filter((m: any) => m.status === 'Completed').length}
                                <span className="text-sm font-medium text-slate-400 ml-1">/ {(project.milestones || []).length}</span>
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-primary/20 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                            <Zap className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">Active Sprints</p>
                            <h3 className="text-2xl font-bold text-slate-900">
                                {(project.milestones || []).filter((m: any) => m.status === 'In Progress').length}
                                <span className="text-sm font-medium text-slate-400 ml-1 decoration-transparent decoration-white">Tasks</span>
                            </h3>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-primary/20 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500">AI Assistance</p>
                            <div className="flex items-center gap-2 mt-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all"
                                    onClick={onOpenAISheet}
                                >
                                    Quick Import
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all"
                                    onClick={onOpenPostGen}
                                >
                                    Post Gen
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all"
                                    onClick={onOpenTemplateTasks}
                                >
                                    Templates
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onViewPrevMonth}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm font-bold px-2 min-w-[120px] text-center">{selectedMonth}</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onViewNextMonth}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                        {["All", "Pending", "In Progress", "Completed"].map((status) => (
                            <Button
                                key={status}
                                variant="ghost"
                                size="sm"
                                onClick={() => setStatusFilter(status)}
                                className={cn(
                                    "h-8 px-3 rounded-lg text-xs font-bold transition-all",
                                    statusFilter === status
                                        ? "bg-slate-900 text-white shadow-md scale-105 hover:bg-slate-800 hover:text-white"
                                        : "text-slate-500 hover:bg-slate-100"
                                )}
                            >
                                {status}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {!isAdmin && !isClient && (
                        <div
                            onClick={() => setShowMyTasks(!showMyTasks)}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-xl border cursor-pointer transition-all hover:scale-105 active:scale-95",
                                showMyTasks
                                    ? "bg-primary/10 border-primary text-primary shadow-sm"
                                    : "bg-white border-slate-200 text-slate-400"
                            )}
                        >
                            {showMyTasks ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            <span className="text-xs font-bold uppercase tracking-wider">My Tasks</span>
                        </div>
                    )}
                    {isAdmin && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl px-4"
                            onClick={onClearAll}
                        >
                            Clear All
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}

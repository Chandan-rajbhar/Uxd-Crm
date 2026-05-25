import {
    Sheet,
    SheetContent,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
    Calendar,
    Clock,
    Github,
    Figma,
    ExternalLink,
    Copy,
    FileText,
    Briefcase,
    Trash2,
    Loader2,
    Zap,
} from "lucide-react"
import { useState, useMemo } from "react"
import { useAuth } from '@/contexts/AuthContext'
import { useEmployees } from 'src/hooks/useEmployees'

import { projectService } from "src/firebase/projectService"
import { ScheduleMeetingSheet } from "./ScheduleMeetingSheet"

interface ProjectDetailsSheetProps {
    project: any
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ProjectDetailsSheet({ project, open, onOpenChange }: ProjectDetailsSheetProps) {
    const [isDeleting, setIsDeleting] = useState(false)
    const [isScheduleOpen, setIsScheduleOpen] = useState(false)
    const { user, isAdmin, isClient } = useAuth()
    const { employees } = useEmployees()

    // Find the current employee record based on Auth UID
    const currentEmployee = useMemo(() => {
        if (user && employees.length > 0) {
            return employees.find(e => e.authUid === user.uid || e.email === user.email)
        }
        return null
    }, [user, employees])

    // Filter milestones based on assignment for employees
    const filteredMilestones = useMemo(() => {
        if (!project || !project.milestones) return []

        if (!isAdmin && !isClient && currentEmployee) {
            const isTeamMember = (currentEmployee.team && (project.assignedTeams?.includes(currentEmployee.team) || project.assignedTeam === currentEmployee.team)) ||
                project.devTeam?.some((d: any) => (typeof d === 'string' ? d : d.name) === currentEmployee.name);

            if (isTeamMember) return project.milestones;

            return project.milestones.filter((m: any) => {
                const assignees = Array.isArray(m.assignedTo) ? m.assignedTo : (m.assignedTo ? [m.assignedTo] : []);
                return assignees.some((a: any) => (typeof a === 'string' ? a : a.name) === currentEmployee.name);
            })
        }

        return project.milestones
    }, [project, currentEmployee, isAdmin, isClient])


    if (!project) return null

    const handleDelete = async () => {
        if (!window.confirm("Are you sure you want to delete this project?")) return
        setIsDeleting(true)
        try {
            await projectService.deleteProject(project.id)
            onOpenChange(false)
        } catch (error) {
            console.error("Delete failed:", error)
        } finally {
            setIsDeleting(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[700px] overflow-y-auto flex flex-col p-0 gap-0">
                {/* Premium Header Background */}
                <div className="h-32 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent relative border-b">
                    <div className="absolute -bottom-10 left-8">
                        <Avatar className="h-20 w-20 border-4 border-background rounded-2xl shadow-xl bg-background">
                            <AvatarImage
                                src={project.logo}
                                className={project.logoFit === 'contain' ? 'object-contain scale-125' : 'object-cover'}
                            />
                            <AvatarFallback className="text-2xl rounded-2xl bg-primary/10 text-primary font-bold">
                                {project.name ? project.name[0] : 'P'}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                    <div className="absolute top-4 right-4 flex gap-2">
                        <Button
                            variant="destructive"
                            size="sm"
                            className="bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white border-red-200"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                            {isDeleting ? "Deleting..." : "Delete Project"}
                        </Button>
                    </div>
                </div>

                <div className="px-8 pt-14 pb-6 space-y-6">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold tracking-tight">{project.name}</h2>
                            <p className="text-muted-foreground flex items-center gap-2">
                                <Briefcase className="h-4 w-4" />
                                {project.client}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <Badge variant={
                                project.priority === "Critical" ? "destructive" :
                                    project.priority === "High" ? "default" :
                                        project.priority === "Medium" ? "secondary" : "outline"
                            } className="rounded-full px-3 py-1">
                                {project.priority} Priority
                            </Badge>
                            <Badge variant="outline" className="rounded-full bg-primary/5 text-primary border-primary/20">
                                {project.status}
                            </Badge>
                            {project.category && (
                                <Badge variant="secondary" className="rounded-full bg-slate-100 text-slate-600 border-slate-200">
                                    {project.category}
                                </Badge>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-5 gap-4 py-4 border-y border-border/50">
                        <div className="space-y-1 text-center">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Budget</p>
                            <p className="text-sm font-bold">{project.budget}</p>
                        </div>
                        <div className="space-y-1 text-center border-l border-border/50">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Start Date</p>
                            <p className="text-sm font-bold">{project.startDate || "-"}</p>
                        </div>
                        <div className="space-y-1 text-center border-l border-border/50">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">End Date</p>
                            <p className="text-sm font-bold">{project.endDate || "-"}</p>
                        </div>
                        <div className="space-y-1 text-center border-l border-border/50">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Team</p>
                            <p className="text-sm font-bold">{project.team?.length || 0} Members</p>
                        </div>
                        <div className="space-y-1 text-center border-l border-border/50">
                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Completion</p>
                            <p className="text-sm font-bold text-primary">{project.progress}%</p>
                        </div>
                    </div>

                    <Tabs defaultValue="overview" className="w-full">
                        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
                            <TabsTrigger value="overview" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 py-3 text-sm font-medium">Overview</TabsTrigger>
                            <TabsTrigger value="milestones" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 py-3 text-sm font-medium">Milestones</TabsTrigger>
                            <TabsTrigger value="resources" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 py-3 text-sm font-medium">Resources</TabsTrigger>
                            <TabsTrigger value="team" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 py-3 text-sm font-medium">Team</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="space-y-6 pt-6 animate-in fade-in duration-500">
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    Project Scope
                                </h3>
                                <div className="p-4 rounded-xl bg-muted/30 border text-sm leading-relaxed text-muted-foreground">
                                    {project.notes || `This project aims to revitalize the digital presence of ${project.client} through a modern design language and improved user experience. The scope covers initial research, high-fidelity wireframing, and a complete frontend implementation.`}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-primary" />
                                    Current Progress
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-medium">
                                        <span>Completion Status</span>
                                        <span>{project.progress}%</span>
                                    </div>
                                    <Progress value={project.progress} className="h-2 rounded-full" />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="milestones" className="space-y-4 pt-6 animate-in fade-in duration-500">
                            <div className="space-y-4">
                                {filteredMilestones && filteredMilestones.length > 0 ? (
                                    filteredMilestones.map((m: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-4 rounded-xl border bg-card/50 hover:bg-muted/30 transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-full bg-primary/10 text-primary">
                                                    <Clock className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-semibold">{m.name || m.task}</p>
                                                        {m.isNewFeature && <Zap className="h-3 w-3 text-blue-600 fill-blue-600" />}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                            <Calendar className="h-3 w-3" />
                                                            Due {m.date}
                                                        </p>
                                                        {m.assignedTo && (
                                                            <div className="flex -space-x-2 ml-2">
                                                                {(Array.isArray(m.assignedTo) ? m.assignedTo : [m.assignedTo]).filter((a: any) => a.name && a.name !== 'Unassigned').map((a: any, i: number) => (
                                                                    <Avatar key={i} className="h-5 w-5 border-2 border-background rounded-full" title={a.name}>
                                                                        <AvatarImage src={a.avatar} />
                                                                        <AvatarFallback className="text-[8px]">{a.name[0]}</AvatarFallback>
                                                                    </Avatar>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-primary">{m.amount ? `$${m.amount}` : m.status}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-10 text-muted-foreground">
                                        <p className="text-sm">No milestones found for you in this project.</p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="resources" className="space-y-6 pt-6 animate-in fade-in duration-500">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Credentials</h4>
                                    <div className="space-y-2">
                                        {project.credentials && Object.keys(project.credentials).length > 0 ? (
                                            Object.entries(project.credentials).map(([key, value]: [string, any]) => (
                                                <div key={key} className="p-3 rounded-lg border bg-muted/20 text-xs space-y-1">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="font-bold uppercase text-primary text-[10px]">{key}</span>
                                                        <ExternalLink className="h-3 w-3 text-muted-foreground cursor-pointer hover:text-primary" />
                                                    </div>
                                                    <div className="flex justify-between items-center bg-background/50 p-2 rounded">
                                                        <span className="text-muted-foreground truncate mr-2">{value.email}</span>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-primary/10 hover:text-primary">
                                                            <Copy className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-xs text-muted-foreground pl-1">No credentials added.</p>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <h4 className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest pl-1">Design & Code</h4>
                                    <div className="space-y-2">
                                        {project.links && (project.links.figma || project.links.github) ? (
                                            <>
                                                {project.links.figma && (
                                                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => window.open(project.links.figma, '_blank')}>
                                                        <div className="h-8 w-8 rounded bg-[#1a1a2e] flex items-center justify-center">
                                                            <Figma className="h-4 w-4 text-white" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-xs font-semibold">Figma Design</p>
                                                            <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{project.links.figma}</p>
                                                        </div>
                                                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                )}
                                                {project.links.github && (
                                                    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:border-primary/50 transition-colors cursor-pointer group" onClick={() => window.open(project.links.github, '_blank')}>
                                                        <div className="h-8 w-8 rounded bg-[#24292e] flex items-center justify-center">
                                                            <Github className="h-4 w-4 text-white" />
                                                        </div>
                                                        <div className="flex-1">
                                                            <p className="text-xs font-semibold">GitHub Repo</p>
                                                            <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">{project.links.github}</p>
                                                        </div>
                                                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <p className="text-xs text-muted-foreground pl-1">No resources linked.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="team" className="pt-6 animate-in fade-in duration-500">
                            <div className="grid grid-cols-2 gap-4">
                                {project.team && project.team.length > 0 ? (
                                    project.team.map((member: any, i: number) => (
                                        <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border bg-card/50">
                                            <Avatar className="h-12 w-12 border-2 border-primary/20">
                                                <AvatarImage src={member.avatar} />
                                                <AvatarFallback>{member.name[0]}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="text-sm font-bold">{member.name}</p>
                                                <p className="text-xs text-muted-foreground">Team Member</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="col-span-2 text-center py-10 text-muted-foreground">
                                        <p className="text-sm">No team members assigned.</p>
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <ScheduleMeetingSheet
                    open={isScheduleOpen}
                    onOpenChange={setIsScheduleOpen}
                    project={project}
                />
            </SheetContent>
        </Sheet>
    )
}

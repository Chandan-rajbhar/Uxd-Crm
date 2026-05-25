import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "src/components/ui/table"
import { Badge } from "src/components/ui/badge"
import { Button } from "src/components/ui/button"
import { Input } from "src/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "src/components/ui/avatar"
import { Progress } from "src/components/ui/progress"
import { MoreHorizontal, ListFilter, Target, Key, Link2, Github, Figma, ExternalLink, Copy, Info, Eye, Edit, Trash2, FolderSearch, Loader2, FileText, Plus, ChevronDown, Users } from "lucide-react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "src/components/ui/select"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "src/components/ui/dropdown-menu"
import { Tabs, TabsList, TabsTrigger } from "src/components/ui/tabs"
import { ProjectDetailsSheet } from "src/components/ProjectDetailsSheet"
import { AddProjectSheet } from "src/components/AddProjectSheet"
import { useState, useEffect } from "react"
import { projectService } from "src/firebase/projectService"
import { settingsService } from "src/firebase/settingsService"
import { toast } from "sonner"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"

import { useProjects } from 'src/hooks/useProjects'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "src/components/ui/alert-dialog"

import { TrashBinAnimation } from "src/components/TrashBinAnimation"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "src/components/ui/empty"

export default function ProjectsPage() {
    const [categoryTab, setCategoryTab] = useState<string>(() => localStorage.getItem('tracker_selectedCategory') || "Development")
    const [teamFilter, setTeamFilter] = useState("all")
    const [expandedCard, setExpandedCard] = useState<string | null>(null)
    const { projects, loading } = useProjects()
    const [selectedProject, setSelectedProject] = useState<any>(null)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)

    // Edit State
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [projectToEdit, setProjectToEdit] = useState<any>(null)

    // Delete State
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [projectToDelete, setProjectToDelete] = useState<any>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Search State
    const [searchTerm, setSearchTerm] = useState("")

    // Filter projects based on search term, category and team
    const filteredProjects = projects.filter(project => {
        const search = searchTerm.toLowerCase()
        const matchesSearch = (
            project.name?.toLowerCase().includes(search) ||
            project.client?.toLowerCase().includes(search)
        )

        const isInternal = project.category === 'Internal' || !project.client || project.client === 'None' || project.client?.toLowerCase().includes('internal');

        let matchesCategory = false;
        if (categoryTab === 'Internal') {
            matchesCategory = isInternal;
        } else {
            matchesCategory = project.category === categoryTab && !isInternal;
        }

        const projectTeams = project.assignedTeams || (project.assignedTeam ? [project.assignedTeam] : []);
        const matchesTeam = teamFilter === 'all' || projectTeams.includes(teamFilter);

        return matchesSearch && matchesCategory && matchesTeam;
    })

    const [availableTeams, setAvailableTeams] = useState<string[]>([])
    const [searchTeam, setSearchTeam] = useState("")

    useEffect(() => {
        const unsubscribe = settingsService.subscribeToTeams((teams) => {
            setAvailableTeams(teams);
        });
        return () => unsubscribe();
    }, []);

    const handleAssignTeam = async (project: any, team: string) => {
        try {
            const currentTeams = project.assignedTeams || (project.assignedTeam ? [project.assignedTeam] : []);
            let newTeams: string[];

            if (team === "") {
                // Clear all
                newTeams = [];
            } else {
                if (currentTeams.includes(team)) {
                    newTeams = currentTeams.filter((t: string) => t !== team);
                } else {
                    newTeams = [...currentTeams, team];
                }
            }

            await projectService.updateProject(project.id!, {
                assignedTeams: newTeams,
                assignedTeam: newTeams.length > 0 ? newTeams[0] : ""
            });
            toast.success(`Team assignment updated`);
        } catch (error) {
            console.error("Failed to assign team:", error);
            toast.error("Failed to assign team");
        }
    }

    const handleViewProject = (project: any) => {
        setSelectedProject(project)
        setIsDetailsOpen(true)
    }

    const handleEditProject = (project: any) => {
        setProjectToEdit(project)
        setIsEditOpen(true)
    }

    const handleDeleteClick = (project: any) => {
        setProjectToDelete(project)
        setIsDeleteOpen(true)
    }



    const confirmDelete = async () => {
        if (projectToDelete?.id) {
            setIsDeleting(true)
            try {
                // Wait for animation (min 2 seconds) + delete operation
                await Promise.all([
                    projectService.deleteProject(projectToDelete.id),
                    new Promise(resolve => setTimeout(resolve, 2000))
                ])
            } catch (error) {
                console.error("Failed to delete project:", error)
                // In a real app, show a toast notification here
            } finally {
                setIsDeleting(false)
                setIsDeleteOpen(false)
                setProjectToDelete(null)
            }
        }
    }

    return (
        <div className="flex-1 flex flex-col p-4 pt-3 md:p-8 md:pt-6 min-h-[calc(100vh-4.5rem)]">
            <ProjectDetailsSheet
                project={selectedProject}
                open={isDetailsOpen}
                onOpenChange={setIsDetailsOpen}
            />

            <AddProjectSheet
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                projectToEdit={projectToEdit}
                trigger={null}
            />

            <AlertDialog open={isDeleteOpen} onOpenChange={(open) => {
                if (!isDeleting) {
                    setIsDeleteOpen(open)
                    if (!open) {
                        setProjectToDelete(null)
                    }
                }
            }}>
                <AlertDialogContent className="sm:max-w-[425px]">
                    {isDeleting ? (
                        <div className="py-8">
                            <TrashBinAnimation />
                        </div>
                    ) : (
                        <>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the project
                                    <span className="font-semibold text-foreground"> {projectToDelete?.name} </span>
                                    and remove all associated data.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={(e) => {
                                        e.preventDefault();
                                        confirmDelete();
                                    }}
                                    disabled={isDeleting}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </>
                    )}
                </AlertDialogContent>
            </AlertDialog>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight">Projects</h2>
                    <p className="text-muted-foreground text-sm">Manage and track your project milestones & teams.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Tabs value={categoryTab} onValueChange={setCategoryTab} className="w-[450px]">
                        <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1">
                            <TabsTrigger value="Development" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs">Development</TabsTrigger>
                            <TabsTrigger value="Digital Marketing" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs">Digital Marketing</TabsTrigger>
                            <TabsTrigger value="Internal" className="data-[state=active]:bg-white data-[state=active]:shadow-sm text-xs">Internal</TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {(loading || projects.length > 0) && (
                <div className="flex items-center justify-between gap-2 md:gap-4 mb-4 md:mb-6">
                    <div className="flex items-center gap-2 flex-1">
                        <Input
                            placeholder="Search projects..."
                            className="max-w-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Select value={teamFilter} onValueChange={setTeamFilter}>
                            <SelectTrigger className="h-10 w-[150px] justify-center bg-white" icon={null}>
                                <Users className="h-4 w-4 mr-2 text-primary" />
                                <span className="truncate font-medium">{teamFilter === 'all' ? 'All Teams' : teamFilter}</span>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Teams</SelectItem>
                                {availableTeams.map(team => (
                                    <SelectItem key={team} value={team}>{team}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select defaultValue="all">
                            <SelectTrigger className="h-8 w-8 p-0 justify-center" icon={null}>
                                <ListFilter className="h-4 w-4" />
                                <span className="sr-only">Filter by Status</span>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="in-progress">In Progress</SelectItem>
                                <SelectItem value="planning">Planning</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="pending">Pending</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select defaultValue="all">
                            <SelectTrigger className="h-8 w-8 p-0 justify-center" icon={null}>
                                <Target className="h-4 w-4" />
                                <span className="sr-only">Filter by Priority</span>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Priorities</SelectItem>
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <AddProjectSheet />
                </div>
            )}

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse font-medium">Loading projects...</p>
                </div>
            ) : projects.length === 0 ? (
                <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-200px)]">
                    <Empty className="max-w-md">
                        <EmptyMedia className="h-20 w-20 bg-primary/5 rounded-full mb-4">
                            <FolderSearch className="h-10 w-10 text-primary/40" />
                        </EmptyMedia>
                        <EmptyHeader>
                            <EmptyTitle className="text-2xl">Create your first project</EmptyTitle>
                            <EmptyDescription className="text-base">
                                You haven't added any projects yet. Start by creating a project to track milestones, manage resources, and generate client updates.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <AddProjectSheet trigger={
                                <Button size="lg" className="px-8 shadow-lg shadow-primary/20 transition-all hover:scale-105">
                                    <Plus className="mr-2 h-5 w-5" /> Start Project
                                </Button>
                            } />
                        </EmptyContent>
                    </Empty>
                </div>
            ) : (
                <>
                {/* Mobile Card View */}
                <div className="md:hidden space-y-3">
                    {filteredProjects.map((project) => {
                        const isExpanded = expandedCard === project.id
                        return (
                            <div
                                key={project.id || project.name}
                                className={cn(
                                    "rounded-2xl bg-white overflow-hidden transition-all duration-300",
                                    isExpanded 
                                        ? "shadow-[0_4px_24px_rgba(0,0,0,0.08)]" 
                                        : "shadow-[0_1px_8px_rgba(0,0,0,0.04)] active:shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
                                )}
                            >
                                <div
                                    className="flex items-center gap-3 p-3.5 cursor-pointer transition-colors"
                                    onClick={() => setExpandedCard(isExpanded ? null : project.id!)}
                                >
                                    <Avatar className="h-9 w-9 rounded-xl shadow-sm shrink-0">
                                        <AvatarImage
                                            src={project.logo}
                                            alt={project.name}
                                            className={project.logoFit === 'contain' ? 'object-contain scale-125' : 'object-cover'}
                                        />
                                        <AvatarFallback className="rounded-xl text-[10px] font-black bg-gradient-to-br from-primary/10 to-primary/5 text-primary">{project.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-semibold truncate leading-tight">{project.name}</p>
                                        <p className="text-[11px] text-muted-foreground/70 truncate mt-0.5">{project.client || "No client"}</p>
                                    </div>
                                    <div className="flex -space-x-1 shrink-0">
                                        {(() => {
                                            const getTeamDisplay = (teamName: string) => {
                                                const match = teamName.match(/Team\s+([A-Za-z0-9])/i);
                                                const initial = match ? match[1].toUpperCase() : teamName.substring(0, 2).toUpperCase();
                                                const colorMap: Record<string, string> = {
                                                    'A': 'bg-blue-600', 'B': 'bg-indigo-600', 'C': 'bg-emerald-600',
                                                    'D': 'bg-orange-600', 'E': 'bg-rose-600', 'F': 'bg-purple-600',
                                                    'G': 'bg-cyan-600', 'H': 'bg-amber-600',
                                                };
                                                return { initial, bgColor: colorMap[initial] || 'bg-primary' };
                                            };
                                            const teams = (project.assignedTeams?.length ?? 0) > 0 
                                                ? project.assignedTeams 
                                                : project.assignedTeam ? [project.assignedTeam] : [];
                                            if (!teams || teams.length === 0) return <span className="text-[9px] text-muted-foreground/40 font-semibold">—</span>;
                                            return teams.slice(0, 3).map((team: string) => {
                                                const { initial, bgColor } = getTeamDisplay(team);
                                                return (
                                                    <div key={team} className={cn("h-5 w-5 rounded-full ring-2 ring-white flex items-center justify-center text-[8px] font-black text-white", bgColor)}>
                                                        {initial}
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground/40 transition-transform duration-300 shrink-0", isExpanded && "rotate-180 text-primary")} />
                                </div>

                                {isExpanded && (
                                    <div className="px-3.5 pb-3.5 space-y-3 animate-in slide-in-from-top-1 duration-200">

                                        {/* Details Row */}
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {project.category && (
                                                <div className={cn(
                                                    "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                                                    project.category === 'Development' ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                                                )}>{project.category}</div>
                                            )}
                                            <div className="text-[10px] text-muted-foreground/60">
                                                {project.startDate || "—"} → {project.endDate || "—"}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 pt-1">
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 text-[11px] flex-1 rounded-xl font-medium hover:bg-primary/5 hover:text-primary"
                                                onClick={(e) => { e.stopPropagation(); handleViewProject(project) }}
                                            >
                                                <Eye className="h-3.5 w-3.5 mr-1.5" /> View
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 text-[11px] flex-1 rounded-xl font-medium hover:bg-primary/5 hover:text-primary"
                                                onClick={(e) => { e.stopPropagation(); handleEditProject(project) }}
                                            >
                                                <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-8 text-[11px] rounded-xl font-medium text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                                onClick={(e) => { e.stopPropagation(); handleDeleteClick(project) }}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block">
                    <Table>
                        <TableHeader className="bg-gray-50">
                            <TableRow>
                                <TableHead className="py-3">Project Name</TableHead>
                                <TableHead className="py-3">Client</TableHead>
                                <TableHead className="py-3">Team</TableHead>
                                <TableHead className="py-3">Status</TableHead>
                                <TableHead className="py-3">Project Type</TableHead>
                                <TableHead className="py-3">Progress</TableHead>
                                <TableHead className="py-3 text-center">Resources</TableHead>
                                <TableHead className="py-3">Start Date</TableHead>
                                <TableHead className="py-3">End Date</TableHead>
                                <TableHead className="text-right py-3">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProjects.map((project) => (
                                <TableRow
                                    key={project.id || project.name}
                                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                                    onClick={() => handleViewProject(project)}
                                >
                                    <TableCell className="font-medium py-3">
                                        <div className="flex items-center gap-3 group">
                                            <Avatar className="h-9 w-9 rounded-lg group-hover:scale-105 transition-transform duration-200 shadow-sm border">
                                                <AvatarImage
                                                    src={project.logo}
                                                    alt={project.name}
                                                    className={project.logoFit === 'contain' ? 'object-contain scale-125' : 'object-cover'}
                                                />
                                                <AvatarFallback className="rounded-lg">{project.name[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-semibold group-hover:text-primary transition-colors">{project.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3">{project.client || "-"}</TableCell>

                                    <TableCell className="py-3">
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    role="combobox"
                                                    className="h-8 p-0 hover:bg-transparent"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {(() => {
                                                        const getTeamDisplay = (teamName: string) => {
                                                            const match = teamName.match(/Team\s+([A-Za-z0-9])/i);
                                                            const initial = match ? match[1].toUpperCase() : teamName.substring(0, 2).toUpperCase();
                                                            const colorMap: Record<string, string> = {
                                                                'A': 'bg-blue-600',
                                                                'B': 'bg-indigo-600',
                                                                'C': 'bg-emerald-600',
                                                                'D': 'bg-orange-600',
                                                                'E': 'bg-rose-600',
                                                                'F': 'bg-purple-600',
                                                                'G': 'bg-cyan-600',
                                                                'H': 'bg-amber-600',
                                                            };
                                                            return { initial, bgColor: colorMap[initial] || 'bg-primary' };
                                                        };

                                                        if (project.assignedTeams && project.assignedTeams.length > 0) {
                                                            return (
                                                                <div className="flex -space-x-1 overflow-hidden">
                                                                    {project.assignedTeams.slice(0, 3).map((team: string) => {
                                                                        const { initial, bgColor } = getTeamDisplay(team);
                                                                        return (
                                                                            <Avatar key={team} className="inline-block h-6 w-6 rounded-full ring-2 ring-background">
                                                                                <AvatarFallback className={cn("text-[10px] font-black text-white shadow-sm", bgColor)}>
                                                                                    {initial}
                                                                                </AvatarFallback>
                                                                            </Avatar>
                                                                        );
                                                                    })}
                                                                    {project.assignedTeams.length > 3 && (
                                                                        <div className="flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-background bg-muted text-[10px] font-bold text-muted-foreground">
                                                                            +{project.assignedTeams.length - 3}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        } else if (project.assignedTeam) {
                                                            const { initial, bgColor } = getTeamDisplay(project.assignedTeam);
                                                            return (
                                                                <div className="flex -space-x-2 overflow-hidden">
                                                                    <Avatar className="inline-block h-6 w-6 rounded-full ring-2 ring-background text-white">
                                                                        <AvatarFallback className={cn("text-[10px] font-black text-white shadow-sm", bgColor)}>
                                                                            {initial}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                </div>
                                                            );
                                                        } else {
                                                            return <span className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest opacity-40">Unassigned</span>;
                                                        }
                                                    })()}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[200px] p-0" align="start" onClick={(e) => e.stopPropagation()}>
                                                <Command>
                                                    <CommandInput
                                                        placeholder="Search team..."
                                                        value={searchTeam}
                                                        onValueChange={setSearchTeam}
                                                    />
                                                    <CommandEmpty>No team found.</CommandEmpty>
                                                    <CommandGroup className="max-h-[200px] overflow-y-auto">
                                                        <CommandItem
                                                            value="Unassigned"
                                                            onSelect={() => handleAssignTeam(project, "")}
                                                        >
                                                            <Check
                                                                className={cn(
                                                                    "mr-2 h-4 w-4",
                                                                    (!project.assignedTeams || project.assignedTeams.length === 0) && !project.assignedTeam ? "opacity-100" : "opacity-0"
                                                                )}
                                                            />
                                                            Unassigned
                                                        </CommandItem>
                                                        {availableTeams.map((team) => (
                                                            <CommandItem
                                                                key={team}
                                                                value={team}
                                                                onSelect={() => handleAssignTeam(project, team)}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        (project.assignedTeams?.includes(team) || project.assignedTeam === team) ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                {team}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        <Badge variant="outline" className="font-medium">{project.status}</Badge>
                                    </TableCell>
                                    <TableCell className="py-3">
                                        {project.category ? (
                                            <Badge variant="secondary" className={cn(
                                                "font-bold uppercase tracking-wider text-[10px] px-2.5 py-0.5 border-transparent",
                                                project.category === 'Development' ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"
                                            )}>
                                                {project.category}
                                            </Badge>
                                        ) : "-"}
                                    </TableCell>
                                    <TableCell className="w-[180px] py-3">
                                        <div className="flex items-center gap-3">
                                            <Progress value={project.progress} className="h-2 flex-1" />
                                            <span className="text-xs font-bold text-muted-foreground w-8">{project.progress}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="py-3 text-center">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors">
                                                    <Info className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="center" className="w-64 p-2">
                                                {/* Credentials Section */}
                                                {project.credentials && Object.keys(project.credentials).length > 0 && (
                                                    <>
                                                        <DropdownMenuLabel className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                                                            <Key className="h-3.5 w-3.5" />
                                                            Credentials
                                                        </DropdownMenuLabel>
                                                        {Object.entries(project.credentials).map(([key, value]: [string, any]) => (
                                                            <DropdownMenuItem key={key} className="flex flex-col items-start gap-1 py-3 cursor-default focus:bg-transparent">
                                                                <div className="flex items-center justify-between w-full">
                                                                    <span className="text-[10px] font-black uppercase tracking-wider text-primary">{key}</span>
                                                                    {value.url && (
                                                                        <ExternalLink
                                                                            className="h-3 w-3 text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                                                                            onClick={() => window.open(value.url!, '_blank')}
                                                                        />
                                                                    )}
                                                                </div>
                                                                <div className="space-y-1.5 w-full mt-1.5">
                                                                    <div className="flex items-center justify-between text-[10px] bg-muted/40 p-2 rounded-md border border-border/40 group/item">
                                                                        <span className="text-muted-foreground font-medium">User:</span>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="font-mono truncate max-w-[120px]">{value.email}</span>
                                                                            <Copy
                                                                                className="h-2.5 w-2.5 text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                                                                                onClick={() => navigator.clipboard.writeText(value.email)}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center justify-between text-[10px] bg-muted/40 p-2 rounded-md border border-border/40 group/item">
                                                                        <span className="text-muted-foreground font-medium">Pass:</span>
                                                                        <div className="flex items-center gap-1.5">
                                                                            <span className="font-mono">{value.password}</span>
                                                                            <Copy
                                                                                className="h-2.5 w-2.5 text-muted-foreground hover:text-primary cursor-pointer transition-colors"
                                                                                onClick={() => navigator.clipboard.writeText(value.password)}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </DropdownMenuItem>
                                                        ))}
                                                        <DropdownMenuSeparator className="my-1.5" />
                                                    </>
                                                )}

                                                {/* Links Section */}
                                                {project.links && Object.keys(project.links).length > 0 && (
                                                    <>
                                                        <DropdownMenuLabel className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                                                            <Link2 className="h-3.5 w-3.5" />
                                                            Resources
                                                        </DropdownMenuLabel>
                                                        {project.links.figma && (
                                                            <DropdownMenuItem className="flex items-center gap-2.5 cursor-pointer rounded-md" onClick={() => window.open(project.links.figma, '_blank')}>
                                                                <div className="h-5 w-5 bg-[#1a1a2e] flex items-center justify-center rounded text-white overflow-hidden">
                                                                    <Figma className="h-3 w-3" />
                                                                </div>
                                                                <span className="flex-1 text-xs font-medium">Figma Design</span>
                                                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                                            </DropdownMenuItem>
                                                        )}
                                                        {project.links.github && (
                                                            <DropdownMenuItem className="flex items-center gap-2.5 cursor-pointer rounded-md" onClick={() => window.open(project.links.github, '_blank')}>
                                                                <div className="h-5 w-5 bg-[#24292e] flex items-center justify-center rounded text-white overflow-hidden">
                                                                    <Github className="h-3 w-3" />
                                                                </div>
                                                                <span className="flex-1 text-xs font-medium">GitHub Repository</span>
                                                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                                            </DropdownMenuItem>
                                                        )}
                                                        {project.links.docs && (
                                                            <DropdownMenuItem className="flex items-center gap-2.5 cursor-pointer rounded-md" onClick={() => window.open(project.links.docs, '_blank')}>
                                                                <div className="h-5 w-5 bg-blue-500/10 text-blue-600 flex items-center justify-center rounded overflow-hidden">
                                                                    <FileText className="h-3 w-3" />
                                                                </div>
                                                                <span className="flex-1 text-xs font-medium">Documentation</span>
                                                                <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                                            </DropdownMenuItem>
                                                        )}
                                                    </>
                                                )}

                                                {(!project.credentials || Object.keys(project.credentials).length === 0) &&
                                                    (!project.links || Object.keys(project.links).length === 0) && (
                                                        <div className="px-4 py-8 text-center">
                                                            <div className="h-10 w-10 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-2">
                                                                <Link2 className="h-5 w-5 text-muted-foreground/50" />
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground font-medium">No linked resources</p>
                                                        </div>
                                                    )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                    <TableCell className="py-3 font-medium text-muted-foreground">{project.startDate || "-"}</TableCell>
                                    <TableCell className="py-3 font-medium text-muted-foreground">{project.endDate || "-"}</TableCell>
                                    <TableCell className="text-right py-3">
                                        <div className="flex items-center justify-end gap-1">

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted transition-colors rounded-full">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-44 p-1.5 shadow-xl border-border/60">
                                                    <DropdownMenuItem className="flex items-center gap-2.5 cursor-pointer py-2 rounded-md" onClick={() => handleViewProject(project)}>
                                                        <Eye className="h-4 w-4 text-muted-foreground" />
                                                        <span className="font-medium text-sm">View Project</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="flex items-center gap-2.5 cursor-pointer py-2 rounded-md"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleEditProject(project)
                                                        }}
                                                    >
                                                        <Edit className="h-4 w-4 text-muted-foreground" />
                                                        <span className="font-medium text-sm">Edit Details</span>
                                                    </DropdownMenuItem>

                                                    <DropdownMenuSeparator className="my-1" />
                                                    <DropdownMenuItem
                                                        className="flex items-center gap-2.5 cursor-pointer py-2 rounded-md text-red-600 focus:text-red-700 focus:bg-red-50"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteClick(project)
                                                        }}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        <span className="font-medium text-sm">Delete Project</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                </>
            )}
        </div>
    )
}

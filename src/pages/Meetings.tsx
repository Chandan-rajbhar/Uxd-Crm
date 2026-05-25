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
import { MoreHorizontal, Video, Calendar, Search, Loader2, Edit, ExternalLink, CalendarDays, Plus } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "src/components/ui/dropdown-menu"
import { AddProjectSheet } from "src/components/AddProjectSheet"
import { ScheduleMeetingSheet } from "src/components/ScheduleMeetingSheet"
import { useNavigate } from "react-router-dom"
import { useState } from "react"
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "src/components/ui/empty"

import { useProjects } from "src/hooks/useProjects"; // Added import

export default function MeetingsPage() {
    const navigate = useNavigate()
    const { projects, loading } = useProjects()
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [projectToEdit, setProjectToEdit] = useState<any>(null)

    // Schedule State
    const [isScheduleOpen, setIsScheduleOpen] = useState(false)
    const [projectToSchedule, setProjectToSchedule] = useState<any>(null)

    // Search State
    const [searchTerm, setSearchTerm] = useState("")

    // Filter projects based on search term
    const filteredProjects = projects.filter(project => {
        const search = searchTerm.toLowerCase()
        return (
            project.name?.toLowerCase().includes(search) ||
            project.client?.toLowerCase().includes(search)
        )
    })


    const handleViewProject = (project: any) => {
        navigate(`/projects/${project.id}/meetings`)
    }

    const handleEditProject = (project: any) => {
        setProjectToEdit(project)
        setIsEditOpen(true)
    }

    const handleScheduleMeeting = (project: any) => {
        setProjectToSchedule(project)
        setIsScheduleOpen(true)
    }

    const formatDate = (dateString: string) => {
        if (!dateString) return "-";
        try {
            const date = new Date(dateString);
            return new Intl.DateTimeFormat('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            }).format(date);
        } catch (e) {
            return dateString;
        }
    }

    return (
        <div className="flex-1 flex flex-col p-8 pt-6 min-h-[calc(100vh-4.5rem)]">

            <AddProjectSheet
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                projectToEdit={projectToEdit}
                trigger={null}
            />

            {projectToSchedule && (
                <ScheduleMeetingSheet
                    open={isScheduleOpen}
                    onOpenChange={setIsScheduleOpen}
                    project={projectToSchedule}
                />
            )}

            <div className="flex items-center justify-between mb-2">
                <div className="space-y-1">
                    <h2 className="text-3xl font-bold tracking-tight">Meetings</h2>
                    <p className="text-muted-foreground">
                        Track past and upcoming client meetings for all projects.
                    </p>
                </div>
            </div>

            {(loading || projects.length > 0) && (
                <div className="flex items-center justify-between gap-4 my-6">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search projects or clients..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            )}

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground animate-pulse font-medium">Loading project meetings...</p>
                </div>
            ) : projects.length === 0 ? (
                <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-200px)]">
                    <Empty className="max-w-md">
                        <EmptyMedia className="h-20 w-20 bg-primary/5 rounded-full mb-4 text-primary/40">
                            <Video className="h-10 w-10" />
                        </EmptyMedia>
                        <EmptyHeader>
                            <EmptyTitle className="text-2xl">No meetings tracked</EmptyTitle>
                            <EmptyDescription className="text-base">
                                You haven't added any meeting information to your projects.
                                Edit a project to set meeting dates.
                            </EmptyDescription>
                        </EmptyHeader>
                    </Empty>
                </div>
            ) : (
                <div className="">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-gray-50 hover:bg-gray-50">
                                <TableHead className="py-3">Project Name</TableHead>
                                <TableHead className="py-3">Client</TableHead>
                                <TableHead className="py-3">Status</TableHead>
                                <TableHead className="py-3">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-muted-foreground" />
                                        Last Meeting
                                    </div>
                                </TableHead>
                                <TableHead className="py-3">
                                    <div className="flex items-center gap-2 text-primary font-semibold">
                                        <CalendarDays className="h-4 w-4" />
                                        Upcoming Meeting
                                    </div>
                                </TableHead>
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
                                            <div className="flex flex-col">
                                                <span className="font-semibold group-hover:text-primary transition-colors">{project.name}</span>
                                                <span className="text-[10px] text-muted-foreground mt-0.5">{project.client || "No client"}</span>
                                            </div>
                                        </div>
                                    </TableCell>

                                    <TableCell className="py-3">{project.client || "-"}</TableCell>

                                    <TableCell className="py-3">
                                        <Badge variant="outline" className="font-medium">{project.status}</Badge>
                                    </TableCell>

                                    <TableCell className="py-3">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">
                                                {project.lastMeeting ? formatDate(project.lastMeeting) : "-"}
                                            </span>
                                        </div>
                                    </TableCell>

                                    <TableCell className="py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex flex-col">
                                                {project.upcomingMeeting ? (
                                                    <Badge variant="secondary" className="w-fit bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 font-semibold px-2 py-0.5">
                                                        {formatDate(project.upcomingMeeting)}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground italic">TBD</span>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 rounded-full bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleScheduleMeeting(project);
                                                }}
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>

                                    <TableCell className="text-right py-3" onClick={(e) => e.stopPropagation()}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted rounded-full">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48 p-1">
                                                <DropdownMenuItem
                                                    className="flex items-center gap-2.5 cursor-pointer py-2"
                                                    onClick={() => handleScheduleMeeting(project)}
                                                >
                                                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium">Schedule Meet</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="flex items-center gap-2.5 cursor-pointer py-2"
                                                    onClick={() => handleEditProject(project)}
                                                >
                                                    <Edit className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium">Update Meeting Dates</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    className="flex items-center gap-2.5 cursor-pointer py-2"
                                                    onClick={() => handleViewProject(project)}
                                                >
                                                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                                    <span className="font-medium text-sm">Project Details</span>
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    )
}

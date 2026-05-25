import {
    Sheet,
    SheetContent,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
    Mail,
    MapPin,
    Briefcase,
    Users,
    Clock,
    Calendar,
    Cake
} from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface EmployeeDetailsSheetProps {
    employee: any
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function EmployeeDetailsSheet({ employee, open, onOpenChange }: EmployeeDetailsSheetProps) {
    if (!employee) return null

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-[600px] overflow-y-auto flex flex-col p-0 gap-0">
                {/* Header */}
                <div className="h-32 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent relative border-b">
                    <div className="absolute -bottom-10 left-8">
                        <Avatar className="h-20 w-20 border-4 border-background rounded-2xl shadow-xl bg-background">
                            <AvatarImage src={employee.avatar} className="object-cover" />
                            <AvatarFallback className="text-2xl rounded-2xl bg-primary/10 text-primary font-bold">
                                {employee.name ? employee.name[0] : "E"}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                </div>

                <div className="px-8 pt-14 pb-6 space-y-6">
                    <div className="flex items-start justify-between">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold tracking-tight">{employee.name}</h2>
                            <p className="text-muted-foreground flex items-center gap-2">
                                <Briefcase className="h-4 w-4" />
                                {employee.role}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <Badge variant={employee.status === "Active" ? "default" : "secondary"} className="rounded-full px-3 py-1">
                                {employee.status}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {employee.department}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 py-4 border-y border-border/50">
                        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card/50">
                            <div className="p-2 rounded-full bg-primary/10 text-primary">
                                <Mail className="h-4 w-4" />
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Email</p>
                                <p className="text-sm font-medium truncate" title={employee.email}>{employee.email}</p>
                            </div>
                        </div>

                        {employee.bdEmail && (
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-sky-50/50 border-sky-200 col-span-2">
                                <div className="p-2 rounded-full bg-sky-100 text-sky-600">
                                    <Mail className="h-4 w-4" />
                                </div>
                                <div className="overflow-hidden">
                                    <p className="text-[10px] uppercase font-bold text-sky-700">BD Sender Email</p>
                                    <p className="text-sm font-medium truncate text-sky-900" title={employee.bdEmail}>{employee.bdEmail}</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card/50 col-span-2">
                            <div className="p-2 rounded-full bg-primary/10 text-primary">
                                <MapPin className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">Location</p>
                                <p className="text-sm font-medium">{employee.location}</p>
                            </div>
                        </div>

                        {employee.joiningDate && (
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card/50">
                                <div className="p-2 rounded-full bg-emerald-100 text-emerald-600">
                                    <Calendar className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Joining Date</p>
                                    <p className="text-sm font-medium">{employee.joiningDate}</p>
                                </div>
                            </div>
                        )}

                        {employee.dateOfBirth && (
                            <div className="flex items-center gap-3 p-3 rounded-lg border bg-card/50">
                                <div className="p-2 rounded-full bg-pink-100 text-pink-600">
                                    <Cake className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Date of Birth</p>
                                    <p className="text-sm font-medium">{employee.dateOfBirth}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <Tabs defaultValue="projects" className="w-full">
                        <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
                            <TabsTrigger value="projects" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 py-3 text-sm font-medium">Assigned Projects</TabsTrigger>
                            <TabsTrigger value="activity" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-0 py-3 text-sm font-medium">Activity</TabsTrigger>
                        </TabsList>

                        <TabsContent value="projects" className="space-y-4 pt-6 animate-in fade-in duration-500">
                            {employee.projects && employee.projects.length > 0 ? (
                                <div className="grid gap-3">
                                    {employee.projects.map((project: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between p-4 rounded-xl border bg-card/50 hover:bg-muted/30 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-10 w-10 border border-primary/10 rounded-lg">
                                                    <AvatarImage src={project.logo} className="object-cover" />
                                                    <AvatarFallback className="rounded-lg">{project.name[0]}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-sm font-semibold">{project.name}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="outline" className="text-[10px] h-5 py-0">
                                                            {project.status}
                                                        </Badge>
                                                        <span className="text-[10px] text-muted-foreground">
                                                            Due {project.dueDate}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
                                    <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-20" />
                                    <p className="text-sm">No active projects assigned.</p>
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="activity" className="pt-6 animate-in fade-in duration-500">
                            <div className="flex items-center justify-between p-4 rounded-xl border bg-card/50">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-full bg-primary/10 text-primary">
                                        <Clock className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">Last Active</p>
                                        <p className="text-xs text-muted-foreground">{employee.lastActive}</p>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </SheetContent>
        </Sheet>
    )
}

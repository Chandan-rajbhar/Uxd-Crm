import { useState, useMemo } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AddClientSheet } from "src/components/AddClientSheet"
import { ClientDetailsSheet } from "src/components/ClientDetailsSheet"
import { useClients } from "src/hooks/useClients"
import {
    ListFilter,
    Building2,
    Loader2,
    Users,
    MoreHorizontal,
    Eye,
    Pencil,
    Trash,
    UserPlus,
    Monitor
} from "lucide-react"
import { httpsCallable } from "firebase/functions"
import { functions } from "src/firebase/config"
import { toast } from "sonner"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "src/components/ui/empty"
import { useAppSelector } from "src/store/hooks"
import { clientService } from "src/firebase/clientService"
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export default function ClientsPage() {
    const { clients, loading } = useClients()
    const projects = useAppSelector(state => state.projects.items)
    const [filterStatus, setFilterStatus] = useState("all")
    const [filterIndustry, setFilterIndustry] = useState("all")
    const [searchTerm, setSearchTerm] = useState("")
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [revokingId, setRevokingId] = useState<string | null>(null)
    const [displayLimit, setDisplayLimit] = useState(20)

    // View/Edit State
    const [selectedClient, setSelectedClient] = useState<any>(null)
    const [isViewOpen, setIsViewOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)

    // Compute Derived Data using a HashMap for O(N + M) time complexity
    const clientsWithProjects = useMemo(() => {
        // Group projects by client to avoid O(N*M) filter loops
        const projectsByClientId = new Map<string, any[]>();
        const projectsByClientName = new Map<string, any[]>();

        projects.forEach(p => {
            if (p.clientId) {
                const existing = projectsByClientId.get(p.clientId) || [];
                existing.push(p);
                projectsByClientId.set(p.clientId, existing);
            }
            if (p.client) {
                const existing = projectsByClientName.get(p.client) || [];
                existing.push(p);
                projectsByClientName.set(p.client, existing);
            }
        });

        return clients.map(client => {
            // Merge projects mapped by ID and Name (filtering out duplicates just in case)
            const byId = client.id ? projectsByClientId.get(client.id) || [] : [];
            const byName = client.name ? projectsByClientName.get(client.name) || [] : [];
            
            const clientProjects = Array.from(new Set([...byId, ...byName]));
            return { ...client, projects: clientProjects };
        });
    }, [clients, projects]);

    const filteredClients = useMemo(() => {
        return clientsWithProjects.filter(client => {
            const matchesStatus = filterStatus === "all" || client.status === filterStatus
            const matchesIndustry = filterIndustry === "all" || client.industry === filterIndustry
            const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                client.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
                client.email.toLowerCase().includes(searchTerm.toLowerCase())

            return matchesStatus && matchesIndustry && matchesSearch
        })
    }, [clientsWithProjects, filterStatus, filterIndustry, searchTerm])

    const industries = Array.from(new Set(clients.map(c => c.industry))).filter(Boolean)

    const handleDelete = async () => {
        if (deleteId) {
            await clientService.deleteClient(deleteId)
            setDeleteId(null)
        }
    }

    const handleForceLogout = async (client: any) => {
        const uid = client.authUid || client.uid;
        if (!uid) {
            toast.error("User does not have a linked authentication account.");
            return;
        }

        if (!window.confirm(`Are you sure you want to force logout ${client.name} from all devices?`)) {
            return;
        }

        setRevokingId(client.id);
        try {
            const logoutFn = httpsCallable(functions, 'logoutAllDevices');
            await logoutFn({ targetUid: uid });
            toast.success(`All sessions for ${client.name} have been revoked.`);
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to revoke sessions.");
        } finally {
            setRevokingId(null);
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Clients</h2>
                {clients.length > 0 && <AddClientSheet />}
            </div>

            {clients.length > 0 ? (
                <>
                    <div className="flex items-center justify-between gap-4 mb-6">
                        <div className="flex items-center space-x-2 flex-1">
                            <Input
                                placeholder="Search clients..."
                                className="h-8 w-[150px] lg:w-[250px]"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="h-8 w-[150px]">
                                    <ListFilter className="mr-2 h-4 w-4" />
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Status</SelectItem>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={filterIndustry} onValueChange={setFilterIndustry}>
                                <SelectTrigger className="h-8 w-[150px]">
                                    <Building2 className="mr-2 h-4 w-4" />
                                    <SelectValue placeholder="Industry" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Industries</SelectItem>
                                    {industries.map(industry => (
                                        <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="">
                        <Table>
                            <TableHeader className="bg-gray-50">
                                <TableRow>
                                    <TableHead className="py-3">Name</TableHead>
                                    <TableHead className="py-3">Company</TableHead>
                                    <TableHead className="py-3">Email</TableHead>
                                    <TableHead className="py-3">Phone</TableHead>
                                    <TableHead className="py-3">Industry</TableHead>
                                    <TableHead className="py-3">Location</TableHead>
                                    <TableHead className="py-3">Status</TableHead>
                                    <TableHead className="py-3">Projects</TableHead>
                                    <TableHead className="text-right py-3">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredClients.length > 0 ? (
                                    filteredClients.slice(0, displayLimit).map((client) => (
                                        <TableRow
                                            key={client.id || client.email}
                                            className="hover:bg-muted/50 transition-colors cursor-pointer"
                                            onClick={() => {
                                                setSelectedClient(client)
                                                setIsViewOpen(true)
                                            }}
                                        >
                                            <TableCell className="font-medium py-3">{client.name}</TableCell>
                                            <TableCell className="py-3">{client.company}</TableCell>
                                            <TableCell className="py-3 text-muted-foreground">{client.email}</TableCell>
                                            <TableCell className="py-3 text-muted-foreground">{client.phone || "-"}</TableCell>
                                            <TableCell className="py-3">
                                                {client.industry ? (
                                                    <Badge variant="outline" className="font-normal">
                                                        {client.industry}
                                                    </Badge>
                                                ) : "-"}
                                            </TableCell>
                                            <TableCell className="py-3 text-muted-foreground">{client.location || "-"}</TableCell>
                                            <TableCell className="py-3">
                                                <Badge variant={client.status === "Active" ? "default" : "secondary"}>
                                                    {client.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="py-3">
                                                <div className="flex -space-x-2">
                                                    <TooltipProvider delayDuration={0}>
                                                        {client.projects.slice(0, 4).map((project, i) => (
                                                            <Tooltip key={project.id || i}>
                                                                <TooltipTrigger asChild>
                                                                    <Avatar className="h-8 w-8 border-2 border-background ring-2 ring-transparent transition-all hover:ring-primary/20 hover:z-10 cursor-pointer">
                                                                        <AvatarImage src={project.logo} />
                                                                        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                                                                            {project.name[0]}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>{project.name}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        ))}
                                                    </TooltipProvider>
                                                    {client.projects.length > 4 && (
                                                        <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                                            +{client.projects.length - 4}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right py-3" onClick={(e) => e.stopPropagation()}>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <span className="sr-only">Open menu</span>
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem
                                                            onClick={() => navigator.clipboard.writeText(client.id || "")}
                                                        >
                                                            Copy Client ID
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem onClick={() => {
                                                            setSelectedClient(client)
                                                            setIsViewOpen(true)
                                                        }}>
                                                            <Eye className="mr-2 h-4 w-4" />
                                                            View Details
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => {
                                                            setSelectedClient(client)
                                                            setIsEditOpen(true)
                                                        }}>
                                                            <Pencil className="mr-2 h-4 w-4" />
                                                            Edit Client
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => client.id && setDeleteId(client.id)}
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <Trash className="mr-2 h-4 w-4" />
                                                            Delete Client
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => handleForceLogout(client)}
                                                            disabled={revokingId === client.id}
                                                        >
                                                            {revokingId === client.id ? (
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Monitor className="mr-2 h-4 w-4 flex-shrink-0" />
                                                            )}
                                                            <span className="ml-2">Force Logout (All)</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={9} className="py-20 text-center text-muted-foreground">
                                            No clients found matching your filters.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                        
                        {filteredClients.length > displayLimit && (
                            <div className="flex justify-center mt-6 mb-4">
                                <Button 
                                    variant="outline" 
                                    onClick={() => setDisplayLimit(prev => prev + 20)}
                                    className="min-w-[200px]"
                                >
                                    Load More Clients
                                </Button>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-200px)]">
                    <Empty className="max-w-md">
                        <EmptyMedia className="h-20 w-20 bg-primary/10 rounded-full mb-4">
                            <Users className="h-10 w-10 text-primary/40" />
                        </EmptyMedia>
                        <EmptyHeader>
                            <EmptyTitle className="text-2xl">No clients found</EmptyTitle>
                            <EmptyDescription className="text-base">
                                Start by adding your first client to manage their projects and track communication.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <AddClientSheet trigger={
                                <Button className="gap-2">
                                    <UserPlus className="h-4 w-4" />
                                    Add Client
                                </Button>
                            } />
                        </EmptyContent>
                    </Empty>
                </div>
            )
            }

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the client
                            and remove their data from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <ClientDetailsSheet
                client={clientsWithProjects.find(c => c.id === selectedClient?.id) || selectedClient}
                open={isViewOpen}
                onOpenChange={setIsViewOpen}
            />

            <AddClientSheet
                clientToEdit={selectedClient}
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                trigger={null}
            />
        </div >
    )
}

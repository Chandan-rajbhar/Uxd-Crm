import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Plus, Save, Loader2, Check, ChevronsUpDown } from "lucide-react"
import { projectService } from "src/firebase/projectService"
import { toast } from "sonner"
import type { Project } from "src/store/slices/projectsSlice"
import { useClients } from "src/hooks/useClients"
import { cn } from "src/lib/utils"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "src/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "src/components/ui/popover"

import { storage } from "src/firebase/config"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { Upload, X } from "lucide-react"

interface AddProjectSheetProps {
    projectToEdit?: Project | null
    open?: boolean
    onOpenChange?: (open: boolean) => void
    trigger?: React.ReactNode
}

export function AddProjectSheet({ projectToEdit, open: controlledOpen, onOpenChange: setControlledOpen, trigger }: AddProjectSheetProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const open = controlledOpen !== undefined ? controlledOpen : internalOpen
    const setOpen = setControlledOpen || setInternalOpen
    const [clientSearchOpen, setClientSearchOpen] = useState(false)
    const { clients } = useClients()
    const [logoFile, setLogoFile] = useState<File | null>(null)
    const [logoPreview, setLogoPreview] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState<Partial<Project>>({
        name: "",
        client: "",
        category: "Development",
        status: "In Progress",
        priority: "Medium",
        budget: "",
        logo: "",
        startDate: "",
        endDate: "",
        progress: 0,
        team: [],
        credentials: {},
        links: {},
    })

    useEffect(() => {
        if (open) {
            if (projectToEdit) {
                setFormData(projectToEdit)
                if (projectToEdit.logo) {
                    setLogoPreview(projectToEdit.logo)
                }
            } else {
                setFormData({
                    name: "",
                    client: "",
                    category: "Development",
                    status: "In Progress",
                    priority: "Medium",
                    budget: "",
                    logo: "",
                    startDate: "",
                    endDate: "",
                    progress: 0,
                    team: [],
                    credentials: {},
                    links: {},
                })
                setLogoPreview(null)
                setLogoFile(null)
            }
        }
    }, [open, projectToEdit])

    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            if (!open) return
            const items = event.clipboardData?.items
            if (!items) return
            for (let i = 0; i < items.length; i++) {
                const item = items[i]
                if (item.type.indexOf("image") !== -1) {
                    const file = item.getAsFile()
                    if (file) {
                        setLogoFile(file)
                        setLogoPreview(URL.createObjectURL(file))
                        toast.success("Logo pasted from clipboard!")
                        event.preventDefault()
                        break
                    }
                }
            }
        }

        window.addEventListener("paste", handlePaste)
        return () => {
            window.removeEventListener("paste", handlePaste)
        }
    }, [open])

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0]
            setLogoFile(file)
            setLogoPreview(URL.createObjectURL(file))
        }
    }

    const removeLogo = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setLogoFile(null)
        setLogoPreview(null)
        setFormData(prev => ({ ...prev, logo: "" }))
        if (fileInputRef.current) {
            fileInputRef.current.value = ""
        }
    }

    const handleChange = (field: keyof Project, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleSubmit = async () => {
        if (!formData.name || !formData.client) {
            toast.error("Name and Client are required")
            return
        }

        setLoading(true)
        try {
            let finalLogoUrl = formData.logo || "";

            // Upload logo if a new one is selected
            if (logoFile) {
                const storageRef = ref(storage, `project-logos/${Date.now()}_${logoFile.name}`);
                await uploadBytes(storageRef, logoFile);
                finalLogoUrl = await getDownloadURL(storageRef);
            }

            const projectData = {
                ...formData,
                logo: finalLogoUrl
            };

            if (projectToEdit?.id) {
                await projectService.updateProject(projectToEdit.id, projectData)
                toast.success("Project updated successfully")
            } else {
                await projectService.addProject(projectData as any)
                toast.success("Project added successfully")
            }
            setOpen(false)
        } catch (error) {
            console.error("Error saving project:", error)
            toast.error("Failed to save project")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            {trigger !== null && (
                <SheetTrigger asChild>
                    {trigger ? trigger : (
                        <Button size="sm">
                            <Plus className="mr-2 h-4 w-4" /> Add Project
                        </Button>
                    )}
                </SheetTrigger>
            )}
            <SheetContent className="overflow-y-auto w-full sm:max-w-[540px] flex flex-col">
                <SheetHeader>
                    <SheetTitle>{projectToEdit ? "Edit Project" : "Add Project"}</SheetTitle>
                    <SheetDescription>
                        {projectToEdit ? "Update project details." : "Create a new project in the CRM."}
                    </SheetDescription>
                </SheetHeader>

                <div className="flex-1 py-4 grid gap-4">
                    <div className="grid gap-2">
                        <Label htmlFor="name">Project Name</Label>
                        <Input
                            id="name"
                            placeholder="e.g. Acme Website"
                            value={formData.name}
                            onChange={(e) => handleChange("name", e.target.value)}
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="client">Client</Label>
                        <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={clientSearchOpen}
                                    className="w-full justify-between font-normal"
                                >
                                    {formData.client
                                        ? clients.find((c) => c.name === formData.client)?.name || formData.client
                                        : "Select client..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0" align="start">
                                <Command className="w-full">
                                    <CommandInput placeholder="Search client..." />
                                    <CommandList className="max-h-[200px]">
                                        <CommandEmpty>No client found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem
                                                value="None"
                                                onSelect={() => {
                                                    setFormData(prev => ({ ...prev, client: "None", clientId: "", clientEmail: "" }))
                                                    setClientSearchOpen(false)
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        formData.client === "None" ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                None (Internal)
                                            </CommandItem>
                                            {clients.map((client) => (
                                                <CommandItem
                                                    key={client.id}
                                                    value={client.name}
                                                    onSelect={() => {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            client: client.name,
                                                            clientId: client.id,
                                                            clientEmail: client.email
                                                        }))
                                                        setClientSearchOpen(false)
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            formData.client === client.name ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {client.name} ({client.company})
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="category">Category</Label>
                            <Select
                                value={formData.category}
                                onValueChange={(val) => handleChange("category", val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Development">Development</SelectItem>
                                    <SelectItem value="Digital Marketing">Digital Marketing</SelectItem>
                                    <SelectItem value="Internal">Internal</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="status">Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(val) => handleChange("status", val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="In Progress">In Progress</SelectItem>
                                    <SelectItem value="Planning">Planning</SelectItem>
                                    <SelectItem value="Completed">Completed</SelectItem>
                                    <SelectItem value="Pending">Pending</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="priority">Priority</Label>
                            <Select
                                value={formData.priority}
                                onValueChange={(val) => handleChange("priority", val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Critical">Critical</SelectItem>
                                    <SelectItem value="High">High</SelectItem>
                                    <SelectItem value="Medium">Medium</SelectItem>
                                    <SelectItem value="Low">Low</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="budget">Budget</Label>
                            <Input
                                id="budget"
                                placeholder="$5,000"
                                value={formData.budget}
                                onChange={(e) => handleChange("budget", e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>Project Logo</Label>
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <Label
                                    htmlFor="logo-upload"
                                    className="cursor-pointer group relative block"
                                >
                                    <div className="h-20 w-20 rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center hover:bg-muted/50 hover:border-primary/50 transition-all duration-200 overflow-hidden bg-background">
                                        {logoPreview ? (
                                            <img
                                                src={logoPreview}
                                                alt="Logo Preview"
                                                className="w-full h-full object-contain p-2"
                                            />
                                        ) : (
                                            <Plus className="h-6 w-6 text-muted-foreground/40 group-hover:text-primary group-hover:scale-110 transition-all duration-200" />
                                        )}
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium">
                                            <Upload className="h-4 w-4 mr-1" /> Change
                                        </div>
                                    </div>
                                    <Input
                                        id="logo-upload"
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleLogoChange}
                                    />
                                </Label>

                                {logoPreview && (
                                    <button
                                        type="button"
                                        onClick={removeLogo}
                                        className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full shadow-md hover:bg-destructive/90 transition-colors z-20"
                                        title="Remove logo"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                <p className="font-medium text-foreground mb-1">Upload brand logo or paste image</p>
                                <p>PNG, JPG or SVG (or paste via Ctrl+V)</p>
                                <p>Max 2MB</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="startDate">Start Date</Label>
                            <Input
                                id="startDate"
                                type="date"
                                value={formData.startDate}
                                onChange={(e) => handleChange("startDate", e.target.value)}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="endDate">End Date</Label>
                            <Input
                                id="endDate"
                                type="date"
                                value={formData.endDate}
                                onChange={(e) => handleChange("endDate", e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <SheetFooter>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {projectToEdit ? "Update Project" : "Save Project"}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}

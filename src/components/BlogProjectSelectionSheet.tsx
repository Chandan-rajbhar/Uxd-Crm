import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@/components/ui/sheet"
import { Search, Loader2, Plus, Check } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useAppSelector } from "src/store/hooks"
import { blogService } from "src/firebase/blogService"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface BlogProjectSelectionSheetProps {
    existingBlogProjects: any[]
}

export function BlogProjectSelectionSheet({ existingBlogProjects = [] }: BlogProjectSelectionSheetProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")
    const allCrmProjects = useAppSelector((state) => state.projects?.items || [])
    
    // Track selected project names
    const [selectedProjects, setSelectedProjects] = useState<string[]>([])

    // Filter out projects that are already "Blog Projects"
    const availableProjects = (allCrmProjects || []).filter(p => 
        !(existingBlogProjects || []).some(ebp => ebp.name === p.name)
    ).filter(p => 
        p.name?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const toggleProject = (name: string) => {
        setSelectedProjects(prev => 
            prev.includes(name) 
                ? prev.filter(n => n !== name) 
                : [...prev, name]
        )
    }

    const handleSave = async () => {
        if (selectedProjects.length === 0) {
            toast.error("Please select at least one project")
            return
        }

        setLoading(true)
        try {
            const projectsToAdd = allCrmProjects.filter(p => selectedProjects.includes(p.name))
            
            const promises = projectsToAdd.map(p => 
                blogService.addBlogProject({
                    name: p.name,
                    avatar: p.logo || ""
                })
            )

            await Promise.all(promises)
            toast.success(`${selectedProjects.length} project(s) added to Blogs`)
            setOpen(false)
            setSelectedProjects([])
        } catch (error) {
            console.error("Error adding blog projects:", error)
            toast.error("Failed to add projects")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" /> Add Project
                </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-[540px] flex flex-col p-0">
                <SheetHeader className="p-6 border-b">
                    <SheetTitle>Add Projects to Blogs</SheetTitle>
                    <SheetDescription>
                        Select projects from your CRM to enable them for blog management.
                    </SheetDescription>
                </SheetHeader>

                <div className="p-6 border-b">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search CRM projects..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1">
                    <div className="p-2">
                        {availableProjects.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">
                                {searchTerm ? "No projects matching your search." : "All projects are already added."}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-1">
                                {availableProjects.map((project) => (
                                    <div 
                                        key={project.id || project.name}
                                        className={`flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all ${
                                            selectedProjects.includes(project.name) 
                                            ? 'bg-primary/5 border-primary/20 border shadow-sm' 
                                            : 'hover:bg-muted border border-transparent'
                                        }`}
                                        onClick={() => toggleProject(project.name)}
                                    >
                                        <div className="flex-shrink-0">
                                            <Avatar className="h-10 w-10 border shadow-sm">
                                                <AvatarImage src={project.logo} />
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold">
                                                    {project.name.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm truncate">{project.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">{project.client}</p>
                                        </div>
                                        <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center transition-all ${
                                            selectedProjects.includes(project.name)
                                            ? 'bg-primary border-primary text-white'
                                            : 'border-muted-foreground/30'
                                        }`}>
                                            {selectedProjects.includes(project.name) && <Check className="h-4 w-4" />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <SheetFooter className="p-6 border-t mt-auto">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={loading || selectedProjects.length === 0}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Add {selectedProjects.length > 0 ? `${selectedProjects.length} ` : ""}Project{selectedProjects.length !== 1 ? "s" : ""}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    )
}

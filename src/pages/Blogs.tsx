import { useState, useEffect, useMemo, memo } from "react"
import { useAppSelector } from "src/store/hooks"
import { blogService } from "src/firebase/blogService"
import { AddBlogSheet } from "@/components/AddBlogSheet"
import { BlogProjectSelectionSheet } from "@/components/BlogProjectSelectionSheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Badge } from "@/components/ui/badge"
import { Loader2, Search, MoreHorizontal, Edit, Trash2, Eye, ChevronRight, LayoutGrid, FileText, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import type { Blog } from "src/store/slices/blogsSlice"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

const BlogRow = memo(({ blog, onPreview, onEdit, onDelete }: { 
    blog: Blog, 
    onPreview: (blog: Blog) => void, 
    onEdit: (blog: Blog) => void, 
    onDelete: (blog: Blog) => void 
}) => {
    return (
        <TableRow className="hover:bg-muted/30 transition-colors">
            <TableCell className="font-medium">
                <div className="flex items-center gap-3 py-1">
                    {blog.coverImage && (
                        <div className="h-10 w-10 rounded-md overflow-hidden border shadow-sm">
                            <img src={blog.coverImage} alt={blog.title} className="h-full w-full object-cover" />
                        </div>
                    )}
                    <span className="font-bold">{blog.title}</span>
                </div>
            </TableCell>
            <TableCell>
                <Badge variant="outline" className="font-semibold text-[11px] uppercase tracking-wider">{blog.category}</Badge>
            </TableCell>
            <TableCell className="max-w-[400px]">
                <div className="line-clamp-2 text-sm text-muted-foreground break-words whitespace-normal leading-relaxed">
                    {blog.excerpt || "-"}
                </div>
            </TableCell>
            <TableCell>
                <Badge variant={blog.status === 'Published' ? 'default' : 'secondary'} className={blog.status === 'Published' ? 'bg-green-500 hover:bg-green-600' : ''}>
                    {blog.status}
                </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground whitespace-nowrap">
                {blog.createdAt?.seconds ? format(new Date(blog.createdAt.seconds * 1000), 'MMM d, yyyy') : '-'}
            </TableCell>
            <TableCell className="text-right">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onPreview(blog)} className="cursor-pointer">
                            <Eye className="mr-2 h-4 w-4" /> Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(blog)} className="cursor-pointer">
                            <Edit className="mr-2 h-4 w-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive cursor-pointer focus:bg-destructive/10 focus:text-destructive" onClick={() => onDelete(blog)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>
        </TableRow>
    )
})

BlogRow.displayName = "BlogRow"

export default function BlogsPage() {
    const blogs = useAppSelector((state) => state.blogs?.items || [])
    const registeredProjects = useAppSelector((state) => state.blogProjects?.items || [])
    const loading = useAppSelector((state) => state.blogs?.loading || state.blogProjects?.loading || false)
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedAuthor, setSelectedAuthor] = useState<string | null>(null)

    // Edit State
    const [isEditOpen, setIsEditOpen] = useState(false)
    const [blogToEdit, setBlogToEdit] = useState<Blog | undefined>(undefined)

    // Delete State
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [blogToDelete, setBlogToDelete] = useState<Blog | null>(null)
    const [isDeleting, setIsDeleting] = useState(false)

    // Preview State
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [blogToPreview, setBlogToPreview] = useState<Blog | null>(null)

    useEffect(() => {
        const unsubscribeBlogs = blogService.subscribeToBlogs()
        const unsubscribeProjects = blogService.subscribeToBlogProjects()
        return () => {
            unsubscribeBlogs()
            unsubscribeProjects()
        }
    }, [])

    // Calculate Author (Project) Stats based on registered projects + existing blog authors
    const projectStats = useMemo(() => {
        const blogAuthors = Array.from(new Set(blogs.map(b => b.author))).filter(Boolean)
        const registeredNames = new Set(registeredProjects.map(p => p.name))
        
        const combinedAuthors = [
            ...registeredProjects.map(p => ({
                id: p.id,
                name: p.name,
                avatar: p.avatar
            })),
            ...blogAuthors
                .filter(author => !registeredNames.has(author))
                .map(author => ({
                    id: `legacy-${author}`,
                    name: author,
                    avatar: "" // Or some default
                }))
        ]

        return combinedAuthors.map(authorInfo => {
            const projectBlogs = blogs.filter(b => b.author === authorInfo.name)
            let lastPosted: any = null
            projectBlogs.forEach(b => {
                if (b.createdAt?.seconds) {
                    if (!lastPosted || b.createdAt.seconds > lastPosted.seconds) {
                        lastPosted = b.createdAt
                    }
                }
            })
            return {
                id: authorInfo.id,
                name: authorInfo.name,
                avatar: authorInfo.avatar,
                total: projectBlogs.length,
                lastPosted: lastPosted
            }
        }).sort((a, b) => b.total - a.total)
    }, [blogs, registeredProjects])

    const filteredBlogs = useMemo(() => {
        let result = blogs
        if (selectedAuthor) {
            result = result.filter(b => b.author === selectedAuthor)
        }
        return result.filter(blog =>
            blog.title.toLowerCase().includes(searchTerm.toLowerCase())
        )
    }, [blogs, searchTerm, selectedAuthor])

    const handleEdit = (blog: Blog) => {
        setBlogToEdit(blog)
        setIsEditOpen(true)
    }

    const handleDeleteClick = (blog: Blog) => {
        setBlogToDelete(blog)
        setIsDeleteOpen(true)
    }

    const confirmDelete = async () => {
        if (blogToDelete?.id) {
            setIsDeleting(true)
            try {
                await blogService.deleteBlog(blogToDelete.id)
                toast.success("Blog deleted successfully")
            } catch (error) {
                console.error("Failed to delete blog:", error)
                toast.error("Failed to delete blog")
            } finally {
                setIsDeleting(false)
                setIsDeleteOpen(false)
                setBlogToDelete(null)
            }
        }
    }

    const handlePreview = (blog: Blog) => {
        setBlogToPreview(blog)
        setIsPreviewOpen(true)
    }

    return (
        <div className="flex-1 flex flex-col p-8 pt-6 min-h-[calc(100vh-4.5rem)]">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-3xl font-bold tracking-tight">Blogs</h2>
                        {selectedAuthor && (
                            <>
                                <ChevronRight className="h-6 w-6 text-muted-foreground/50" />
                                <h2 className="text-3xl font-bold tracking-tight text-primary uppercase">{selectedAuthor}</h2>
                            </>
                        )}
                    </div>
                    <p className="text-muted-foreground">
                        {selectedAuthor ? `Managing content library for ${selectedAuthor}` : "Activate projects from CRM to start creating content."}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {!selectedAuthor ? (
                        <BlogProjectSelectionSheet existingBlogProjects={registeredProjects} />
                    ) : (
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" onClick={() => setSelectedAuthor(null)} className="font-bold text-muted-foreground hover:text-primary">
                                <ArrowLeft className="mr-2 h-4 w-4" /> All Projects
                            </Button>
                            <AddBlogSheet
                                open={isEditOpen}
                                onOpenChange={(open) => {
                                    setIsEditOpen(open)
                                    if (!open) setBlogToEdit(undefined)
                                }}
                                blogToEdit={blogToEdit}
                                forcedAuthor={selectedAuthor}
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder={selectedAuthor ? `Search in ${selectedAuthor}...` : "Search projects..."}
                        className="pl-8 bg-white"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading && blogs.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : (
                <div className="flex-1">
                    {!selectedAuthor ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                            {projectStats.length === 0 ? (
                                <div className="col-span-full h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-muted-foreground bg-muted/5">
                                    <LayoutGrid className="h-10 w-10 mb-2 opacity-20" />
                                    <p className="font-medium">No projects found.</p>
                                    <p className="text-sm">Start by creating your first blog post.</p>
                                </div>
                            ) : (
                                projectStats
                                    .filter(stat => stat.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                    .map((stat) => (
                                        <div 
                                            key={stat.name} 
                                            className="group relative bg-white rounded-2xl border p-4 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 cursor-pointer flex flex-col items-center text-center gap-3"
                                            onClick={() => setSelectedAuthor(stat.name)}
                                        >
                                            <div className="relative">
                                                <Avatar className="h-20 w-20 border-4 border-white shadow-md group-hover:scale-105 transition-transform duration-500">
                                                    <AvatarImage src={stat.avatar} />
                                                    <AvatarFallback className="bg-primary/5 text-primary text-xl font-black">
                                                        {stat.name.substring(0, 2).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                            </div>

                                            <div className="space-y-0.5">
                                                <h3 className="text-lg font-bold tracking-tight group-hover:text-primary transition-colors line-clamp-1">{stat.name}</h3>
                                            </div>

                                            <div className="w-full pt-3 mt-auto border-t flex flex-col gap-1 items-center">
                                                <div className="flex items-center justify-between w-full">
                                                    <span className="text-muted-foreground text-[9px] uppercase font-bold tracking-tighter">Blogs</span>
                                                    <span className="font-black text-primary text-xs">{stat.total}</span>
                                                </div>
                                                <div className="flex items-center justify-between w-full">
                                                    <span className="text-muted-foreground text-[9px] uppercase font-bold tracking-tighter">Last Posted</span>
                                                    <span className="font-semibold text-slate-700 text-[10px]">
                                                        {stat.lastPosted?.seconds ? format(new Date(stat.lastPosted.seconds * 1000), 'MMM d') : 'Never'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                                                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <ChevronRight className="h-3 w-3 text-primary" />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                            )}
                        </div>
                    ) : (
                        <div className="flex-1">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead className="max-w-[400px]">Excerpt Summary</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Date Created</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredBlogs.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                                <div className="flex flex-col items-center gap-2">
                                                    <FileText className="h-8 w-8 opacity-20" />
                                                    <span>No blogs found for this project.</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredBlogs.map((blog) => (
                                            <BlogRow
                                                key={blog.id}
                                                blog={blog}
                                                onPreview={handlePreview}
                                                onEdit={handleEdit}
                                                onDelete={handleDeleteClick}
                                            />
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the blog post "<strong>{blogToDelete?.title}</strong>".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault()
                                confirmDelete()
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Preview Sheet */}
            <Sheet open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
                <SheetContent className="w-full sm:max-w-[800px] p-0 flex flex-col">
                    {isPreviewOpen && (
                        <>
                            <SheetHeader className="p-6 border-b">
                                <SheetTitle>Blog Preview</SheetTitle>
                                <SheetDescription>Preview how your blog post will look.</SheetDescription>
                            </SheetHeader>
                            <ScrollArea className="flex-1">
                                {blogToPreview && (
                                    <div className="p-8 max-w-3xl mx-auto">
                                        {blogToPreview.coverImage && (
                                            <img
                                                src={blogToPreview.coverImage}
                                                alt={blogToPreview.title}
                                                className="w-full h-[300px] object-cover rounded-xl mb-8 shadow-sm"
                                            />
                                        )}
                                        <h1 className="text-4xl font-bold mb-4">{blogToPreview.title}</h1>

                                        <div className="flex items-center gap-4 text-muted-foreground mb-8 text-sm">
                                            <span>By {blogToPreview.author}</span>
                                            <span>•</span>
                                            <span>{blogToPreview.createdAt?.seconds ? format(new Date(blogToPreview.createdAt.seconds * 1000), 'MMMM d, yyyy') : 'Just now'}</span>
                                            <span>•</span>
                                            <Badge variant="outline">{blogToPreview.status}</Badge>
                                        </div>

                                        {blogToPreview.excerpt && (
                                            <p className="text-xl text-muted-foreground italic border-l-4 pl-4 mb-8">
                                                {blogToPreview.excerpt}
                                            </p>
                                        )}

                                        <div className="prose prose-gray max-w-none dark:prose-invert">
                                            <div 
                                                className="blog-content-preview"
                                                dangerouslySetInnerHTML={{ __html: blogToPreview.content }} 
                                            />
                                        </div>

                                        {blogToPreview.images && blogToPreview.images.length > 0 && (
                                            <div className="mt-12 pt-8 border-t">
                                                <h3 className="text-2xl font-bold mb-6">Gallery</h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    {blogToPreview.images.map((img, i) => (
                                                        <img
                                                            key={i}
                                                            src={img}
                                                            alt={`Gallery ${i}`}
                                                            className="rounded-lg w-full h-auto object-cover hover:opacity-90 transition-opacity"
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </ScrollArea>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}

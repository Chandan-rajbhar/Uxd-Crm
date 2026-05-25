import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import ReactQuill from 'react-quill'
import 'react-quill/dist/quill.snow.css'
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
import { Plus, Upload, Loader2, X, Image as ImageIcon } from "lucide-react"
import { blogService } from "src/firebase/blogService"
import type { Blog } from "src/store/slices/blogsSlice"
import { ScrollArea } from "@/components/ui/scroll-area"

interface AddBlogSheetProps {
    blogToEdit?: Blog
    open?: boolean
    onOpenChange?: (open: boolean) => void
    trigger?: React.ReactNode
    forcedAuthor?: string
}

export function AddBlogSheet({ blogToEdit, open, onOpenChange, trigger, forcedAuthor }: AddBlogSheetProps) {
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState<Partial<Blog>>({
        title: "",
        content: "",
        excerpt: "",
        coverImage: "",
        images: [],
        author: forcedAuthor || "",
        authorRole: "",
        category: "",
        readTime: "",
        tags: [],
        status: "Draft"
    })

    const [internalOpen, setInternalOpen] = useState(false)
    const isControlled = open !== undefined
    const showSheet = isControlled ? open : internalOpen

    const handleOpenChange = (newOpen: boolean) => {
        if (isControlled && onOpenChange) {
            onOpenChange(newOpen)
        } else {
            setInternalOpen(newOpen)
        }
    }

    useEffect(() => {
        if (blogToEdit) {
            setFormData({ ...blogToEdit })
        } else if (!showSheet) {
            setFormData({
                title: "",
                content: "",
                excerpt: "",
                coverImage: "",
                images: [],
                author: forcedAuthor || "",
                authorRole: "",
                category: "",
                readTime: "",
                tags: [],
                status: "Draft"
            })
        }
    }, [blogToEdit, showSheet, forcedAuthor])

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const [coverLoading, setCoverLoading] = useState(false)
    const [galleryLoading, setGalleryLoading] = useState(false)

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isCover: boolean) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        if (isCover) setCoverLoading(true)
        else setGalleryLoading(true)

        try {
            if (isCover) {
                const file = files[0]
                const url = await blogService.uploadBlogImage(file)
                handleChange('coverImage', url)
            } else {
                const uploadPromises = Array.from(files).map(file => blogService.uploadBlogImage(file))
                const urls = await Promise.all(uploadPromises)
                const currentImages = formData.images || []
                handleChange('images', [...currentImages, ...urls])
            }
        } catch (error) {
            toast.error("Failed to upload image")
            console.error(error)
        } finally {
            if (isCover) setCoverLoading(false)
            else setGalleryLoading(false)
        }
    }

    const removeImage = (index: number) => {
        const newImages = [...(formData.images || [])]
        newImages.splice(index, 1)
        handleChange('images', newImages)
    }

    const removeCoverImage = () => {
        handleChange('coverImage', "")
    }

    const handleSubmit = async () => {
        if (!formData.title || !formData.content) {
            toast.error("Title and Content are required")
            return
        }

        setLoading(true)
        try {
            const blogData = { ...formData } as Omit<Blog, 'id'>

            if (blogToEdit?.id) {
                await blogService.updateBlog(blogToEdit.id, blogData)
                toast.success("Blog updated successfully")
            } else {
                await blogService.addBlog(blogData)
                toast.success("Blog created successfully")
            }
            handleOpenChange(false)
        } catch (error) {
            console.error("Error saving blog:", error)
            toast.error("Failed to save blog")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Sheet open={showSheet} onOpenChange={handleOpenChange}>
            {trigger !== undefined ? (
                trigger && <SheetTrigger asChild>{trigger}</SheetTrigger>
            ) : !blogToEdit && (
                <SheetTrigger asChild>
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Add Blog
                    </Button>
                </SheetTrigger>
            )}
            <SheetContent className="w-full sm:max-w-[800px] flex flex-col p-0 gap-0">
                {showSheet && (
                    <>
                        <SheetHeader className="p-6 border-b">
                            <SheetTitle>{blogToEdit ? "Edit Blog" : "Create New Blog"}</SheetTitle>
                            <SheetDescription>
                                {blogToEdit ? "Update your blog post details below." : "Fill in the details to create a new blog post."}
                            </SheetDescription>
                        </SheetHeader>

                        <ScrollArea className="flex-1 p-6">
                            <div className="space-y-6">
                                {/* Cover Image */}
                                <div className="space-y-2">
                                    <Label>Cover Image</Label>
                                    <div className="relative border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center min-h-[200px] bg-muted/10 hover:bg-muted/20 transition-colors">
                                        {coverLoading ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <span className="text-sm text-muted-foreground">Uploading...</span>
                                            </div>
                                        ) : formData.coverImage ? (
                                            <div className="relative w-full h-[300px] rounded-md overflow-hidden group">
                                                <img src={formData.coverImage} alt="Cover" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Button variant="destructive" size="sm" onClick={removeCoverImage}>
                                                        <X className="h-4 w-4 mr-2" /> Remove
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <Label htmlFor="cover-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <Upload className="h-6 w-6 text-primary" />
                                                </div>
                                                <span className="text-sm font-medium text-muted-foreground">Click to upload cover image</span>
                                            </Label>
                                        )}
                                        <Input
                                            id="cover-upload"
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            onChange={(e) => handleImageUpload(e, true)}
                                            disabled={loading || coverLoading}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="title">Title</Label>
                                        <Input
                                            id="title"
                                            placeholder="Blog Title"
                                            value={formData.title}
                                            onChange={(e) => handleChange('title', e.target.value)}
                                        />
                                    </div>
                                </div>

                                {!forcedAuthor && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="author">Author Name</Label>
                                            <Input
                                                id="author"
                                                placeholder="e.g. Sarah Chen"
                                                value={formData.author}
                                                onChange={(e) => handleChange('author', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="authorRole">Author Role</Label>
                                            <Input
                                                id="authorRole"
                                                placeholder="e.g. Design Capital"
                                                value={formData.authorRole || ""}
                                                onChange={(e) => handleChange('authorRole', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="category">Category</Label>
                                        <Select
                                            value={formData.category}
                                            onValueChange={(v) => handleChange('category', v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Design Philosophy">Design Philosophy</SelectItem>
                                                <SelectItem value="Frontend Development">Frontend Development</SelectItem>
                                                <SelectItem value="Backend Development">Backend Development</SelectItem>
                                                <SelectItem value="UI/UX Design">UI/UX Design</SelectItem>
                                                <SelectItem value="Technology">Technology</SelectItem>
                                                <SelectItem value="Innovation">Innovation</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="readTime">Read Time</Label>
                                        <Input
                                            id="readTime"
                                            placeholder="e.g. 5 min read"
                                            value={formData.readTime || ""}
                                            onChange={(e) => handleChange('readTime', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="status">Status</Label>
                                        <Select
                                            value={formData.status}
                                            onValueChange={(v) => handleChange('status', v)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Draft">Draft</SelectItem>
                                                <SelectItem value="Published">Published</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="tags">Tags (comma separated)</Label>
                                        <Input
                                            id="tags"
                                            placeholder="e.g. React, UI, Design"
                                            value={formData.tags?.join(", ") || ""}
                                            onChange={(e) => handleChange('tags', e.target.value.split(",").map(s => s.trim()))}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="excerpt">Excerpt</Label>
                                    <Textarea
                                        id="excerpt"
                                        placeholder="Short summary of the blog post..."
                                        className="h-20"
                                        value={formData.excerpt}
                                        onChange={(e) => handleChange('excerpt', e.target.value)}
                                    />
                                </div>

                                <div className="space-y-4">
                                    <Label htmlFor="content">Content</Label>
                                    <div className="quill-editor-container h-[400px]">
                                        <ReactQuill
                                            theme="snow"
                                            value={formData.content}
                                            onChange={(content) => handleChange('content', content)}
                                            className="h-[350px] mb-12"
                                            modules={{
                                                toolbar: [
                                                    [{ 'header': [1, 2, 3, false] }],
                                                    ['bold', 'italic', 'underline', 'strike'],
                                                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                                    [{ 'color': [] }, { 'background': [] }],
                                                    ['link', 'image', 'video'],
                                                    ['clean']
                                                ],
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Gallery Images */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label>Gallery Images</Label>
                                        <Label htmlFor="gallery-upload" className={`cursor-pointer text-sm font-medium flex items-center gap-1 ${galleryLoading ? 'text-muted-foreground' : 'text-primary hover:underline'}`}>
                                            {galleryLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                                            {galleryLoading ? 'Uploading...' : 'Add Images'}
                                        </Label>
                                        <Input
                                            id="gallery-upload"
                                            type="file"
                                            className="hidden"
                                            accept="image/*"
                                            multiple
                                            onChange={(e) => handleImageUpload(e, false)}
                                            disabled={loading || galleryLoading}
                                        />
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 mt-2">
                                        {formData.images?.map((img, index) => (
                                            <div key={index} className="relative aspect-video rounded-md overflow-hidden group border">
                                                <img src={img} alt={`Gallery ${index}`} className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => removeImage(index)}
                                                    className="absolute top-1 right-1 p-1 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </div>
                                        ))}
                                        {(!formData.images || formData.images.length === 0) && (
                                            <div className="col-span-3 py-8 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                                                <ImageIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                <p className="text-sm">No gallery images added</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>

                        <SheetFooter className="p-6 border-t">
                            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
                                Cancel
                            </Button>
                            <Button onClick={handleSubmit} disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {blogToEdit ? "Update Blog" : "Create Blog"}
                            </Button>
                        </SheetFooter>
                    </>
                )}
            </SheetContent>
        </Sheet>
    )
}

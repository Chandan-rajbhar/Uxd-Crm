import { useState, useRef, useEffect } from "react"
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import ReactQuill from "react-quill"
import "react-quill/dist/quill.snow.css"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    Copy,
    Check,
    Trash2,
    Image as ImageIcon,
    ExternalLink,
    Plus,
    Loader2,
    Pencil,
    X
} from "lucide-react"
import { toast } from "sonner"
import { appLinkService } from "src/firebase/appLinkService"
import type { AppLink } from "src/firebase/appLinkService"
import { format } from "date-fns"

export default function AppLinksPage() {
    const [links, setLinks] = useState<AppLink[]>([])
    const [heading, setHeading] = useState("")
    const [content, setContent] = useState("")
    const [imageUrl, setImageUrl] = useState("")
    const [localPreview, setLocalPreview] = useState<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        const unsubscribe = appLinkService.subscribeToAppLinks((data) => {
            setLinks(data)
        });
        return () => unsubscribe();
    }, []);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Instant local preview
        const localUrl = URL.createObjectURL(file);
        setLocalPreview(localUrl);

        setIsUploading(true);
        try {
            const url = await appLinkService.uploadImage(file);
            setImageUrl(url);
            toast.success("Image uploaded successfully");
        } catch (error) {
            toast.error("Failed to upload image");
            setLocalPreview(null);
        } finally {
            setIsUploading(false);
        }
    }

    const handleSaveLink = async () => {
        if (!heading || !content) {
            toast.error("Heading and content are required");
            return;
        }

        setIsSaving(true);
        try {
            if (editingId) {
                await appLinkService.updateAppLink(editingId, {
                    heading,
                    content,
                    imageUrl,
                });
                toast.success("App link updated successfully");
            } else {
                await appLinkService.addAppLink({
                    heading,
                    content,
                    imageUrl,
                });
                toast.success("App link created successfully");
            }
            handleCancelEdit();
        } catch (error) {
            toast.error(editingId ? "Failed to update app link" : "Failed to create app link");
        } finally {
            setIsSaving(false);
        }
    }

    const handleEdit = (link: AppLink) => {
        setEditingId(link.id || null);
        setHeading(link.heading);
        setContent(link.content);
        setImageUrl(link.imageUrl || "");
        setLocalPreview(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const handleCancelEdit = () => {
        setEditingId(null);
        setHeading("");
        setContent("");
        setImageUrl("");
        setLocalPreview(null);
    }

    const handleCopy = (id: string) => {
        const publicUrl = `${window.location.origin}/view-app-link/${id}`;
        navigator.clipboard.writeText(publicUrl);
        setCopiedId(id);
        toast.success("Link copied to clipboard");
        setTimeout(() => setCopiedId(null), 2000);
    }

    const handleDelete = async (id: string | undefined) => {
        if (!id) return;

        try {
            await appLinkService.deleteAppLink(id);
            toast.success("Link deleted");
        } catch (error) {
            toast.error("Failed to delete link");
        }
    }

    return (
        <div className="flex-1 space-y-8 p-8 pt-6 min-h-screen bg-slate-50/50">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">App Links Manager</h2>
                    <p className="text-muted-foreground mt-1">
                        Create public privacy policy / info links for App Store submissions.
                    </p>
                </div>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
                {/* Editor Section */}
                <Card className="shadow-sm border-slate-200 h-fit">
                    <CardHeader>
                        <CardTitle className="text-xl">
                            {editingId ? "Edit Link" : "Create New Link"}
                        </CardTitle>
                        <CardDescription>
                            {editingId ? "Update the details of this link." : "Enter details to generate a public link."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Logo / Header Image</label>
                            <div className="flex items-center gap-4">
                                {(imageUrl || localPreview) ? (
                                    <div className="relative group">
                                        <img src={localPreview || imageUrl} alt="Preview" className={`h-16 w-16 rounded-lg object-cover border border-slate-200 shadow-sm ${isUploading ? 'opacity-50 grayscale' : ''}`} />
                                        {!isUploading && (
                                            <button 
                                                onClick={() => { setImageUrl(""); setLocalPreview(null); }}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        )}
                                        {isUploading && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="h-16 w-16 rounded-lg border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all text-slate-400"
                                    >
                                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-6 w-6" />}
                                    </div>
                                )}
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                />
                                <div className="text-[11px] text-slate-500 max-w-[200px]">
                                    Upload a square or rectangular logo for the top of the page.
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Heading</label>
                            <Input 
                                placeholder="e.g. Privacy Policy for My App" 
                                value={heading} 
                                onChange={(e) => setHeading(e.target.value)}
                                className="border-slate-200 focus-visible:ring-primary/20"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700">Content (Rich Text)</label>
                            <div className="quill-editor-container h-[350px]">
                                <ReactQuill 
                                    theme="snow"
                                    value={content} 
                                    onChange={setContent}
                                    className="h-[300px] mb-12"
                                    placeholder="Paste your privacy policy or other content here..."
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

                        <div className="flex gap-3">
                            {editingId && (
                                <Button 
                                    variant="outline"
                                    className="flex-1 border-slate-200 hover:bg-slate-50 font-semibold h-11"
                                    onClick={handleCancelEdit}
                                    disabled={isSaving}
                                >
                                    <X className="mr-2 h-4 w-4" />
                                    Cancel
                                </Button>
                            )}
                            <Button 
                                className={`flex-[2] bg-primary hover:bg-primary/90 shadow-md font-semibold h-11 ${editingId ? 'bg-indigo-600 hover:bg-indigo-700' : ''}`}
                                onClick={handleSaveLink}
                                disabled={isSaving || isUploading}
                            >
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (
                                    editingId ? <Check className="mr-2 h-4 w-4" /> : <ImageIcon className="mr-2 h-4 w-4" />
                                )}
                                {editingId ? "Update Link" : "Generate Link"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* History Section */}
                <div className="space-y-6">
                    <h3 className="text-xl font-bold text-slate-800">Recent Links</h3>
                    <div className="space-y-4">
                        {links.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200 text-slate-400 italic">
                                No links created yet.
                            </div>
                        ) : (
                            links.map((link) => (
                                <Card key={link.id} className="shadow-sm border-slate-200 hover:border-primary/30 transition-all group">
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {link.imageUrl ? (
                                                <img src={link.imageUrl} className="h-10 w-10 rounded-md object-cover border border-slate-100" />
                                            ) : (
                                                <div className="h-10 w-10 rounded-md bg-slate-100 flex items-center justify-center text-slate-400">
                                                    <ImageIcon className="h-5 w-5" />
                                                </div>
                                            )}
                                            <div>
                                                <h4 className="font-bold text-slate-800 line-clamp-1">{link.heading}</h4>
                                                <p className="text-[11px] text-slate-400 lowercase">
                                                    {link.createdAt?.toDate ? format(link.createdAt.toDate(), "MMM dd, yyyy") : "Just now"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                onClick={() => handleCopy(link.id!)}
                                                className="h-8 border-slate-200 hover:bg-slate-50 relative"
                                            >
                                                {copiedId === link.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleEdit(link)}
                                                className={`h-8 w-8 ${editingId === link.id ? 'text-primary bg-primary/10' : 'text-slate-400 hover:text-primary hover:bg-primary/5'}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            This action cannot be undone. This will permanently delete the 
                                                            <strong className="text-slate-900"> {link.heading} </strong> link and its content.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction 
                                                            onClick={() => handleDelete(link.id)}
                                                            className="bg-red-500 hover:bg-red-600 text-white"
                                                        >
                                                            Delete Forever
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                            <a 
                                                href={`/view-app-link/${link.id}`} 
                                                target="_blank" 
                                                rel="noreferrer"
                                                className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-primary/10 text-primary transition-colors"
                                            >
                                                <ExternalLink className="h-4 w-4" />
                                            </a>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

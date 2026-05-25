import { 
    Sheet, SheetContent, SheetHeader, SheetTitle 
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { 
    Paperclip, FileText, Plus, ArrowLeft, Trash2, Upload 
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface ResourcePanelProps {
    isOpen: boolean;
    onClose: () => void;
    project: any;
    isClient: boolean;
    resourceSheetView: 'list' | 'add' | 'detail';
    setResourceSheetView: (v: 'list' | 'add' | 'detail') => void;
    selectedResource: any;
    setSelectedResource: (r: any) => void;
    resourceType: 'text' | 'file';
    setResourceType: (t: 'text' | 'file') => void;
    resourceTitle: string;
    setResourceTitle: (s: string) => void;
    resourceContent: string;
    setResourceContent: (s: string) => void;
    setResourceFile: (f: File | null) => void;
    isSavingResource: boolean;
    onSaveResource: () => void;
    onDeleteResource: (id: string) => void;
}

export function ResourcePanel({
    isOpen, onClose, project, isClient, resourceSheetView, setResourceSheetView,
    selectedResource, setSelectedResource, resourceType, setResourceType,
    resourceTitle, setResourceTitle, resourceContent, setResourceContent,
    setResourceFile, isSavingResource, onSaveResource, onDeleteResource
}: ResourcePanelProps) {
    if (!project) return null;

    return (
        <Sheet open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
            <SheetContent className="w-full sm:max-w-xl p-0 border-none bg-white font-sans overflow-hidden flex flex-col h-full rounded-l-[3rem] shadow-[-20px_0_50px_rgba(0,0,0,0.1)]">
                <SheetHeader className="p-8 pb-4 flex flex-row items-center justify-between shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        {resourceSheetView !== 'list' && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setResourceSheetView('list')}
                                className="h-10 w-10 rounded-xl hover:bg-slate-100 transition-all"
                            >
                                <ArrowLeft className="h-5 w-5 text-slate-600" />
                            </Button>
                        )}
                        <div>
                            <SheetTitle className="text-2xl font-black text-slate-900 tracking-tight">
                                {resourceSheetView === 'list' ? 'Project Vault' : resourceSheetView === 'add' ? 'Add Resource' : 'Resource Detail'}
                            </SheetTitle>
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary mt-1">
                                {project.name} • Internal Assets
                            </p>
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-8 pb-32">
                    {resourceSheetView === 'add' && (
                        <div className="space-y-8 animate-in slide-in-from-right duration-300">
                            <div className="bg-slate-50/50 p-1 rounded-2xl border border-slate-100 flex gap-1">
                                <Button
                                    variant={resourceType === 'text' ? 'default' : 'ghost'}
                                    onClick={() => setResourceType('text')}
                                    className={cn(
                                        "flex-1 rounded-xl h-11 font-bold text-xs uppercase tracking-wider transition-all",
                                        resourceType === 'text' ? "bg-white text-primary shadow-sm border border-slate-200" : "text-slate-400"
                                    )}
                                >
                                    <FileText className="h-4 w-4 mr-2" /> Text/Notes
                                </Button>
                                <Button
                                    variant={resourceType === 'file' ? 'default' : 'ghost'}
                                    onClick={() => setResourceType('file')}
                                    className={cn(
                                        "flex-1 rounded-xl h-11 font-bold text-xs uppercase tracking-wider transition-all",
                                        resourceType === 'file' ? "bg-white text-primary shadow-sm border border-slate-200" : "text-slate-400"
                                    )}
                                >
                                    <Paperclip className="h-4 w-4 mr-2" /> Document/File
                                </Button>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Asset Title</label>
                                    <Input
                                        placeholder="e.g. Website Credentials, Brand Guidelines..."
                                        value={resourceTitle}
                                        onChange={(e) => setResourceTitle(e.target.value)}
                                        className="h-14 bg-slate-50 border-slate-100 rounded-2xl px-6 font-bold focus-visible:ring-primary/20 transition-all"
                                    />
                                </div>

                                {resourceType === 'text' ? (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Content / Details</label>
                                        <Textarea
                                            placeholder="Paste links, login info, or notes here..."
                                            value={resourceContent}
                                            onChange={(e) => setResourceContent(e.target.value)}
                                            className="min-h-[200px] bg-slate-50 border-slate-100 rounded-2xl px-6 py-4 font-medium focus-visible:ring-primary/20 transition-all resize-none shadow-inner"
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Upload File</label>
                                        <div className="relative group">
                                            <Input
                                                type="file"
                                                onChange={(e) => setResourceFile(e.target.files?.[0] || null)}
                                                className="h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl cursor-pointer opacity-0 absolute inset-0 z-10"
                                            />
                                            <div className="h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-3 transition-all group-hover:border-primary/30 group-hover:bg-primary/[0.02]">
                                                <div className="h-12 w-12 rounded-2xl bg-white border shadow-sm flex items-center justify-center text-slate-300 group-hover:text-primary transition-colors">
                                                    <Upload className="h-6 w-6" />
                                                </div>
                                                <span className="text-xs font-bold text-slate-400 group-hover:text-slate-600 transition-colors">Click or drag to upload asset</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-4 pt-4">
                                <Button
                                    variant="ghost"
                                    onClick={() => setResourceSheetView('list')}
                                    className="flex-1 h-14 rounded-2xl font-bold text-slate-500 hover:bg-slate-50"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={onSaveResource}
                                    disabled={isSavingResource || !resourceTitle || (resourceType === 'text' ? !resourceContent : false)}
                                    className="flex-[2] h-14 bg-primary hover:bg-primary/90 text-white rounded-2xl font-bold shadow-xl shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isSavingResource ? "Locking Vault..." : "Save to Vault"}
                                </Button>
                            </div>
                        </div>
                    )}

                    {resourceSheetView === 'list' && (
                        <div className="space-y-8 animate-in fade-in duration-500">
                            {!isClient && (
                                <button
                                    onClick={() => setResourceSheetView('add')}
                                    className="w-full py-10 rounded-[2.5rem] border-2 border-dashed border-slate-100 bg-slate-50/30 flex flex-col items-center justify-center gap-4 group hover:bg-primary/[0.02] hover:border-primary/20 transition-all duration-300"
                                >
                                    <div className="h-14 w-14 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center text-slate-300 group-hover:text-primary group-hover:scale-110 transition-all duration-300">
                                        <Plus className="h-6 w-6" />
                                    </div>
                                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-primary transition-colors">Add New Team Resource</span>
                                </button>
                            )}

                            <div className="space-y-4">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-4 mb-6">Available Assets ({project.resources?.length || 0})</h3>
                                {project.resources?.map((resource: any) => (
                                    <div
                                        key={resource.id}
                                        onClick={() => {
                                            setSelectedResource(resource);
                                            setResourceSheetView('detail');
                                        }}
                                        className="group p-5 rounded-[1.5rem] border border-slate-100 bg-white hover:border-primary/20 hover:shadow-xl hover:shadow-primary/[0.05] transition-all duration-300 cursor-pointer flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-5">
                                            <div className={cn(
                                                "h-12 w-12 rounded-2xl flex items-center justify-center border transition-all group-hover:scale-110",
                                                resource.type === 'file' ? "bg-primary/5 text-primary border-primary/10" : "bg-blue-50 text-blue-500 border-blue-100"
                                            )}>
                                                {resource.type === 'file' ? <Paperclip className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-sm text-slate-900 truncate leading-none group-hover:text-primary transition-colors">{resource.title}</h4>
                                                <p className="text-[10px] text-slate-400 mt-2 font-black uppercase tracking-widest flex items-center gap-2">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-slate-200 group-hover:bg-primary transition-colors" />
                                                    {resource.createdBy} • {format(new Date(resource.createdAt), 'MMM d')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 pr-2">
                                            <ArrowLeft className="h-4 w-4 text-slate-200 rotate-180 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </div>
                                ))}
                                {(!project.resources || project.resources.length === 0) && !isClient && (
                                    <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                                        <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-200">
                                            <Paperclip className="h-8 w-8" />
                                        </div>
                                        <p className="text-xs font-bold text-slate-400">Vault is empty. Share the first asset.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {resourceSheetView === 'detail' && selectedResource && (
                        <div className="space-y-8 animate-in slide-in-from-left duration-300">
                            <div className="space-y-8">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "h-14 w-14 rounded-2xl flex items-center justify-center border shadow-sm",
                                            selectedResource.type === 'file' ? "bg-primary/5 text-primary border-primary/10" : "bg-blue-50 text-blue-500 border-blue-100"
                                        )}>
                                            {selectedResource.type === 'file' ? <Paperclip className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 leading-none">{selectedResource.title}</h3>
                                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">
                                                {selectedResource.type} Asset
                                            </p>
                                        </div>
                                    </div>
                                    {!isClient && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                onDeleteResource(selectedResource.id);
                                                setResourceSheetView('list');
                                            }}
                                            className="h-12 w-12 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </Button>
                                    )}
                                </div>

                                <div className="p-8 rounded-[2rem] border border-slate-100 bg-slate-50/50 space-y-6 shadow-inner relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        {selectedResource.type === 'file' ? <Paperclip className="h-20 w-20" /> : <FileText className="h-20 w-20" />}
                                    </div>
                                    
                                    {selectedResource.type === 'text' ? (
                                        <p className="text-sm text-slate-700 leading-relaxed font-bold whitespace-pre-wrap relative z-10">
                                            {selectedResource.content}
                                        </p>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-8 gap-8 relative z-10">
                                            <div className="h-24 w-24 bg-white rounded-[2rem] flex items-center justify-center border shadow-xl relative group/file transition-all hover:scale-105 hover:rotate-2">
                                                <FileText className="h-10 w-10 text-primary" />
                                                <div className="absolute inset-0 bg-primary/5 rounded-[2rem] opacity-0 group-hover/file:opacity-100 transition-opacity" />
                                            </div>
                                            <div className="text-center">
                                                <p className="font-black text-slate-900 text-lg mb-1">{selectedResource.fileName || "Project Document"}</p>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vault asset ready for team use</p>
                                            </div>
                                            <Button asChild className="w-full h-14 bg-primary hover:bg-primary/90 text-white rounded-2xl font-bold shadow-xl shadow-primary/20 transition-all active:scale-95">
                                                <a href={selectedResource.content} target="_blank" rel="noopener noreferrer">
                                                    <Upload className="h-4 w-4 mr-3 rotate-180" />
                                                    Download from Vault
                                                </a>
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-8 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                        <span>Shared By {selectedResource.createdBy}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span>Vaulted on {format(new Date(selectedResource.createdAt), 'MMM d, yyyy • h:mm a')}</span>
                                    </div>
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                onClick={() => setResourceSheetView('list')}
                                className="w-full h-14 rounded-2xl font-bold border-slate-200 text-slate-500 hover:bg-slate-50 transition-all"
                            >
                                Return to Vault
                            </Button>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetFooter,
} from "@/components/ui/sheet"
import { toast } from "sonner"
import { Sparkles, FileText, Check, Upload, Loader2, Trash2 } from "lucide-react"
import { projectService } from "src/firebase/projectService"
import { cn } from "@/lib/utils"

interface QuickPostSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    project: any
    week: string
    month: string
    onTasksAdded?: () => void
    targetItem?: any
}

export function QuickPostSheet({ open, onOpenChange, project, week, month, onTasksAdded, targetItem }: QuickPostSheetProps) {
    const [title, setTitle] = useState("");
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['Instagram', 'Facebook']);
    const [files, setFiles] = useState<File[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            const pastedFiles: File[] = [];
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image/') !== -1 || items[i].type.indexOf('video/') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) pastedFiles.push(file);
                }
            }
            if (pastedFiles.length > 0) {
                setFiles(prev => [...prev, ...pastedFiles]);
                toast.success(`Captured ${pastedFiles.length} file(s) from clipboard`);
            }
        };

        if (open) {
            setTitle(targetItem?.task || "");
            setFiles([]);
            setSelectedPlatforms(targetItem?.platform ? [targetItem.platform] : ['Instagram', 'Facebook']);
            document.addEventListener('paste', handlePaste);
        }

        return () => {
            document.removeEventListener('paste', handlePaste);
        };
    }, [open, targetItem]);

    const handleSave = async () => {
        const finalTitle = targetItem?.task || title;
        if (!finalTitle.trim() || selectedPlatforms.length === 0 || !project?.id) {
            toast.error("Required data missing");
            return;
        }

        setIsSaving(true);
        try {
            // 1. Upload files
            const attachments: any[] = [];
            for (const file of files) {
                const url = await projectService.uploadProjectFile(project.id, file);
                attachments.push({
                    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    name: file.name,
                    url,
                    type: file.type,
                    size: file.size,
                    createdAt: new Date().toISOString()
                });
            }

            // 2. Identify and create/update tasks
            const existingMilestones = [...(project.milestones || [])];
            let updatedMilestones = [...existingMilestones];

            // Helper to get a "core" title (e.g. "Instagram Post 1" -> "Post 1")
            const platformsToStrip = ['Instagram', 'Facebook', 'LinkedIn', 'Twitter/X', 'Twitter', 'X', 'YouTube', 'TikTok', 'Pinterest'];
            const getCoreTitle = (t: string) => {
                let core = t;
                platformsToStrip.forEach(p => {
                    core = core.replace(new RegExp(p, 'gi'), '').trim();
                });
                return core;
            };

            const targetCore = getCoreTitle(finalTitle);

            selectedPlatforms.forEach(platform => {
                // Find matching task for this platform in this week
                const existingTaskIdx = updatedMilestones.findIndex(m => {
                    // If this is the source row's platform and we have a targetItem, match by ID
                    if (targetItem && m.id === targetItem.id && platform === targetItem.platform) {
                        return true;
                    }

                    const isSameContext = m.week === week && m.monthYear === month && m.platform === platform;
                    if (!isSameContext) return false;
                    
                    // Match if exact, or if they share the same "core" theme
                    const taskCore = getCoreTitle(m.task);
                    return m.task === finalTitle || (targetCore.length > 2 && taskCore === targetCore);
                });

                if (existingTaskIdx > -1) {
                    // Update existing
                    updatedMilestones[existingTaskIdx] = {
                        ...updatedMilestones[existingTaskIdx],
                        attachments: [...(updatedMilestones[existingTaskIdx].attachments || []), ...attachments]
                    };
                } else {
                    // Create new
                    const newTaskTitle = (targetCore.length > 2 && !finalTitle.toLowerCase().includes(platform.toLowerCase())) 
                        ? `${platform} ${targetCore}` 
                        : finalTitle;

                    updatedMilestones.push({
                        id: `quick-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                        task: newTaskTitle,
                        platform,
                        week,
                        monthYear: month,
                        status: 'Pending',
                        attachments: [...attachments],
                        date: new Date().toISOString().split('T')[0],
                        actualPostingDate: '',
                        contentType: 'Post',
                        subtasks: [],
                        notes: []
                    });
                }
            });

            await projectService.updateProject(project.id, { milestones: updatedMilestones });
            
            toast.success(`Updated ${selectedPlatforms.length} platforms`);
            onOpenChange(false);
            if (onTasksAdded) onTasksAdded();
        } catch (error) {
            console.error(error);
            toast.error("Failed to sync posts");
        } finally {
            setIsSaving(false);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="sm:max-w-xl p-0 overflow-hidden flex flex-col border-l-0 shadow-2xl">
                <SheetHeader className="bg-white border-b border-slate-100 px-6 py-4 text-primary shrink-0 relative overflow-hidden group">
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="h-10 w-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 shadow-sm">
                            <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <SheetTitle className="text-sm font-black uppercase tracking-tight text-primary leading-none">
                                Quick Post
                            </SheetTitle>
                            <SheetDescription className="text-slate-400 text-[9px] font-black uppercase tracking-[0.2em] mt-1 leading-none">
                                {week} • {month}
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-white">
                    {targetItem && (
                        <div className="bg-white border border-slate-100 rounded-xl p-3 flex items-center gap-3 shadow-sm shadow-slate-200/20">
                            <div className="h-8 w-8 bg-slate-50 rounded-lg flex items-center justify-center shrink-0 border border-slate-100">
                                <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div className="space-y-0.5 min-w-0">
                                <Label className="text-[8px] font-black uppercase tracking-widest text-slate-400">Targeting</Label>
                                <p className="text-xs font-bold text-slate-600 leading-none truncate">
                                    "{targetItem.task}"
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Target Platforms</Label>
                            <Button 
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    const all = Array.from(new Set(project.milestones?.map((m: any) => m.platform).filter(Boolean)));
                                    setSelectedPlatforms(all as string[]);
                                }}
                                className="h-5 text-[9px] font-black uppercase text-primary hover:bg-slate-50 rounded-full px-2"
                            >
                                Select All
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {Array.from(new Set(project.milestones?.map((m: any) => m.platform).filter(Boolean)))
                                .sort()
                                .map((p: any) => (
                                <button 
                                    key={p} 
                                    className={cn(
                                        "flex items-center gap-2.5 p-2 rounded-xl border-2 transition-all duration-200",
                                        selectedPlatforms.includes(p) 
                                            ? "bg-white border-primary text-primary shadow-sm" 
                                            : "bg-white border-slate-100 hover:border-slate-200 text-slate-400"
                                    )}
                                    onClick={() => setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p])}
                                >
                                    <div className={cn(
                                        "h-4 w-4 rounded-md flex items-center justify-center transition-all border",
                                        selectedPlatforms.includes(p) ? "bg-primary border-primary text-white" : "bg-white border-slate-200"
                                    )}>
                                        {selectedPlatforms.includes(p) && <Check className="h-2.5 w-2.5 stroke-[4px]" />}
                                    </div>
                                    <span className="text-[11px] font-bold tracking-tight">{p}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Post Creative Assets</Label>
                            {files.length > 0 && (
                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50/50 px-2 py-0.5 rounded-full border border-emerald-100/50">
                                    {files.length} Item(s)
                                </span>
                            )}
                        </div>
                        
                        <input 
                            type="file" 
                            multiple 
                            className="hidden" 
                            ref={fileInputRef} 
                            onChange={(e) => {
                                if (e.target.files) setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                            }} 
                        />

                        {files.length > 0 ? (
                            <div className="grid grid-cols-3 gap-3">
                                {files.map((file, idx) => (
                                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-100 bg-white aspect-square flex flex-col items-center justify-center p-2 shadow-sm shadow-slate-100">
                                        <div className="h-8 w-8 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-center mb-1">
                                            <Upload className="h-4 w-4 text-primary" />
                                        </div>
                                        <p className="text-[9px] font-bold text-slate-500 text-center truncate w-full px-1">
                                            {file.name}
                                        </p>
                                        <button 
                                            onClick={() => removeFile(idx)}
                                            className="absolute top-1 right-1 h-5 w-5 bg-white shadow-md border border-slate-100 rounded-full flex items-center justify-center text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 hover:text-white"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </button>
                                    </div>
                                ))}
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="rounded-xl border border-dashed border-slate-200 hover:border-primary/40 hover:bg-slate-50 transition-all flex flex-col items-center justify-center gap-1 aspect-square"
                                >
                                    <Plus className="h-5 w-5 text-slate-300" />
                                    <span className="text-[9px] font-black uppercase text-slate-400">Add More</span>
                                </button>
                            </div>
                        ) : (
                            <div 
                                className="group border-2 border-dashed rounded-[1.2rem] p-8 flex flex-col items-center justify-center transition-all cursor-pointer border-slate-100 hover:border-primary/10 bg-white hover:bg-white"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <div className="h-14 w-14 bg-white border border-slate-100 group-hover:border-primary/20 rounded-2xl flex items-center justify-center mb-4 transition-colors shadow-sm shadow-slate-100">
                                    <Upload className="h-6 w-6 text-slate-300 group-hover:text-primary transition-colors" />
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="text-sm font-black text-slate-600">Drop creative or click</p>
                                    <p className="text-[10px] font-medium text-slate-400 max-w-[150px] mx-auto leading-tight">
                                        Paste from clipboard or drag assets here.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <SheetFooter className="p-4 border-t shrink-0 flex-row gap-2 bg-white">
                    <Button 
                        variant="ghost" 
                        onClick={() => onOpenChange(false)}
                        className="flex-1 h-9 font-bold text-[11px] text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all rounded-lg"
                    >
                        Cancel
                    </Button>
                    <Button 
                        disabled={isSaving || (!targetItem && !title.trim()) || selectedPlatforms.length === 0}
                        onClick={handleSave}
                        className="flex-[2] bg-primary hover:bg-primary/90 text-white h-9 text-[11px] font-black uppercase tracking-widest rounded-lg shadow-md shadow-primary/10 transition-all active:scale-95"
                    >
                        {isSaving ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Wait...</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>Sync Posts</span>
                            </div>
                        )}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

const Plus = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="M12 5v14"></path></svg>
);

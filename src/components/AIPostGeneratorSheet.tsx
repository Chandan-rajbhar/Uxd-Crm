import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Sheet,
    SheetContent,
} from "@/components/ui/sheet";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
    Save,
    Download,
    Copy,
    Sparkles,
    Image as ImageIcon,
    Video as VideoIcon,
    Loader2,
    Zap,
    X,
    Trash2,
    Film,
    Layers,
    Plus
} from "lucide-react";
import { projectService } from "src/firebase/projectService";
import { cn } from "@/lib/utils";
import { functions } from "@/firebase/config";
import { httpsCallable } from "firebase/functions";

interface AIPostGeneratorSheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    project: any
    targetItem?: any
    onUpdateTask?: (task: any) => void
}


const REFINEMENTS = [
    "Make it more dramatic",
    "Add more vibrant colors",
    "Change to dark mode",
    "Make it minimalist",
    "Add professional lighting",
    "Increase detail and texture"
];

export function AIPostGeneratorSheet({ open, onOpenChange, project, targetItem, onUpdateTask }: AIPostGeneratorSheetProps) {
    const [prompt, setPrompt] = useState("");
    const [isGenerating, setIsGenerating] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [selectedPost, setSelectedPost] = useState<any>(null);
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [viewMode, setViewMode] = useState<'create' | 'preview'>('create');
    const [isApplying, setIsApplying] = useState(false);
    const [referenceImages, setReferenceImages] = useState<string[]>([]);
    const [firstFrame, setFirstFrame] = useState<string | null>(null);
    const [lastFrame, setLastFrame] = useState<string | null>(null);
    const [videoInputMode, setVideoInputMode] = useState<'reference' | 'frames'>('reference');
    const [refinementInput, setRefinementInput] = useState("");
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [isReel, setIsReel] = useState(false);
    const [resolution, setResolution] = useState('1080p');
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const firstFrameInputRef = React.useRef<HTMLInputElement>(null);
    const lastFrameInputRef = React.useRef<HTMLInputElement>(null);

    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            if (open && project?.id && targetItem?.id) {
                setIsLoadingHistory(true);
                try {
                    const subData = await projectService.getAIHistory(project.id, targetItem.id);
                    const legacyData = (targetItem as any).aiHistory || [];
                    
                    // Merge and de-duplicate
                    const combined = [...subData];
                    legacyData.forEach((le: any) => {
                        // Use URL as unique identifier for AI iterations
                        if (!combined.some(c => c.url === le.url)) {
                            combined.push({ ...le, isLegacy: true });
                        }
                    });

                    setHistory(combined);
                    setSelectedPost(combined[0] || null);
                } catch (error) {
                    console.error("Failed to load history:", error);
                } finally {
                    setIsLoadingHistory(false);
                }
            }
        };

        if (open) {
            setViewMode('create');
            setReferenceImages([]);
            setFirstFrame(null);
            setLastFrame(null);
            setVideoInputMode('reference');
            setIsReel(targetItem?.contentType === 'Reel');
            if (targetItem) {
                setPrompt(targetItem.task || "");
            } else {
                setPrompt("");
            }
            fetchHistory();
        }
    }, [open, targetItem, project?.id]);

    const handleGenerate = async (finalPrompt: string = prompt, refImageOverride?: string) => {
        if (!finalPrompt.trim()) {
            toast.error("Please enter a vision or prompt");
            return;
        }

        setIsGenerating(true);
        try {
            const generateSocialPost = httpsCallable(functions, 'generateSocialPost', {
                timeout: 540000 // Match backend 9-minute timeout
            });

            // Build image payload based on mode
            const refImagesB64 = referenceImages.map(img => img.split(',')[1]).filter(Boolean);
            const firstFrameB64 = firstFrame?.split(',')[1] || null;
            const lastFrameB64 = lastFrame?.split(',')[1] || null;
            // For image mode, use first reference image as legacy referenceImage
            const legacyRefImage = refImageOverride?.split(',')[1] || refImagesB64[0] || null;

            const result: any = await generateSocialPost({
                prompt: finalPrompt,
                projectId: project.id,
                taskId: targetItem?.id,
                aspectRatio: isReel ? "9:16" : aspectRatio,
                resolution: isReel ? resolution : '2K',
                platform: targetItem?.platform || 'Instagram',
                referenceImage: !isReel ? legacyRefImage : null,
                referenceImages: isReel && videoInputMode === 'reference' ? refImagesB64 : null,
                firstFrame: isReel && videoInputMode === 'frames' ? firstFrameB64 : null,
                lastFrame: isReel && videoInputMode === 'frames' ? lastFrameB64 : null,
                isReel: isReel
            });

            if (result.data) {
                const newPost = {
                    id: result.data.id,
                    url: result.data.url,
                    prompt: finalPrompt,
                    metadata: result.data.metadata
                };
                setHistory(prev => [newPost, ...prev]);
                setSelectedPost(newPost);
                setViewMode('preview');

                // Persist to database
                if (project?.id && targetItem?.id) {
                    await projectService.addAIHistoryItem(project.id, targetItem.id, newPost);
                }
                toast.success("Masterpiece Generated!", {
                    description: "Saved to your project posts."
                });
            }
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Engine failure during synthesis.");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (isReel && videoInputMode === 'reference') {
            // Multi-file: read all selected, cap at 3 total
            const remaining = 3 - referenceImages.length;
            const toProcess = Array.from(files).slice(0, remaining);
            toProcess.forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setReferenceImages(prev => prev.length < 3 ? [...prev, reader.result as string] : prev);
                };
                reader.readAsDataURL(file);
            });
        } else {
            // Single file for image mode
            const reader = new FileReader();
            reader.onloadend = () => {
                setReferenceImages([reader.result as string]);
            };
            reader.readAsDataURL(files[0]);
        }
        if (e.target) e.target.value = '';
    };

    const handleFrameUpload = (type: 'first' | 'last') => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (type === 'first') setFirstFrame(reader.result as string);
                else setLastFrame(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
        if (e.target) e.target.value = '';
    };


    const handleRefine = async (refinement: string = refinementInput) => {
        if (!refinement.trim()) return;
        
        // Detect if user is asking for suggestions
        const isRequestingSuggestions = refinement.toLowerCase().includes('suggest') || 
                                      refinement.toLowerCase().includes('ideas') ||
                                      refinement.toLowerCase().includes('captions');

        if (isRequestingSuggestions && refinement === refinementInput) {
            setSuggestions([]);
            try {
                // Return some high-quality suggestions for the current context
                const mockSuggestions = [
                    "Only Whole Foods, No Compromises",
                    "Fuel Your Life with Plants",
                    "Eat Green, Feel Lean",
                    "The Future is Plant-Based",
                    "Nature's Power on Your Plate"
                ];
                // In a real scenario, we could call an LLM here. For now, we'll provide these premium options.
                setSuggestions(mockSuggestions);
                setRefinementInput("");
                return;
            } finally {
                // Done
            }
        }

        setIsGenerating(true);
        setSuggestions([]); // Clear suggestions when generating
        try {
            // First, get the base64 of the current image to use as reference if iterating
            let refImage: string | null = referenceImages[0] || null;
            if (selectedPost?.url) {
                try {
                    const response = await fetch(selectedPost.url);
                    const blob = await response.blob();
                    const reader = new FileReader();
                    const b64Promise = new Promise<string>((resolve) => {
                        reader.onloadend = () => resolve(reader.result as string);
                    });
                    reader.readAsDataURL(blob);
                    refImage = await b64Promise;
                } catch (e) {
                    console.error("Failed to fetch image for iteration", e);
                }
            }

            const base = selectedPost?.prompt || prompt;
            const newPrompt = `SURGICAL INPAINTING TASK: Use the provided image as the ABSOLUTE reference for composition, character, and environment. 
            
            YOUR TASK: ${refinement}.
            
            STRICT CONSTRAINTS:
            - DO NOT change the person/subject in the image.
            - DO NOT change the clothing or objects (like the salad bowl).
            - DO NOT change the background or layout.
            - ONLY apply the requested change: ${refinement}.
            - The final output must look like the original image but with the specific modification applied.`;
            
            setPrompt(base); // Keep the base prompt in UI
            setRefinementInput("");
            await handleGenerate(newPrompt, refImage ?? undefined);
        } catch (error) {
            console.error(error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveToTask = async () => {
        if (!selectedPost || !targetItem || !project?.id) return;
        setIsApplying(true);
        try {
            const updatedTask = {
                ...targetItem,
                aiImage: selectedPost.url,
                aiPrompt: selectedPost.prompt,
                contentType: selectedPost.metadata?.type === 'reel' ? 'Reel' : (targetItem.contentType || 'Social Post'),
                lastUpdate: new Date().toISOString()
            };

            const existingMilestones = [...(project.milestones || [])];
            const idx = existingMilestones.findIndex(m => m.id === targetItem.id);
            
            if (idx > -1) {
                existingMilestones[idx] = updatedTask;
                await projectService.updateProject(project.id, { milestones: existingMilestones });
                if (onUpdateTask) onUpdateTask(updatedTask);
                toast.success("Visual deployed to project tracker!");
                onOpenChange(false);
            }
        } catch (error) {
            console.error(error);
            toast.error("Deployment failed.");
        } finally {
            setIsApplying(false);
        }
    };

    const handleDeletePost = async (e: React.MouseEvent, postId: string) => {
        e.stopPropagation();
        if (!project?.id || !targetItem?.id) return;

        try {
            const postToDelete = history.find(p => p.id === postId);
            if (!postToDelete) return;

            if (postToDelete.isLegacy) {
                const updatedHistory = ((targetItem as any).aiHistory || []).filter((h: any) => h.url !== postToDelete.url);
                const milestones = (project.milestones || []).map((m: any) => 
                    m.id === targetItem.id ? { ...m, aiHistory: updatedHistory } : m
                );
                await projectService.updateProject(project.id, { milestones });
            } else {
                await projectService.removeAIHistoryItem(project.id, postId, postToDelete.url);
            }
            
            setHistory(prev => {
                const newHistory = prev.filter(p => p.id !== postId);
                if (selectedPost?.id === postId) {
                    setSelectedPost(newHistory[0] || null);
                }
                return newHistory;
            });
            toast.success("Iteration deleted.");
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete iteration.");
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent 
                side="right" 
                className="w-[80vw] sm:max-w-none p-0 border-none bg-white overflow-hidden shadow-none [&>button]:hidden flex"
            >
                {/* Left Sidebar: Recent History (Solid) */}
                <div className="w-[180px] border-r border-slate-200 flex flex-col bg-slate-50">

                    <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                        <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-6">Recent Iterations</h2>
                        <div className="space-y-4">
                            {isLoadingHistory ? (
                                <div className="flex flex-col items-center justify-center py-10 space-y-2 opacity-50">
                                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    <span className="text-[8px] font-black tracking-widest uppercase">Hydrating Iterations...</span>
                                </div>
                            ) : history.length === 0 && (
                                <div className="text-center py-10 opacity-20">
                                    <ImageIcon className="h-10 w-10 mx-auto mb-3" />
                                    <p className="text-[10px] font-black uppercase tracking-widest">No history yet</p>
                                </div>
                            )}
                            {history.map(post => (
                                <div 
                                    key={post.id}
                                    onClick={() => { setSelectedPost(post); setViewMode('preview'); }}
                                    className={cn(
                                        "group relative aspect-square rounded-2xl overflow-hidden border-2 cursor-pointer transition-all hover:scale-95 active:scale-90",
                                        selectedPost?.id === post.id ? "border-primary shadow-2xl shadow-primary/20" : "border-slate-200 opacity-60 hover:opacity-100"
                                    )}
                                >
                                    {post.url?.endsWith('.mp4') || post.metadata?.type === 'reel' ? (
                                        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                                            <VideoIcon className="h-6 w-6 text-white/50" />
                                        </div>
                                    ) : (
                                        <img src={post.url} className="w-full h-full object-cover" alt="" />
                                    )}
                                    
                                    {/* Delete Button (Subtle Hover) */}
                                    <button
                                        onClick={(e) => handleDeletePost(e, post.id)}
                                        className="absolute top-2 right-2 h-7 w-7 bg-white/90 backdrop-blur-sm rounded-lg opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center border border-slate-200 hover:bg-white hover:text-red-500 shadow-sm"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col relative overflow-hidden bg-[#f3f4f6]">
                    
                    {/* Professional Header */}
                    <div className="h-16 flex items-center justify-between px-10 border-b border-slate-100 z-30 bg-white">
                        <div className="flex items-center gap-3">
                            <div className="h-2 w-2 rounded-full bg-primary" />
                            <div>
                                <h1 className="text-[11px] font-bold uppercase tracking-widest text-slate-900">AI Iteration Engine</h1>
                                <p className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter mt-0.5">{project?.name || 'New Project'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                             {viewMode === 'preview' && (
                                 <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setViewMode('create')}
                                    className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-primary transition-colors"
                                 >
                                     New Generation
                                 </Button>
                             )}
                             <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => onOpenChange(false)}
                                className="h-8 w-8 p-0 rounded-full hover:bg-slate-100"
                             >
                                 <X className="h-4 w-4 text-slate-400" />
                             </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto pt-24 pb-40 px-10 scrollbar-hide">
                        {viewMode === 'create' || !selectedPost ? (
                            <div className="max-w-4xl mx-auto py-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
                            <div className="max-w-4xl mx-auto">
                                <div className="text-center mb-16">
                                    <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-900 mb-4">What's the vision?</h2>
                                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] opacity-80">Transform your data into visual masterpieces</p>
                                </div>

                                <div className="w-full bg-slate-50 rounded-[2rem] p-2 transition-all duration-300">
                                    <Textarea 
                                        value={prompt}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                                        placeholder="Describe your creative direction... e.g. 'A sleek minimalist coffee brand launch'"
                                        className="w-full bg-transparent border-none focus-visible:ring-0 text-lg font-medium p-8 min-h-[180px] text-slate-800 placeholder:text-slate-300 resize-none"
                                    />
                                        {/* ── Veo Video Inputs ── */}
                                        {isReel && (
                                            <div className="mx-6 mb-4 rounded-2xl bg-white border border-slate-100 overflow-hidden shadow-sm">
                                                {/* Mode Tabs */}
                                                <div className="flex border-b border-slate-100">
                                                    <button
                                                        onClick={() => setVideoInputMode('reference')}
                                                        className={cn(
                                                            "flex-1 flex items-center justify-center gap-2 py-3 text-[9px] font-black uppercase tracking-[0.15em] transition-all relative",
                                                            videoInputMode === 'reference'
                                                                ? "text-primary bg-primary/[0.03]"
                                                                : "text-slate-400 hover:text-slate-500 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <Layers className="h-3.5 w-3.5" />
                                                        Reference Images
                                                        <span className="ml-1 text-[8px] font-bold text-slate-400/60">up to 3</span>
                                                        {videoInputMode === 'reference' && (
                                                            <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-primary rounded-full" />
                                                        )}
                                                    </button>
                                                    <div className="w-px bg-slate-100" />
                                                    <button
                                                        onClick={() => setVideoInputMode('frames')}
                                                        className={cn(
                                                            "flex-1 flex items-center justify-center gap-2 py-3 text-[9px] font-black uppercase tracking-[0.15em] transition-all relative",
                                                            videoInputMode === 'frames'
                                                                ? "text-primary bg-primary/[0.03]"
                                                                : "text-slate-400 hover:text-slate-500 hover:bg-slate-50"
                                                        )}
                                                    >
                                                        <Film className="h-3.5 w-3.5" />
                                                        First & Last Frame
                                                        <span className="ml-1 text-[8px] font-bold text-slate-400/60">interpolation</span>
                                                        {videoInputMode === 'frames' && (
                                                            <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-primary rounded-full" />
                                                        )}
                                                    </button>
                                                </div>

                                                {/* Upload Area */}
                                                <div className="p-5">
                                                    {videoInputMode === 'reference' ? (
                                                        <div className="flex items-start gap-3">
                                                            {referenceImages.map((img, idx) => (
                                                                <div key={idx} className="relative group/img flex flex-col items-center gap-1.5">
                                                                    <div className="h-[72px] w-[72px] rounded-2xl overflow-hidden ring-2 ring-primary/20 ring-offset-2 shadow-lg transition-all group-hover/img:ring-primary/40">
                                                                        <img src={img} className="h-full w-full object-cover" alt={`Ref ${idx + 1}`} />
                                                                    </div>
                                                                    <button
                                                                        onClick={() => setReferenceImages(prev => prev.filter((_, i) => i !== idx))}
                                                                        className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all shadow-md hover:bg-red-600 hover:scale-110"
                                                                    >
                                                                        <X className="h-3 w-3" />
                                                                    </button>
                                                                    <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Asset {idx + 1}</span>
                                                                </div>
                                                            ))}

                                                            {/* Add Button */}
                                                            {referenceImages.length < 3 && (
                                                                <button
                                                                    onClick={() => fileInputRef.current?.click()}
                                                                    className="flex flex-col items-center gap-1.5 group/add"
                                                                >
                                                                    <div className="h-[72px] w-[72px] rounded-2xl border-2 border-dashed border-slate-200 group-hover/add:border-primary/40 group-hover/add:bg-primary/[0.02] flex flex-col items-center justify-center gap-1 transition-all cursor-pointer">
                                                                        <Plus className="h-5 w-5 text-slate-300 group-hover/add:text-primary/50 transition-colors" />
                                                                        <span className="text-[8px] font-bold text-slate-300 group-hover/add:text-primary/40 transition-colors">{referenceImages.length}/3</span>
                                                                    </div>
                                                                </button>
                                                            )}

                                                            {/* Description */}
                                                            <div className="flex-1 pl-4 flex items-center">
                                                                <p className="text-[10px] text-slate-400 leading-relaxed">
                                                                    Upload reference images of people, products, or characters to preserve their appearance in the generated video.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-4">
                                                            <input type="file" ref={firstFrameInputRef} onChange={handleFrameUpload('first')} accept="image/*" className="hidden" />
                                                            <input type="file" ref={lastFrameInputRef} onChange={handleFrameUpload('last')} accept="image/*" className="hidden" />

                                                            {/* First Frame */}
                                                            <div className="flex flex-col items-center gap-2">
                                                                {firstFrame ? (
                                                                    <div className="relative group/img">
                                                                        <div className="h-[72px] w-[100px] rounded-2xl overflow-hidden ring-2 ring-emerald-400/30 ring-offset-2 shadow-lg">
                                                                            <img src={firstFrame} className="h-full w-full object-cover" alt="First frame" />
                                                                        </div>
                                                                        <button
                                                                            onClick={() => setFirstFrame(null)}
                                                                            className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all shadow-md"
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => firstFrameInputRef.current?.click()}
                                                                        className="h-[72px] w-[100px] rounded-2xl border-2 border-dashed border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50 flex items-center justify-center transition-all cursor-pointer group/add"
                                                                    >
                                                                        <Plus className="h-5 w-5 text-emerald-300 group-hover/add:text-emerald-500 transition-colors" />
                                                                    </button>
                                                                )}
                                                                <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500/70">Start</span>
                                                            </div>

                                                            {/* Arrow */}
                                                            <div className="flex flex-col items-center gap-1 px-1">
                                                                <div className="w-12 h-px bg-gradient-to-r from-emerald-300 via-slate-300 to-orange-300" />
                                                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">interpolate</span>
                                                                <div className="w-12 h-px bg-gradient-to-r from-emerald-300 via-slate-300 to-orange-300" />
                                                            </div>

                                                            {/* Last Frame */}
                                                            <div className="flex flex-col items-center gap-2">
                                                                {lastFrame ? (
                                                                    <div className="relative group/img">
                                                                        <div className="h-[72px] w-[100px] rounded-2xl overflow-hidden ring-2 ring-orange-400/30 ring-offset-2 shadow-lg">
                                                                            <img src={lastFrame} className="h-full w-full object-cover" alt="Last frame" />
                                                                        </div>
                                                                        <button
                                                                            onClick={() => setLastFrame(null)}
                                                                            className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all shadow-md"
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => lastFrameInputRef.current?.click()}
                                                                        className="h-[72px] w-[100px] rounded-2xl border-2 border-dashed border-orange-200 hover:border-orange-400 hover:bg-orange-50/50 flex items-center justify-center transition-all cursor-pointer group/add"
                                                                    >
                                                                        <Plus className="h-5 w-5 text-orange-300 group-hover/add:text-orange-500 transition-colors" />
                                                                    </button>
                                                                )}
                                                                <span className="text-[8px] font-black uppercase tracking-widest text-orange-500/70">End</span>
                                                            </div>

                                                            {/* Description */}
                                                            <div className="flex-1 pl-4 flex items-center">
                                                                <p className="text-[10px] text-slate-400 leading-relaxed">
                                                                    Set a starting and ending frame. Veo will generate a smooth cinematic transition between them.
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* ── Bottom Control Bar ── */}
                                        <div className="flex items-center justify-between px-8 pb-6 pt-2 flex-wrap gap-4">
                                            <div className="flex items-center gap-3">
                                                {!isReel && (
                                                    <div className="flex items-center gap-3">
                                                        <input 
                                                            type="file" 
                                                            ref={fileInputRef}
                                                            onChange={handleFileUpload}
                                                            accept="image/*"
                                                            className="hidden"
                                                        />
                                                        {referenceImages.length > 0 ? (
                                                            <div className="relative group/img">
                                                                <div className="h-9 w-9 rounded-lg overflow-hidden ring-2 ring-primary/20 ring-offset-1">
                                                                    <img src={referenceImages[0]} className="h-full w-full object-cover" alt="" />
                                                                </div>
                                                                <button 
                                                                    onClick={() => setReferenceImages([])}
                                                                    className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-all shadow-lg"
                                                                >
                                                                    <X className="h-2.5 w-2.5" />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <Button 
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => fileInputRef.current?.click()}
                                                                className="h-9 px-4 rounded-xl border-dashed border-slate-300 hover:border-primary hover:bg-primary/5 gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-primary transition-all"
                                                            >
                                                                <ImageIcon className="h-3.5 w-3.5" />
                                                                Reference
                                                            </Button>
                                                        )}
                                                    </div>
                                                )}

                                                {isReel && (
                                                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" />
                                                )}

                                                <Button 
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setIsReel(!isReel)}
                                                    className={cn(
                                                        "h-9 px-4 rounded-full gap-2 text-[9px] font-black uppercase tracking-[0.1em] transition-all border",
                                                        isReel 
                                                            ? "border-primary/40 bg-white text-primary shadow-sm shadow-primary/5" 
                                                            : "border-slate-100 bg-white text-slate-300 hover:border-slate-200"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "h-1.5 w-1.5 rounded-full transition-all duration-500",
                                                        isReel ? "bg-primary shadow-[0_0_8px_rgba(var(--primary),0.8)]" : "bg-slate-200"
                                                    )} />
                                                    {isReel ? "Veo 3.1" : "Gemini 3"}
                                                </Button>

                                                <div className="h-7 w-px bg-slate-100 hidden lg:block" />

                                                <div className="flex items-center gap-1.5">
                                                    <Select value={aspectRatio} onValueChange={setAspectRatio}>
                                                        <SelectTrigger className="w-[80px] h-9 rounded-xl bg-white border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-600 focus:ring-primary/20">
                                                            <SelectValue placeholder="Ratio" />
                                                        </SelectTrigger>
                                                        <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                                                            {['1:1', '16:9', '9:16', '4:5'].map(r => (
                                                                <SelectItem key={r} value={r} className="text-[10px] font-black uppercase tracking-widest cursor-pointer focus:bg-primary/5 focus:text-primary">
                                                                    {r}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>

                                                    {isReel && (
                                                        <Select value={resolution} onValueChange={setResolution}>
                                                            <SelectTrigger className="w-[80px] h-9 rounded-xl bg-white border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-600 focus:ring-primary/20">
                                                                <SelectValue placeholder="Res" />
                                                            </SelectTrigger>
                                                            <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                                                                {['720p', '1080p', '4k'].map(r => (
                                                                    <SelectItem key={r} value={r} className="text-[10px] font-black uppercase tracking-widest cursor-pointer focus:bg-primary/5 focus:text-primary">
                                                                        {r}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    )}
                                                </div>
                                            </div>

                                            <Button 
                                                disabled={isGenerating || !prompt.trim()}
                                                onClick={() => handleGenerate()}
                                                className="h-10 px-6 bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest rounded-xl shadow-2xl shadow-primary/20 transition-all active:scale-95 gap-2 border border-primary/20"
                                            >
                                                {isGenerating ? (
                                                    <>
                                                        <Loader2 className="h-5 w-5 animate-spin" />
                                                        <span>{isReel ? 'Simulating...' : 'Synthesizing...'}</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="h-5 w-5" />
                                                        <span>{isReel ? 'Generate Reel' : 'Generate'}</span>
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex bg-white overflow-hidden animate-in fade-in duration-700">
                                {/* Ultra-Minimal Preview Pane */}
                                <div className="flex-1 overflow-y-auto p-4 sm:p-10 flex items-center justify-center bg-[#fafafa]">
                                    <div className="relative group max-w-2xl w-full">
                                        <div className="relative rounded-3xl overflow-hidden border border-slate-200/60 shadow-sm bg-white transition-all duration-500 hover:shadow-2xl">
                                            {selectedPost.url?.endsWith('.mp4') || selectedPost.metadata?.type === 'reel' ? (
                                                <video 
                                                    src={selectedPost.url} 
                                                    controls 
                                                    autoPlay 
                                                    loop 
                                                    className="w-full h-auto max-h-[70vh] object-contain bg-black"
                                                />
                                            ) : (
                                                <img src={selectedPost.url} className="w-full h-auto object-contain" alt="" />
                                            )}
                                            
                                            {/* Minimal Floating Controls */}
                                            <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                                                <Button 
                                                    variant="secondary" 
                                                    size="icon" 
                                                    onClick={() => {
                                                        const link = document.createElement('a');
                                                        link.href = selectedPost.url;
                                                        link.download = `iteration-${Date.now()}.${selectedPost.url?.endsWith('.mp4') ? 'mp4' : 'png'}`;
                                                        link.click();
                                                    }}
                                                    className="h-10 w-10 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/50 shadow-xl hover:bg-white text-slate-600 hover:text-primary transition-all active:scale-90"
                                                >
                                                    <Download className="h-4 w-4" />
                                                </Button>
                                                <Button 
                                                    variant="secondary" 
                                                    size="icon" 
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(selectedPost.url);
                                                        toast.success("Link copied to clipboard");
                                                    }}
                                                    className="h-10 w-10 rounded-xl bg-white/95 backdrop-blur-md border border-slate-200/50 shadow-xl hover:bg-white text-slate-600 hover:text-primary transition-all active:scale-90"
                                                >
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Minimal Iteration Sidebar (360px) */}
                                <div className="w-[360px] bg-white flex flex-col h-full border-l border-slate-100/80">
                                    <div className="px-8 pt-10 pb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                                                <Sparkles className="h-4 w-4 text-slate-900" />
                                            </div>
                                            <div>
                                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">Surgical Engine</h3>
                                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">v4.0 Iteration</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 px-8 overflow-y-auto no-scrollbar flex flex-col gap-6">
                                        {/* Suggestions: Hyper-Compact Tiles */}
                                        {suggestions.length > 0 && (
                                            <div className="space-y-4 animate-in slide-in-from-right-4 duration-500">
                                                <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-300">Smart Refinements</p>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {suggestions.map((s, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => handleRefine(`Change text to: "${s}"`)}
                                                            className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[10px] font-bold text-slate-500 hover:text-primary hover:border-primary/30 transition-all text-left hover:bg-white active:scale-[0.98]"
                                                        >
                                                            {s}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Input Box: Sleek & Borderless Focus */}
                                        <div className="space-y-4">
                                            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-300">Detail Change</p>
                                            <div className="bg-[#fafafa] rounded-2xl p-4 transition-all focus-within:bg-white focus-within:ring-1 focus-within:ring-slate-200">
                                                <textarea 
                                                    value={refinementInput}
                                                    onChange={(e) => setRefinementInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter' && !e.shiftKey) {
                                                            e.preventDefault();
                                                            handleRefine();
                                                        }
                                                    }}
                                                    placeholder="Specify the minute detail..."
                                                    className="w-full bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-800 placeholder:text-slate-300 resize-none min-h-[100px]"
                                                />
                                                <div className="mt-4 flex items-center justify-between">
                                                    <div className="flex gap-1 overflow-x-auto no-scrollbar">
                                                        {REFINEMENTS.slice(0, 2).map(r => (
                                                            <button
                                                                key={r}
                                                                onClick={() => handleRefine(r)}
                                                                className="px-2.5 py-1 rounded-md bg-white border border-slate-200 text-[7px] font-black uppercase tracking-tighter text-slate-400 hover:text-slate-900 transition-all"
                                                            >
                                                                {r.split(' ').slice(-1)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <Button 
                                                        size="sm"
                                                        disabled={!refinementInput.trim() || isGenerating}
                                                        onClick={() => handleRefine()}
                                                        className="h-8 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-[8px] transition-all active:scale-95 flex gap-2"
                                                    >
                                                        {isGenerating ? <Loader2 className="h-3 w-3 animate-spin"/> : <Zap className="h-3 w-3"/>}
                                                        Update
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Bar: Hyper-Minimal & Solid */}
                                    <div className="p-8 border-t border-slate-100/50 bg-[#fafafa]/50">
                                        <div className="flex gap-3">
                                            <Button 
                                                variant="outline"
                                                onClick={() => setViewMode('create')}
                                                className="flex-1 h-10 rounded-xl bg-white border-slate-200 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 hover:border-slate-300 transition-all"
                                            >
                                                Back to Create
                                            </Button>
                                            <Button 
                                                onClick={handleSaveToTask}
                                                disabled={isApplying}
                                                className="flex-1 h-10 rounded-xl bg-primary text-white text-[9px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95 gap-2"
                                            >
                                                {isApplying ? <Loader2 className="h-3 w-3 animate-spin"/> : <Save className="h-3 w-3"/>}
                                                Deploy Result
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Progress Bar */}
                        {isGenerating && (
                            <div className="absolute top-0 inset-x-0 h-0.5 bg-slate-100 overflow-hidden z-50">
                                <div className="h-full bg-primary animate-engine-progress origin-left w-full" />
                            </div>
                        )}
                    </div>
                </div>
            </SheetContent>
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes engine-progress {
                    0% { transform: scaleX(0); opacity: 0; }
                    20% { transform: scaleX(0.4); opacity: 1; }
                    80% { transform: scaleX(0.8); opacity: 1; }
                    100% { transform: scaleX(1); opacity: 0; }
                }
                .animate-engine-progress {
                    animation: engine-progress 5s cubic-bezier(0.1, 0, 0.1, 1) infinite;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}} />
        </Sheet>
    );
}

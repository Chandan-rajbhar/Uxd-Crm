import React, { useState, useEffect, useRef } from "react"
import { TableRow, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
    Instagram, Facebook, Linkedin, Twitter, Youtube, Check, FileText, 
    Sparkles, Plus, Loader2, Info, Trash2, Eye, XCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import { projectService } from "src/firebase/projectService"
import { toast } from "sonner"
import { useParams } from "react-router-dom"

interface DigitalMarketingRowProps {
    item: any;
    onUpdateTask: (task: any) => Promise<void>;
    setIsSheetOpen: (b: boolean) => void;
    setSelectedTask: (task: any) => void;
    employees: any[];
    handleDeleteClick: (id: string) => void;
    setIsQuickPostOpen: (b: boolean) => void;
    setQuickPostWeek: (w: string) => void;
    setQuickPostTargetItem: (task: any) => void;
    setIsAIGenOpen: (b: boolean) => void;
    setAiGenTargetItem: (task: any) => void;
}

export const DigitalMarketingRow = React.memo(({
    item,
    onUpdateTask,
    setIsSheetOpen,
    setSelectedTask,
    employees = [],
    handleDeleteClick,
    setIsQuickPostOpen,
    setQuickPostWeek,
    setQuickPostTargetItem,
    setIsAIGenOpen,
    setAiGenTargetItem
}: DigitalMarketingRowProps) => {
    const { id: projectId } = useParams();
    const [localItem, setLocalItem] = useState(item);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        setLocalItem(item);
    }, [item]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !projectId) return;

        setIsUploading(true);
        try {
            const newAttachments = [...(localItem.attachments || [])];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const downloadURL = await projectService.uploadProjectFile(projectId, file);

                newAttachments.push({
                    id: Date.now().toString() + Math.random().toString(),
                    name: file.name,
                    type: file.type,
                    url: downloadURL,
                    createdAt: new Date().toISOString(),
                    size: file.size
                });
            }

            await handleInstantCommit({ attachments: newAttachments });
            toast.success(`${files.length} file(s) uploaded`);
        } catch (error) {
            console.error(error);
            toast.error("Failed to upload file(s)");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const isLocked = localItem.status === 'Posted' || localItem.status === 'Delivered';

    const handleLocalUpdate = (updates: any) => {
        setLocalItem({ ...localItem, ...updates });
    };

    const handleCommit = () => {
        if (JSON.stringify(localItem) !== JSON.stringify(item)) {
            onUpdateTask(localItem);
        }
    };

    const handleInstantCommit = (updates: any) => {
        const next = { ...item, ...updates };
        setLocalItem(next);
        onUpdateTask(next);
    };

    return (
        <TableRow className="hover:bg-muted/30 group whitespace-nowrap bg-white border-b border-slate-100/50">
            <TableCell className="py-2.5 px-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild disabled={isLocked}>
                        <div className={cn(
                            "flex justify-center items-center min-h-8 min-w-[40px] rounded-full bg-slate-50 border border-slate-100/50 shadow-sm mx-auto group-hover:bg-white transition-all px-2",
                            isLocked ? "cursor-default opacity-70" : "cursor-pointer"
                        )}>
                            {localItem.platform ? (
                                (() => {
                                    const p = localItem.platform.toLowerCase();
                                    const iconClass = "h-4 w-4 shrink-0 transition-transform hover:scale-110";
                                    if (p === 'instagram') return <Instagram className={cn(iconClass, "text-pink-600")} />;
                                    if (p === 'facebook') return <Facebook className={cn(iconClass, "text-blue-600")} />;
                                    if (p === 'linkedin') return <Linkedin className={cn(iconClass, "text-blue-700")} />;
                                    if (p.includes('twitter') || p.includes('x')) return <Twitter className={cn(iconClass, "text-slate-800")} />;
                                    if (p === 'youtube') return <Youtube className={cn(iconClass, "text-red-600")} />;
                                    return <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 p-0.5">{localItem.platform.substring(0, 1)}</span>;
                                })()
                            ) : (
                                <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                            )}
                        </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48 bg-white border-slate-200 shadow-xl rounded-xl p-1">
                        {['Instagram', 'Facebook', 'LinkedIn', 'Twitter/X', 'YouTube', 'TikTok', 'Pinterest'].map(p => {
                            const isSelected = localItem.platform === p;
                            return (
                                <DropdownMenuItem
                                    key={p}
                                    onClick={() => handleInstantCommit({ platform: p })}
                                    className={cn(
                                        "rounded-md text-xs font-semibold py-2 cursor-pointer transition-colors flex items-center justify-between",
                                        isSelected ? "bg-slate-50 text-blue-600" : "text-slate-600 focus:bg-slate-50"
                                    )}
                                >
                                    {p}
                                    {isSelected && <Check className="h-3 w-3" />}
                                </DropdownMenuItem>
                            );
                        })}
                    </DropdownMenuContent>
                </DropdownMenu>
            </TableCell>

            <TableCell className="py-2.5 px-3">
                <Input
                    value={localItem.postLink || ""}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                        const val = e.target.value;
                        const updates: any = { postLink: val };
                        if (val && val.trim().length > 5 && localItem.status !== 'Posted' && localItem.status !== 'Delivered') {
                            updates.status = 'Posted';
                            updates.actualPostingDate = new Date().toISOString().split('T')[0];
                        }
                        handleLocalUpdate(updates);
                    }}
                    onBlur={handleCommit}
                    className="bg-transparent border border-transparent hover:border-slate-200 focus:border-slate-300 focus:bg-white h-7 shadow-none text-blue-600 hover:underline placeholder:text-slate-300 w-full text-xs rounded-md transition-colors px-2"
                    placeholder="Paste URL..."
                    readOnly={isLocked}
                />
            </TableCell>

            <TableCell className="py-2.5 px-3">
                <Input
                    value={localItem.task || ""}
                    onChange={(e) => handleLocalUpdate({ task: e.target.value })}
                    onBlur={handleCommit}
                    className={cn(
                        "bg-transparent border border-transparent font-bold h-7 shadow-none text-slate-800 focus:ring-0 w-full text-sm rounded-md transition-colors px-2",
                        !isLocked && "hover:border-slate-200 focus:border-slate-300 focus:bg-white",
                        isLocked && "opacity-70 cursor-default"
                    )}
                    placeholder="Campaign or post title..."
                    readOnly={isLocked}
                />
            </TableCell>

            <TableCell className="py-2.5 px-3">
                <Select
                    value={localItem.contentType || undefined}
                    onValueChange={(value) => handleInstantCommit({ contentType: value })}
                >
                    <SelectTrigger className={cn(
                        "bg-slate-50 border border-slate-100 text-xs font-bold focus:ring-0 uppercase tracking-widest px-3 py-1 rounded-full shadow-none outline-none w-full h-7 text-center transition-colors [&>span]:mx-auto [&>svg]:hidden",
                        localItem.contentType ? "text-slate-700" : "text-slate-400 italic font-medium lowercase",
                        "cursor-pointer hover:border-slate-200"
                    )}>
                        <SelectValue placeholder="type" />
                    </SelectTrigger>
                    <SelectContent>
                        {['Post', 'Reel', 'Story', 'Carousel', 'Video', 'Blog', 'Ad', 'Graphic'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                </Select>
            </TableCell>

            <TableCell className="py-2.5 px-3">
                <Input
                    type="date"
                    value={localItem.date || ""}
                    onChange={(e) => handleInstantCommit({ date: e.target.value })}
                    className={cn(
                        "bg-transparent border border-transparent font-medium h-7 shadow-none text-xs w-full text-center text-slate-600 rounded-md transition-colors",
                        !isLocked ? "cursor-pointer hover:border-slate-200 focus:border-slate-300 focus:bg-white" : "cursor-default opacity-70"
                    )}
                    readOnly={isLocked}
                />
            </TableCell>

            <TableCell className="py-2.5 px-3">
                <Input
                    type="date"
                    value={localItem.actualPostingDate || ""}
                    onChange={(e) => handleInstantCommit({ actualPostingDate: e.target.value })}
                    className={cn(
                        "bg-transparent border border-transparent font-medium h-7 shadow-none text-xs w-full text-center text-slate-600 rounded-md transition-colors",
                        !isLocked ? "cursor-pointer hover:border-slate-200 focus:border-slate-300 focus:bg-white" : "cursor-default opacity-70"
                    )}
                    readOnly={isLocked}
                />
            </TableCell>

            <TableCell className="py-2.5 px-3 text-center">
                <Select
                    value={localItem.status || "Pending"}
                    onValueChange={(value) => handleInstantCommit({ status: value })}
                >
                    <SelectTrigger className={cn(
                        "border-0 text-[10px] font-black uppercase tracking-widest focus:ring-0 cursor-pointer px-3 py-1.5 rounded-full shadow-none outline-none w-full text-center h-7 transition-colors [&>span]:mx-auto [&>svg]:hidden",
                        localItem.status === 'Posted' ? 'text-emerald-700 bg-emerald-100 hover:bg-emerald-200' :
                            localItem.status === 'Scheduled' ? 'text-blue-700 bg-blue-100 hover:bg-blue-200' :
                                localItem.status === 'Drafting' ? 'text-indigo-700 bg-indigo-100 hover:bg-indigo-200' :
                                    localItem.status === 'Review' ? 'text-amber-700 bg-amber-100 hover:bg-amber-200' : 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                    )}>
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        {['Pending', 'Idea', 'Drafting', 'Review', 'Scheduled', 'Posted', 'Delivered'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                </Select>
            </TableCell>

            <TableCell className="py-2.5 px-3">
                <Select
                    value={Array.isArray(localItem.assignedTo) && localItem.assignedTo.length > 0
                        ? (typeof localItem.assignedTo[0] === 'string' ? localItem.assignedTo[0] : localItem.assignedTo[0].name)
                        : (localItem.assignedTo?.name || (typeof localItem.assignedTo === 'string' ? localItem.assignedTo : "") || undefined)}
                    onValueChange={(value) => {
                        const employee = employees.find((e: any) => e.name === value)
                        handleInstantCommit({ assignedTo: [{ name: value, avatar: employee?.avatar || "" }] })
                    }}
                >
                    <SelectTrigger className={cn(
                        "bg-transparent border-0 hover:bg-slate-50 focus:ring-0 cursor-pointer px-2 rounded-md shadow-none outline-none w-full h-7 text-xs font-semibold",
                        (!localItem.assignedTo || (Array.isArray(localItem.assignedTo) && localItem.assignedTo.length === 0)) ? "text-slate-400 font-medium italic" : "text-slate-700"
                    )}>
                        <SelectValue placeholder="Assignee..." />
                    </SelectTrigger>
                    <SelectContent>
                        {employees.filter((e: any) => {
                            const dept = (e.department || "").toLowerCase();
                            const team = (e.team || "").toLowerCase();
                            return dept.includes('design') || team.includes('design') ||
                                ((dept.includes('market') || team.includes('market')) && !dept.includes('email') && !team.includes('email'));
                        }).map((e: any) => (
                            <SelectItem key={e.id || e.name} value={e.name}>{e.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </TableCell>

            <TableCell className="py-2.5 px-3 text-center">
                <Select
                    value={localItem.approvalStatus || "Pending"}
                    onValueChange={(value) => handleInstantCommit({ approvalStatus: value })}
                >
                    <SelectTrigger className={cn(
                        "border-0 text-[10px] font-black uppercase tracking-widest hover:opacity-80 focus:ring-0 cursor-pointer px-3 py-1.5 rounded-full shadow-none outline-none w-full text-center h-7 transition-colors [&>span]:mx-auto [&>svg]:hidden",
                        localItem.approvalStatus === 'Approved' ? 'text-white bg-emerald-600 hover:bg-emerald-700' :
                            localItem.approvalStatus === 'Rejected' ? 'text-white bg-red-600 hover:bg-red-700' : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'
                    )}>
                        <SelectValue placeholder="Pending" />
                    </SelectTrigger>
                    <SelectContent>
                        {['Pending', 'Approved', 'Rejected'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                </Select>
            </TableCell>

            <TableCell className="py-2.5 px-3 text-center">
                <Select
                    value={localItem.designStatus || "Pending"}
                    onValueChange={(value) => handleInstantCommit({ designStatus: value })}
                >
                    <SelectTrigger className={cn(
                        "border-0 text-[10px] font-black uppercase tracking-widest focus:ring-0 cursor-pointer px-3 py-1.5 rounded-full shadow-none outline-none w-full text-center h-7 transition-colors [&>span]:mx-auto [&>svg]:hidden",
                        localItem.designStatus === 'Completed' ? 'text-emerald-700 bg-emerald-50 border border-emerald-100' :
                            localItem.designStatus === 'In Progress' ? 'text-blue-700 bg-blue-50 border border-blue-100' : 'text-slate-500 bg-transparent border border-slate-200 hover:bg-slate-50'
                    )}>
                        <SelectValue placeholder="Pending" />
                    </SelectTrigger>
                    <SelectContent>
                        {['Pending', 'In Progress', 'Completed', 'Not Required'].map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                </Select>
            </TableCell>

            <TableCell className="py-2.5 px-3">
                <div className="flex items-center justify-center gap-1.5 flex-wrap min-w-[100px]">
                    {localItem.attachments?.map((file: any) => (
                        <div
                            key={file.id}
                            className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-white hover:border-primary/30 transition-all group/file relative overflow-hidden"
                            title={file.name}
                        >
                            {file.type?.includes('image') ? (
                                <img src={file.url} alt="" className="h-full w-full object-cover rounded-lg" />
                            ) : (
                                <FileText className="h-4 w-4 text-slate-400" />
                            )}
                            <div className="absolute inset-0 bg-black/60 rounded-lg opacity-0 group-hover/file:opacity-100 flex items-center justify-center gap-1.5 transition-all duration-200">
                                <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1 hover:bg-white/20 rounded-md transition-colors"
                                >
                                    <Eye className="h-3 w-3 text-white" />
                                </a>
                                <button
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        const updatedAttachments = localItem.attachments.filter((a: any) => a.id !== file.id);
                                        handleInstantCommit({ attachments: updatedAttachments });
                                        toast.success("Attachment removed");
                                    }}
                                    className="p-1 hover:bg-rose-500 rounded-md transition-colors"
                                >
                                    <XCircle className="h-3 w-3 text-white" />
                                </button>
                            </div>
                        </div>
                    ))}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                        multiple
                    />
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                            setAiGenTargetItem(localItem);
                            setIsAIGenOpen(true);
                        }}
                        className="h-8 w-8 rounded-lg bg-indigo-50 border-indigo-100/50 hover:bg-indigo-600 hover:text-white text-indigo-600 transition-all shadow-sm shadow-indigo-100"
                        title="Generate Idea with AI"
                    >
                        <Sparkles className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        disabled={isUploading || isLocked}
                        onClick={() => {
                            const type = (localItem.contentType || "").toLowerCase();
                            if (type === 'blog' || type.includes('email')) {
                                fileInputRef.current?.click();
                            } else {
                                setQuickPostWeek(localItem.week || 'Week 1');
                                setQuickPostTargetItem(localItem);
                                setIsQuickPostOpen(true);
                            }
                        }}
                        className={cn(
                            "h-8 w-8 rounded-lg border-dashed border-slate-300 hover:border-primary hover:bg-primary/5 text-slate-400 hover:text-primary transition-all flex items-center justify-center relative overflow-hidden",
                            isLocked && "opacity-50 cursor-not-allowed"
                        )}
                        title={(() => {
                            const type = (localItem.contentType || "").toLowerCase();
                            const prefix = isLocked ? "[LOCKED] " : "";
                            return prefix + ((type === 'blog' || type.includes('email')) ? "Upload File Directly" : "Quick Post to Multiple Platforms");
                        })()}
                    >
                        {isUploading ? (
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                        ) : (
                            <Plus className="h-3.5 w-3.5" />
                        )}
                        {isUploading && (
                            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary/20">
                                <div className="h-full bg-primary animate-progress-indeterminate" />
                            </div>
                        )}
                    </Button>
                </div>
            </TableCell>

            <TableCell className="py-2.5 px-3">
                <Input
                    value={localItem.remarks || ""}
                    onChange={(e) => handleLocalUpdate({ remarks: e.target.value })}
                    onBlur={handleCommit}
                    className="bg-transparent border border-transparent hover:border-slate-200 focus:border-slate-300 focus:bg-white h-7 shadow-none text-xs w-full text-slate-500 rounded-md transition-colors px-2"
                    placeholder="Optional remarks..."
                />
            </TableCell>
            <TableCell className="py-2.5 px-3 text-center">
                {localItem.delivered ? (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-2 py-0 h-5 text-[10px] items-center gap-1 font-bold">
                        <Check className="h-3 w-3" /> YES
                    </Badge>
                ) : (
                    <span className="text-[10px] text-slate-300">-</span>
                )}
            </TableCell>
            <TableCell className="py-2.5 px-3 w-20 text-center">
                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                            setSelectedTask(item);
                            setIsSheetOpen(true);
                        }}
                        className="h-7 w-7 text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors rounded-md"
                        title="View Details & Attachments"
                    >
                        <Info className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(item.id)}
                        className="h-7 w-7 text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors rounded-md"
                        title="Quick Remove"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    )
});

DigitalMarketingRow.displayName = 'DigitalMarketingRow';

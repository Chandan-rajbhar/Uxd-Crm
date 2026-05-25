import React, { useState } from "react"
import { TableRow, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
    Flame, Zap, CheckCircle, XCircle, Plus, MessageSquare, Paperclip, 
    ThumbsUp, ThumbsDown, HelpCircle, Eye, EyeOff, UserPlus, Trash2, Check
} from "lucide-react"
import { format, parseISO, isValid } from "date-fns"
import { cn } from "@/lib/utils"
import { useAuth } from "src/contexts/AuthContext"
import { toast } from "sonner"

interface TaskRowProps {
    item: any;
    handleStatusChange: (id: string, status: string) => void;
    handlePriorityToggle: (id: string) => void;
    handleFeatureToggle: (id: string) => void;
    handleDeleteClick: (id: string) => void;
    setIsSheetOpen: (b: boolean) => void;
    setSelectedTask: (task: any) => void;
    onClientAction: (task: any, action: 'approve' | 'reject' | 'doubt' | 'view-reject' | 'view-doubt') => void;
    currentEmployee: any;
    onUpdateTask: (task: any) => Promise<void>;
    handleTagClick: (task: any) => void;
    handleHideToggle: (id: string) => void;
    onAddSubtaskClick: () => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
}

export const TaskRow = React.memo(({
    item,
    handleStatusChange,
    handlePriorityToggle,
    handleFeatureToggle,
    handleDeleteClick,
    setIsSheetOpen,
    setSelectedTask,
    onClientAction,
    currentEmployee,
    onUpdateTask,
    handleTagClick,
    handleHideToggle,
    onAddSubtaskClick,
    isExpanded,
    onToggleExpand
}: TaskRowProps) => {
    const { isAdmin, isEmployee, isClient } = useAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [editedTask, setEditedTask] = useState(item.task);

    const hasSubtasks = item.subtasks && item.subtasks.length > 0;

    const handleSave = async () => {
        if (editedTask.trim() === "") {
            setEditedTask(item.task);
            setIsEditing(false);
            return;
        }

        if (editedTask !== item.task) {
            await onUpdateTask({ ...item, task: editedTask.trim() });
        }
        setIsEditing(false);
    };

    return (
        <TableRow
            className="hover:bg-muted/50 transition-all group cursor-pointer"
            onClick={() => {
                setSelectedTask(item)
                setIsSheetOpen(true)
            }}
        >
            <TableCell className="py-3 w-[120px] text-center" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-center gap-2">
                    {/* Priority Toggle */}
                    <div onClick={() => isAdmin && handlePriorityToggle(item.id)} className="cursor-pointer" title={item.priority === 'high' ? "High Priority" : "Mark High Priority"}>
                        {item.priority === 'high' ? (
                            <Flame className="h-4 w-4 text-orange-600 fill-orange-600 animate-pulse" />
                        ) : (
                            isAdmin && (
                                <Flame className="h-4 w-4 text-slate-200 hover:text-orange-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )
                        )}
                    </div>
                    {/* New Feature Toggle */}
                    <div onClick={() => (isAdmin || isEmployee) && handleFeatureToggle(item.id)} className="cursor-pointer" title={item.isNewFeature ? "New Feature" : "Mark as New Feature"}>
                        {item.isNewFeature ? (
                            <Zap className="h-4 w-4 text-blue-600 fill-blue-600 animate-bounce" />
                        ) : (
                            (isAdmin || isEmployee) && (
                                <Zap className="h-4 w-4 text-slate-200 hover:text-blue-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )
                        )}
                    </div>
                </div>
            </TableCell>
            <TableCell className="py-3">
                <div
                    onClick={(e) => {
                        e.stopPropagation();
                        if (isClient) return;

                        const assignees = Array.isArray(item.assignedTo) ? item.assignedTo : (item.assignedTo ? [item.assignedTo] : []);
                        const isAssigned = assignees.some((a: any) => (typeof a === 'string' ? a : a.name) === currentEmployee?.name);

                        if (!isAdmin && !isAssigned) {
                            toast.error("Only admins or assigned users can update status");
                            return;
                        }

                        if (item.status === 'Delivered') return;

                        let nextStatus = 'Pending';
                        if (item.status === 'Pending') nextStatus = 'In Progress';
                        else if (item.status === 'In Progress') nextStatus = 'Completed';
                        else if (item.status === 'Completed') nextStatus = 'Pending';

                        handleStatusChange(item.id, nextStatus);
                    }}
                    className={isClient ? "cursor-default" : "cursor-pointer"}
                >
                    <Badge variant={
                        item.status === 'Completed' ? 'default' :
                            item.status === 'In Progress' ? 'secondary' :
                                item.status === 'Delivered' ? 'default' :
                                    item.status === 'Pending' ? 'destructive' : 'outline'
                    }
                        className={cn("font-medium",
                            (item.status === 'Completed' || (isClient && item.status === 'Delivered')) && "bg-emerald-600 hover:bg-emerald-700 border-transparent text-white",
                            item.status === 'In Progress' && "bg-yellow-500 hover:bg-yellow-600 text-white border-transparent",
                            (item.status === 'Delivered' && !isClient) && "bg-purple-600 hover:bg-purple-700 text-white border-transparent",
                            item.status === 'Pending' && "bg-red-600 hover:bg-red-700 text-white border-transparent"
                        )}
                    >
                        {isClient && item.status === 'Delivered' ? 'Completed' : item.status}
                    </Badge>
                </div>
            </TableCell>
            {!isClient && (
                <TableCell className="py-3 w-[80px] text-center">
                    <div className="flex items-center justify-center">
                        {item.testStatus === 'passed' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : item.testStatus === 'failed' ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                            <div className="h-1.5 w-1.5 rounded-full bg-slate-300" title="Not Tested" />
                        )}
                    </div>
                </TableCell>
            )}
            <TableCell className="py-3">
                <div className={cn("text-sm transition-colors flex flex-col gap-1 items-start w-full", (item.status === 'Completed' || item.status === 'Delivered') && "text-muted-foreground opacity-60")}>
                    <div className="flex items-center gap-2 flex-wrap w-full">
                        {hasSubtasks && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 rounded-sm text-slate-400 hover:text-primary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleExpand();
                                }}
                            >
                                <Plus className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-45")} />
                            </Button>
                        )}
                        {isEditing ? (
                            <div className="flex-1 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
                                <Input
                                    value={editedTask}
                                    onChange={(e) => setEditedTask(e.target.value)}
                                    onBlur={handleSave}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSave();
                                        if (e.key === 'Escape') {
                                            setEditedTask(item.task);
                                            setIsEditing(false);
                                        }
                                    }}
                                    autoFocus
                                    className="h-8 py-1 text-sm font-semibold border-primary/50 focus-visible:ring-primary/20 bg-white"
                                />
                            </div>
                        ) : (
                            <span
                                className={cn(
                                    "font-semibold text-foreground break-words whitespace-pre-wrap flex-1 transition-colors",
                                    item.status === 'Delivered' ? "cursor-default opacity-70" : "hover:text-primary cursor-text"
                                )}
                                title={item.status === 'Delivered' ? "Delivered tasks cannot be edited" : "Click to edit"}
                                onClick={(e) => {
                                    if (isClient || item.status === 'Delivered') return;
                                    e.stopPropagation();
                                    setIsEditing(true);
                                }}
                            >
                                {item.task}
                            </span>
                        )}
                        <div className="flex items-center gap-2">
                            {!isClient && !isEditing && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-primary/10 hover:text-primary"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onAddSubtaskClick();
                                    }}
                                    title="Add Subtask"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </Button>
                            )}
                            {item.priority === 'high' && (
                                <Badge className="bg-orange-600 hover:bg-orange-700 text-[10px] py-0 px-2 h-5 font-bold uppercase transition-all shadow-sm">
                                    High Priority
                                </Badge>
                            )}
                            {item.isNewFeature && (
                                <Badge className="bg-blue-600 hover:bg-blue-700 text-[10px] py-0 px-2 h-5 font-bold uppercase transition-all shadow-sm">
                                    New Feature
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
            </TableCell>
            <TableCell className="py-3 text-right">
                <div className="flex items-center justify-end gap-2 text-sm whitespace-nowrap">
                    <span className="text-foreground font-medium">
                        {(() => {
                            if (!item.date) return "-";
                            try {
                                let date = parseISO(item.date);
                                if (isValid(date)) return format(date, 'MMM d, yyyy');
                                date = new Date(item.date);
                                if (isValid(date)) return format(date, 'MMM d, yyyy');
                                return item.date;
                            } catch (e) {
                                return item.date;
                            }
                        })()}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight tabular-nums border-l border-slate-200 pl-2">
                        {(() => {
                            const tsMatch = item.id.match(/(?:task|auto)-(\d+)/);
                            if (tsMatch && tsMatch[1]) {
                                const ts = parseInt(tsMatch[1]);
                                if (!isNaN(ts)) return format(new Date(ts), 'h:mm a');
                            }
                            return "";
                        })()}
                    </span>
                </div>
            </TableCell>
            {!isClient && (
                <TableCell className="py-3">
                    <div className="flex items-center w-full">
                        {(() => {
                            const assignees = Array.isArray(item.assignedTo)
                                ? item.assignedTo
                                : (item.assignedTo ? [item.assignedTo] : []);

                            const realAssignees = assignees.filter((a: any) => a.name && a.name !== 'Unassigned');

                            if (realAssignees.length === 0) {
                                return <span className="text-xs font-medium text-muted-foreground">Unassigned</span>;
                            }

                            const names = realAssignees.map((a: any) => a.name.split(' ')[0]).join(", ");
                            return (
                                <span className="text-xs font-medium text-foreground truncate block w-full" title={realAssignees.map((a: any) => a.name).join(", ")}>
                                    {names}
                                </span>
                            );
                        })()}
                    </div>
                </TableCell>
            )}
            <TableCell className="text-center py-3">
                <div className="flex items-center justify-center gap-2">
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold ${item.notes?.length > 0 ? 'text-blue-600 bg-blue-50' : 'text-muted-foreground'} px-2 py-0.5 rounded-full transition-colors`}>
                        <MessageSquare className="h-3 w-3" />
                        {item.notes?.length || 0}
                    </div>
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold ${item.attachments?.length > 0 ? 'text-amber-600 bg-amber-50' : 'text-muted-foreground'} px-2 py-0.5 rounded-full transition-colors`}>
                        <Paperclip className="h-3 w-3" />
                        {item.attachments?.length || 0}
                    </div>
                </div>
            </TableCell>
            <TableCell className="text-right pr-6 py-3">
                <div className="flex items-center justify-end gap-3">
                    {(() => {
                        const lastNote = item.notes && item.notes.length > 0 ? item.notes[item.notes.length - 1] : null;
                        const isLastActionClient = lastNote?.senderType === 'client';

                        const isApproved = (item.status === 'Completed' || item.status === 'Delivered') &&
                            isLastActionClient && lastNote?.text?.startsWith('CLIENT APPROVAL');

                        const isRejected = isLastActionClient && lastNote?.text?.startsWith('REJECTION REASON');
                        const isDoubt = isLastActionClient && lastNote?.text?.startsWith('CLIENT DOUBT');

                        const renderBadge = (type: 'approved' | 'rejected' | 'doubt') => {
                            const configs = {
                                approved: { icon: CheckCircle, text: 'Approved', bg: 'bg-emerald-50', textCol: 'text-emerald-600', border: 'border-emerald-100' },
                                rejected: { icon: ThumbsDown, text: 'Rejected', bg: 'bg-red-50', textCol: 'text-red-600', border: 'border-red-100' },
                                doubt: { icon: HelpCircle, text: 'Feedback Sent', bg: 'bg-amber-50', textCol: 'text-amber-600', border: 'border-amber-100' }
                            };
                            const config = configs[type];
                            const Icon = config.icon;

                            const canViewReason = (isClient || isAdmin) && type !== 'approved';

                            if (canViewReason) {
                                return (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onClientAction(item, type === 'rejected' ? 'view-reject' : 'view-doubt');
                                        }}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors animate-in fade-in zoom-in-95 group/badge border",
                                            config.bg, config.textCol, config.border, "hover:bg-muted/50"
                                        )}
                                    >
                                        <Icon className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">{config.text}</span>
                                        <Eye className="h-3 w-3 opacity-0 group-hover/badge:opacity-100 ml-1 transition-opacity" />
                                    </button>
                                );
                            }

                            return (
                                <div className={cn(
                                    "flex items-center gap-1.5 px-3 py-1 rounded-full border animate-in fade-in zoom-in-95",
                                    config.bg, config.textCol, config.border
                                )}>
                                    <Icon className="h-3.5 w-3.5" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">{config.text}</span>
                                </div>
                            );
                        };

                        if (isClient) {
                            if (isApproved) return renderBadge('approved');
                            if (isRejected) return renderBadge('rejected');
                            if (isDoubt) return renderBadge('doubt');

                            return (
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-emerald-600 border-emerald-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 transition-all gap-1.5 rounded-lg whitespace-nowrap"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onClientAction(item, 'approve');
                                        }}
                                    >
                                        <ThumbsUp className="h-3.5 w-3.5" />
                                        Approve
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-all gap-1.5 rounded-lg whitespace-nowrap"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onClientAction(item, 'reject');
                                        }}
                                    >
                                        <ThumbsDown className="h-3.5 w-3.5" />
                                        Reject
                                    </Button>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-8 px-3 text-[10px] font-bold uppercase tracking-wider text-amber-600 border-amber-100 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 transition-all gap-1.5 rounded-lg whitespace-nowrap"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onClientAction(item, 'doubt');
                                        }}
                                    >
                                        <HelpCircle className="h-3.5 w-3.5" />
                                        Ask
                                    </Button>
                                </div>
                            );
                        }

                        return (
                            <div className="flex items-center gap-2">
                                {isApproved && renderBadge('approved')}
                                {isRejected && renderBadge('rejected')}
                                {isDoubt && renderBadge('doubt')}

                                <div className="flex items-center gap-1 ml-1 border-l pl-2 border-slate-100">
                                    {isAdmin && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={cn(
                                                "h-8 w-8 transition-all rounded-full opacity-0 group-hover:opacity-100",
                                                item.isHiddenFromClient ? "text-red-500 hover:bg-red-50" : "text-muted-foreground hover:text-blue-500 hover:bg-blue-50"
                                            )}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleHideToggle(item.id);
                                            }}
                                            title={item.isHiddenFromClient ? "Hidden from Client" : "Visible to Client"}
                                        >
                                            {item.isHiddenFromClient ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all rounded-full"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleTagClick(item);
                                        }}
                                        title="Quick Tag People"
                                    >
                                        <UserPlus className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all rounded-full"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteClick(item.id);
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </TableCell>
            <TableCell className="py-3 text-center">
                {item.delivered ? (
                    <div className="flex justify-center">
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none px-2 py-0 h-5 text-[10px] items-center gap-1 font-bold">
                            <Check className="h-3 w-3" /> YES
                        </Badge>
                    </div>
                ) : (
                    <span className="text-[10px] text-slate-300">-</span>
                )}
            </TableCell>
        </TableRow>
    );
});

TaskRow.displayName = 'TaskRow';

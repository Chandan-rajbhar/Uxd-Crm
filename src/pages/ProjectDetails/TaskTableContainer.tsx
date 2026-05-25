import React from "react"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { TaskRow } from "./TaskRow"

interface TaskTableContainerProps {
    items: any[];
    isClient: boolean;
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
    onAddSubtaskClick: (id: string) => void;
    expandedTasks: Set<string>;
    toggleExpand: (id: string) => void;
    activeSubtaskParentId: string | null;
    newSubtaskName: string;
    setNewSubtaskName: (s: string) => void;
    onAddSubtask: (parentId: string) => void;
    setActiveSubtaskParentId: (id: string | null) => void;
}

export function TaskTableContainer({
    items, isClient, handleStatusChange, handlePriorityToggle, handleFeatureToggle, 
    handleDeleteClick, setIsSheetOpen, setSelectedTask, onClientAction, 
    currentEmployee, onUpdateTask, handleTagClick, handleHideToggle,
    onAddSubtaskClick, expandedTasks, toggleExpand
}: TaskTableContainerProps) {
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <Table>
                <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-b border-slate-100">
                        <TableHead className="w-[120px] text-center text-[10px] font-black uppercase tracking-widest text-slate-400">System</TableHead>
                        <TableHead className="w-[150px] text-[10px] font-black uppercase tracking-widest text-slate-400">Status</TableHead>
                        {!isClient && <TableHead className="w-[80px] text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Tests</TableHead>}
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description</TableHead>
                        <TableHead className="w-[180px] text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Last Activity</TableHead>
                        {!isClient && <TableHead className="w-[120px] text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned</TableHead>}
                        <TableHead className="w-[120px] text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Files</TableHead>
                        <TableHead className="text-right pr-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Approval</TableHead>
                        <TableHead className="w-[80px] text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Delivered</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={isClient ? 7 : 9} className="h-32 text-center text-slate-400 font-medium">
                                No tasks found matching your filters.
                            </TableCell>
                        </TableRow>
                    ) : (
                        items.map((item) => (
                            <React.Fragment key={item.id}>
                                <TaskRow
                                    item={item}
                                    handleStatusChange={handleStatusChange}
                                    handlePriorityToggle={handlePriorityToggle}
                                    handleFeatureToggle={handleFeatureToggle}
                                    handleDeleteClick={handleDeleteClick}
                                    setIsSheetOpen={setIsSheetOpen}
                                    setSelectedTask={setSelectedTask}
                                    onClientAction={onClientAction}
                                    currentEmployee={currentEmployee}
                                    onUpdateTask={onUpdateTask}
                                    handleTagClick={handleTagClick}
                                    handleHideToggle={handleHideToggle}
                                    onAddSubtaskClick={() => onAddSubtaskClick(item.id)}
                                    isExpanded={expandedTasks.has(item.id)}
                                    onToggleExpand={() => toggleExpand(item.id)}
                                />
                                {expandedTasks.has(item.id) && item.subtasks?.map((st: any) => (
                                    <TableRow key={st.id} className="bg-slate-50/30 hover:bg-slate-50/50 border-none group cursor-pointer" onClick={() => { setSelectedTask(item); setIsSheetOpen(true); }}>
                                        <TableCell className="py-2"></TableCell>
                                        <TableCell className="py-2">
                                            <div className="flex items-center gap-2" onClick={(e) => {
                                                e.stopPropagation();
                                                const updated = item.subtasks.map((s: any) => s.id === st.id ? { ...s, completed: !s.completed } : s);
                                                onUpdateTask({ ...item, subtasks: updated });
                                            }}>
                                                <Badge variant={st.completed ? "default" : "outline"} className={cn("text-[9px] h-4", st.completed ? "bg-emerald-500 hover:bg-emerald-600" : "text-slate-400")}>
                                                    {st.completed ? "DONE" : "TODO"}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        {!isClient && <TableCell className="py-2"></TableCell>}
                                        <TableCell className="py-2">
                                            <div className="flex items-center gap-2 pl-4">
                                                <div className="h-4 w-[1px] bg-slate-200" />
                                                <span className={cn("text-xs font-semibold", st.completed ? "text-slate-400 line-through decoration-slate-300" : "text-slate-600")}>
                                                    {st.task}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell colSpan={isClient ? 3 : 5}></TableCell>
                                    </TableRow>
                                ))}
                            </React.Fragment>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}

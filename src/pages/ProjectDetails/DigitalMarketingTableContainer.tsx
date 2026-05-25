import React from "react"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table"
import { DigitalMarketingRow } from "./DigitalMarketingRow"

interface DigitalMarketingTableContainerProps {
    items: any[];
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

export function DigitalMarketingTableContainer({
    items, onUpdateTask, setIsSheetOpen, setSelectedTask, employees, 
    handleDeleteClick, setIsQuickPostOpen, setQuickPostWeek, 
    setQuickPostTargetItem, setIsAIGenOpen, setAiGenTargetItem
}: DigitalMarketingTableContainerProps) {
    const groupedItems = React.useMemo(() => {
        const groups: { [key: string]: any[] } = {};
        items.forEach(item => {
            const key = item.week || 'No Week';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    }, [items]);

    const sortedWeeks = React.useMemo(() => {
        return Object.keys(groupedItems).sort((a, b) => {
            const getNum = (s: string) => parseInt(s.replace(/^\D+/g, '')) || 0;
            return getNum(b) - getNum(a);
        });
    }, [groupedItems]);

    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden overflow-x-auto">
            <Table>
                <TableHeader className="bg-slate-50/80 sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent border-b border-slate-100">
                        <TableHead className="w-[60px] text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Source</TableHead>
                        <TableHead className="min-w-[180px] text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Post Link</TableHead>
                        <TableHead className="min-w-[200px] text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Campaign/Topic</TableHead>
                        <TableHead className="w-[110px] text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Format</TableHead>
                        <TableHead className="w-[130px] text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Scheduled</TableHead>
                        <TableHead className="w-[130px] text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Actual</TableHead>
                        <TableHead className="w-[120px] text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Process</TableHead>
                        <TableHead className="min-w-[140px] text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Expert</TableHead>
                        <TableHead className="w-[120px] text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Client</TableHead>
                        <TableHead className="w-[110px] text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Design</TableHead>
                        <TableHead className="w-[140px] text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Creative</TableHead>
                        <TableHead className="min-w-[160px] text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Internal Notes</TableHead>
                        <TableHead className="w-[80px] text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-4">Live</TableHead>
                        <TableHead className="w-[100px] text-right text-[10px] font-black uppercase tracking-widest text-slate-400 py-4 pr-6">Management</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {sortedWeeks.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={14} className="h-48 text-center text-slate-400 font-medium">
                                No marketing campaigns found.
                            </TableCell>
                        </TableRow>
                    ) : (
                        sortedWeeks.map(week => (
                            <React.Fragment key={week}>
                                <TableRow className="bg-slate-50 border-y border-slate-100/50">
                                    <TableCell colSpan={14} className="py-2.5 px-6">
                                        <div className="flex items-center gap-3">
                                            <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                                            <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                                                {week} Campaigns
                                            </span>
                                            <div className="h-[1px] flex-1 bg-gradient-to-r from-slate-200 to-transparent ml-4" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                                {groupedItems[week].map(item => (
                                    <DigitalMarketingRow
                                        key={item.id}
                                        item={item}
                                        onUpdateTask={onUpdateTask}
                                        setIsSheetOpen={setIsSheetOpen}
                                        setSelectedTask={setSelectedTask}
                                        employees={employees}
                                        handleDeleteClick={handleDeleteClick}
                                        setIsQuickPostOpen={setIsQuickPostOpen}
                                        setQuickPostWeek={setQuickPostWeek}
                                        setQuickPostTargetItem={setQuickPostTargetItem}
                                        setIsAIGenOpen={setIsAIGenOpen}
                                        setAiGenTargetItem={setAiGenTargetItem}
                                    />
                                ))}
                            </React.Fragment>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}

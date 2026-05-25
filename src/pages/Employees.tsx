import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "src/components/ui/table"
import { Badge } from "src/components/ui/badge"
import { Button } from "src/components/ui/button"
import { Input } from "src/components/ui/input"
import { ListFilter, Users, Loader2, MoreHorizontal, Eye, Pencil, Trash, UserPlus, Check, ChevronsUpDown, Plus, LayoutGrid, List, EyeOff, Crown, FileText, FileCheck, Sparkles } from "lucide-react"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "src/components/ui/empty"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "src/components/ui/tooltip"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "src/components/ui/select"
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
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import {
    Avatar,
    AvatarFallback,
} from "@/components/ui/avatar"
import { Switch } from "src/components/ui/switch"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "src/components/ui/popover"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "src/components/ui/command"
import { cn } from "@/lib/utils"

import { AddEmployeeSheet } from "src/components/AddEmployeeSheet"
import { ImportEmployeesDialog } from "src/components/ImportEmployeesDialog"
import { EmployeeDetailsSheet } from "src/components/EmployeeDetailsSheet"
import { EmployeePromotionSheet } from "src/components/EmployeePromotionSheet"
import { TeamPreviewSheet } from "src/components/TeamPreviewSheet"
import { AssignTaskSheet } from "src/components/AssignTaskSheet"
import { RelievingLetterReviewDialog } from "src/components/RelievingLetterReviewDialog"
import { InternshipCompletionReviewDialog } from "src/components/InternshipCompletionReviewDialog"
import { AmendmentLetterReviewDialog } from "src/components/AmendmentLetterReviewDialog"

import { useEmployees } from "src/hooks/useEmployees"
import { useProjects } from "src/hooks/useProjects"
import { employeeService } from "src/firebase/employeeService"
import { settingsService } from "src/firebase/settingsService"
import { useEmployeeWorkload } from "src/hooks/useEmployeeWorkload"
import { generateInternshipCompletionPDF } from "@/utils/internshipCompletionGenerator"
import { generateAmendmentLetterPDF } from "@/utils/amendmentLetterGenerator"
import { generateRelievingLetterPDF } from "@/utils/relievingLetterGenerator"
import { candidateService } from "@/firebase/candidateService"

const DEPARTMENTS = ["Design", "Engineering", "Product", "Marketing", "Digital Marketing", "Sales", "HR", "BDE"];
const COMMON_ROLES = ["Senior Designer", "Junior Designer", "Frontend Developer", "Backend Developer", "Full Stack Developer", "Flutter Developer", "Product Manager", "Project Manager", "QA Engineer", "Marketing Specialist", "Sales Representative", "HR Manager", "Operations Manager"];

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useState, useEffect, useMemo, memo } from "react"
import { useAuth } from "src/contexts/AuthContext"

// --- Sub-components ---

const TeamSection = memo(({ 
    section, 
    employeesWithProjects, 
    hiddenEmployeeIds, 
    onPreview, 
    onTeamLeadToggle, 
    onHideEmployee, 
    onPreviewTasks,
    isRestrictedTeamLead 
}: any) => {
    const teamEmployees = useMemo(() => {
        return employeesWithProjects
            .filter(section.filter)
            .filter((emp: any) => !hiddenEmployeeIds.includes(emp.id as string))
            .sort((a: any, b: any) => (a.isTeamLead === b.isTeamLead ? 0 : a.isTeamLead ? -1 : 1));
    }, [employeesWithProjects, section.filter, hiddenEmployeeIds]);

    const slots = 8;
    const emptySlots = Math.max(0, slots - teamEmployees.length);

    return (
        <div className="flex flex-col h-full rounded-sm overflow-hidden border cursor-pointer hover:border-primary/40 transition-colors" 
            onClick={() => onPreview(section.title, teamEmployees)}>
            <div className="px-2 py-2 border-b flex items-center justify-between bg-muted/20 group/header">
                <h3 className="font-bold text-sm tracking-tight">{section.title}</h3>
                <div className="flex items-center gap-2">
                    <button
                        className="opacity-0 group-hover/header:opacity-100 transition-opacity p-1 hover:bg-muted text-muted-foreground hover:text-primary rounded"
                        title="Preview Team Tasks"
                        onClick={(e) => {
                            e.stopPropagation();
                            onPreview(section.title, teamEmployees);
                        }}
                    >
                        <Eye className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-[10px] text-muted-foreground font-medium">
                        {employeesWithProjects.filter(section.filter).length}
                    </span>
                </div>
            </div>
            <div className="flex-1">
                <Table>
                    <TableBody>
                        {teamEmployees.map((emp: any) => (
                            <TableRow key={emp.id} className={`group hover:bg-muted/50 border-b border-muted h-[36px] cursor-pointer ${emp.isTeamLead ? 'bg-muted/30' : ''}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPreviewTasks(section.title, teamEmployees, emp.id);
                                }}
                            >
                                <TableCell className="font-medium py-1 px-2 align-middle border-r border-muted w-[60%] relative">
                                    <div className="flex items-center gap-1.5 min-w-0 pr-12">
                                        <span className="text-xs truncate font-semibold leading-tight">{emp.name}</span>
                                        {emp.isTeamLead && (
                                            <Crown className="h-3 w-3 text-amber-500 fill-amber-500" />
                                        )}
                                    </div>
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                    {!isRestrictedTeamLead && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onTeamLeadToggle(emp.id, !emp.isTeamLead); }}
                                            className={`p-0.5 hover:bg-muted rounded ${emp.isTeamLead ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'}`}
                                            title={emp.isTeamLead ? "Remove Team Lead" : "Make Team Lead"}
                                        >
                                            <Crown className="h-3 w-3" />
                                        </button>
                                    )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onPreviewTasks(section.title, teamEmployees, emp.id);
                                            }}
                                            className="p-0.5 hover:bg-muted text-muted-foreground hover:text-primary rounded"
                                            title="Preview Tasks"
                                        >
                                            <Eye className="h-3 w-3" />
                                        </button>
                                        {!isRestrictedTeamLead && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onHideEmployee(emp.id); }}
                                                className="p-0.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded"
                                                title="Hide Employee"
                                            >
                                                <EyeOff className="h-3 w-3" />
                                            </button>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="py-1 px-2 align-middle text-right w-[40%]">
                                    {emp.projectTasks.length > 0 ? (
                                        <TooltipProvider delayDuration={0}>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="flex flex-col gap-1 items-end cursor-default">
                                                        {emp.projectTasks.slice(0, 1).map((pt: any, i: number) => (
                                                            <span key={i} className="text-[9px] font-medium px-1.5 py-0.5 bg-muted rounded-sm truncate max-w-full text-muted-foreground block text-right">
                                                                {pt.project.name}
                                                            </span>
                                                        ))}
                                                        {emp.projectTasks.length > 1 && (
                                                            <span className="text-[8px] text-muted-foreground/60 leading-none">+{emp.projectTasks.length - 1}</span>
                                                        )}
                                                    </div>
                                                </TooltipTrigger>
                                                {emp.projectTasks.length > 1 && (
                                                    <TooltipContent side="left" className="w-[200px] p-2">
                                                        <div className="space-y-1">
                                                            <p className="text-xs font-semibold mb-1">Assigned Projects</p>
                                                            {emp.projectTasks.map((pt: any, i: number) => (
                                                                <div key={i} className="text-[10px] flex gap-2 justify-between">
                                                                    <span className="truncate">{pt.project.name}</span>
                                                                    <span className="text-muted-foreground tabular-nums shrink-0">{pt.tasks.length} task{pt.tasks.length !== 1 ? 's' : ''}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </TooltipContent>
                                                )}
                                            </Tooltip>
                                        </TooltipProvider>
                                    ) : (
                                        <div className="flex justify-end items-center h-full">
                                            <span className="relative flex h-1.5 w-1.5">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                                            </span>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {Array.from({ length: emptySlots }).map((_, i) => (
                            <TableRow key={`empty-${i}`} className="border-b border-muted h-[36px] hover:bg-transparent">
                                <TableCell className="border-r border-muted py-1 px-2"></TableCell>
                                <TableCell className="py-1 px-2"></TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
});

const EmployeeRow = memo(({ 
    employee, 
    handleRoleChange, 
    handleDepartmentChange, 
    handleTeamChange, 
    setDeleteId,
    setSelectedEmployee,
    setIsViewOpen,
    setIsEditOpen,
    availableTeams,
    searchTeam,
    setSearchTeam,
    setNewTeamName,
    setActiveEmployeeId,
    setIsAddTeamOpen,
    DEPARTMENTS,
    COMMON_ROLES,
    handleEmploymentTypeChange,
    setRelievingEmployee,
    setIsRelievingReviewOpen,
    setCompletionEmployee,
    setIsCompletionReviewOpen,
    setAmendmentEmployee,
    setIsAmendmentReviewOpen,
    setAssignEmployee,
    setIsAssignOpen,
    isRestrictedTeamLead
}: any) => {
    const handleLeaveToggle = async (checked: boolean) => {
        if (!employee.id) return;
        try {
            await employeeService.updateEmployee(employee.id, {
                isOnLeave: checked,
                leaveDate: checked ? new Date().toISOString() : null
            })
            toast.success(checked ? "Employee marked as on leave" : "Employee marked as available")
        } catch (error) {
            toast.error("Failed to update leave status")
        }
    }

    return (
        <TableRow key={employee.id || employee.email} className={cn(
            "hover:bg-muted/50 transition-all",
            employee.isOnLeave && "opacity-50 bg-muted/30"
        )}>
            <TableCell className="font-medium py-3">
                <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {employee.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
                        </AvatarFallback>
                    </Avatar>
                    {employee.name}
                </div>
            </TableCell>
            <TableCell className="py-3">
                <Select
                    value={employee.role}
                    onValueChange={(value) => handleRoleChange(employee.id!, value)}
                    disabled={isRestrictedTeamLead}
                >
                    <SelectTrigger className={cn(
                        "h-8 w-[140px] text-xs border-none bg-transparent hover:bg-muted focus:ring-0 px-2 shadow-none transition-colors",
                        isRestrictedTeamLead && "hover:bg-transparent cursor-default"
                    )}>
                        <span className="truncate">{employee.role || "Set role"}</span>
                    </SelectTrigger>
                    <SelectContent>
                        {[...new Set([...COMMON_ROLES, employee.role])].filter(Boolean).map((role) => (
                            <SelectItem key={role} value={role} className="text-xs">
                                {role}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </TableCell>
            <TableCell className="py-3">{employee.email}</TableCell>
            <TableCell className="py-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                {employee.joiningDate ? new Date(employee.joiningDate).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }) : "—"}
            </TableCell>
            <TableCell className="py-3">
                <Select
                    value={employee.department}
                    onValueChange={(value) => handleDepartmentChange(employee.id!, value)}
                    disabled={isRestrictedTeamLead}
                >
                    <SelectTrigger className={cn(
                        "h-8 w-[120px] text-xs border-none bg-transparent hover:bg-muted focus:ring-0 px-2 shadow-none transition-colors",
                        isRestrictedTeamLead && "hover:bg-transparent cursor-default"
                    )}>
                        <Badge variant="outline" className="font-normal truncate max-w-full">
                            {employee.department || "Set dept"}
                        </Badge>
                    </SelectTrigger>
                    <SelectContent>
                        {DEPARTMENTS.map((dept: string) => (
                            <SelectItem key={dept} value={dept} className="text-xs">
                                {dept}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </TableCell>
            <TableCell className="py-3">
                <Popover>
                    <PopoverTrigger asChild disabled={isRestrictedTeamLead}>
                        <Button
                            variant="ghost"
                            role="combobox"
                            className={cn(
                                "h-8 justify-between font-mono text-xs w-[140px] hover:bg-muted px-2",
                                isRestrictedTeamLead && "hover:bg-transparent cursor-default"
                            )}
                        >
                            <span className="truncate">
                                {employee.team || "Unassigned"}
                            </span>
                            {!isRestrictedTeamLead && <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />}
                        </Button>
                    </PopoverTrigger>
                    {!isRestrictedTeamLead && (
                        <PopoverContent className="w-[200px] p-0" align="start">
                            <Command>
                                <CommandInput
                                    placeholder="Search team..."
                                    value={searchTeam}
                                    onValueChange={setSearchTeam}
                                />
                                <CommandEmpty>
                                    <p className="text-sm text-muted-foreground p-2 text-center">No team found.</p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-xs h-8"
                                        onClick={() => {
                                            setNewTeamName(searchTeam)
                                            setActiveEmployeeId(employee.id!)
                                            setIsAddTeamOpen(true)
                                        }}
                                    >
                                        <Plus className="mr-2 h-3 w-3" />
                                        Add "{searchTeam}"
                                    </Button>
                                </CommandEmpty>
                                <CommandGroup className="max-h-[200px] overflow-y-auto">
                                    <CommandItem
                                        value="Unassigned"
                                        onSelect={() => handleTeamChange(employee.id!, "Unassigned")}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                !employee.team ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        Unassigned
                                    </CommandItem>
                                    {availableTeams.map((team: string) => (
                                        <CommandItem
                                            key={team}
                                            value={team}
                                            onSelect={() => handleTeamChange(employee.id!, team)}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    employee.team === team ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {team}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </Command>
                        </PopoverContent>
                    )}
                </Popover>
            </TableCell>
            <TableCell className="py-3">
                <div className="flex items-center gap-2">
                    <Switch
                        checked={employee.isOnLeave || false}
                        onCheckedChange={handleLeaveToggle}
                        disabled={isRestrictedTeamLead}
                    />
                    <span className={cn(
                        "text-xs",
                        employee.isOnLeave ? "text-destructive font-medium" : "text-muted-foreground"
                    )}>
                        {employee.isOnLeave ? "On Leave" : "Available"}
                    </span>
                </div>
            </TableCell>
            <TableCell className="py-3">
                <div className="flex items-center gap-2">
                    <Select
                        value={employee.employmentType || "Not Set"}
                        onValueChange={(value: string) => handleEmploymentTypeChange(employee.id!, value)}
                        disabled={!!employee.pendingEmploymentType || isRestrictedTeamLead}
                    >
                        <SelectTrigger className={cn(
                            "h-8 w-[165px] text-xs border-none bg-transparent hover:bg-muted focus:ring-0 px-2 shadow-none transition-colors justify-start gap-1",
                            (employee.pendingEmploymentType || isRestrictedTeamLead) && "opacity-80",
                            isRestrictedTeamLead && "hover:bg-transparent cursor-default"
                        )}>
                            <Badge variant="outline" className={cn(
                                "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border-slate-200 whitespace-nowrap",
                                employee.pendingEmploymentType ? 'bg-indigo-50 text-indigo-600 border-indigo-100 animate-pulse' :
                                employee.employmentType === 'Full Time' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                                employee.employmentType === 'Left' ? 'bg-red-50 text-red-600 border-red-100' :
                                !employee.employmentType ? 'bg-slate-50 text-slate-400 border-slate-100' :
                                'bg-amber-50 text-amber-600 border-amber-100'
                            )}>
                                {employee.pendingEmploymentType ? `Pending: ${employee.pendingEmploymentType}` : (employee.employmentType || "Not Set")}
                            </Badge>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Full Time" className="text-xs">Full Time</SelectItem>
                            <SelectItem value="Internship (Paid)" className="text-xs">Internship (Paid)</SelectItem>
                            <SelectItem value="Internship (Unpaid)" className="text-xs">Internship (Unpaid)</SelectItem>
                            <SelectItem value="Internship (Hybrid)" className="text-xs">Internship (Hybrid)</SelectItem>
                            <SelectItem value="Left" className="text-xs text-destructive font-medium">Left</SelectItem>
                        </SelectContent>
                    </Select>

                    {employee.signedAmendmentLetterUrl && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-full"
                                        onClick={() => window.open(employee.signedAmendmentLetterUrl, '_blank')}
                                    >
                                        <FileText className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p className="text-[10px] font-bold">View Signed Amendment</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            </TableCell>
            <TableCell className="text-right py-3">
                <div className="flex items-center justify-end gap-1">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem
                                onClick={() => navigator.clipboard.writeText(employee.id || "")}
                            >
                                Copy Employee ID
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                                setAssignEmployee(employee)
                                setIsAssignOpen(true)
                            }}>
                                <Plus className="mr-2 h-4 w-4" />
                                Assign Task
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                                setSelectedEmployee(employee)
                                setIsViewOpen(true)
                            }}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                            </DropdownMenuItem>
                            {!isRestrictedTeamLead && (
                                <>
                                    <DropdownMenuItem onClick={() => {
                                        setSelectedEmployee(employee)
                                        setIsEditOpen(true)
                                    }}>
                                        <Pencil className="mr-2 h-4 w-4" />
                                        Edit Employee
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => employee.id && setDeleteId(employee.id)}
                                        className="text-destructive focus:text-destructive"
                                    >
                                        <Trash className="mr-2 h-4 w-4" />
                                        Delete Employee
                                    </DropdownMenuItem>
                                </>
                            )}
                            {!isRestrictedTeamLead && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 px-3 py-1 uppercase tracking-widest">Document Issuance</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => {
                                        setAmendmentEmployee(employee);
                                        setIsAmendmentReviewOpen(true);
                                    }}>
                                        <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                                        Amendment Letter
                                    </DropdownMenuItem>
                                    {employee.employmentType?.includes("Intern") && (
                                        <DropdownMenuItem onClick={() => {
                                            setCompletionEmployee(employee);
                                            setIsCompletionReviewOpen(true);
                                        }}>
                                            <FileCheck className="mr-2 h-4 w-4 text-teal-500" />
                                            Completion Cert
                                        </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => {
                                        setRelievingEmployee(employee);
                                        setIsRelievingReviewOpen(true);
                                    }}>
                                        <FileText className="mr-2 h-4 w-4 text-rose-500" />
                                        Relieving Letter
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </TableCell>
        </TableRow>
    );
});

const EmployeeListGroup = memo(({
    team,
    employees,
    ...props
}: any) => {
    return (
        <div className="mb-10 last:mb-0">
            <div className="flex items-center justify-between px-2 mb-4">
                <div className="flex items-center gap-3">
                    <div className="h-6 w-1 rounded-full bg-primary" />
                    <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">{team}</h3>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0">
                        {employees.length} Members
                    </Badge>
                </div>
            </div>
            <Table>
                <TableHeader className="bg-gray-50">
                    <TableRow className="hover:bg-transparent border-slate-100">
                        <TableHead className="w-[220px] text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3">Employee</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3">Role</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3">Email</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3">Joining Date</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3">Department</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3">Team</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3">On Leave</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3">Empl Title</TableHead>
                        <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-500 py-3 text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {employees.map((emp: any) => (
                        <EmployeeRow
                            key={emp.id || emp.email}
                            employee={emp}
                            {...props}
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
});

export default function EmployeesPage() {
    const { user, isAdmin } = useAuth()
    const { employees, loading } = useEmployees()
    const { projects } = useProjects()
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [availableTeams, setAvailableTeams] = useState<string[]>([])
    const [searchTeam, setSearchTeam] = useState("")
    const [isAddTeamOpen, setIsAddTeamOpen] = useState(false)
    const [newTeamName, setNewTeamName] = useState("")
    const [activeEmployeeId, setActiveEmployeeId] = useState<string | null>(null)
    const [viewMode, setViewMode] = useState<'list' | 'teams'>('teams')
    const [hiddenEmployeeIds, setHiddenEmployeeIds] = useState<string[]>([])
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)
    const [previewTeamName, setPreviewTeamName] = useState("")
    const [previewTeamEmployees, setPreviewTeamEmployees] = useState<any[]>([])
    const [previewInitialEmployeeId, setPreviewInitialEmployeeId] = useState<string | undefined>()
    
    const [isPromotionOpen, setIsPromotionOpen] = useState(false)
    const [promotionEmployee, setPromotionEmployee] = useState<any>(null)
    const [promotionType, setPromotionType] = useState<any>(null)

    const [isCompletionReviewOpen, setIsCompletionReviewOpen] = useState(false)
    const [completionEmployee, setCompletionEmployee] = useState<any>(null)
    const [isSendingCompletion, setIsSendingCompletion] = useState(false)
    const [isAmendmentReviewOpen, setIsAmendmentReviewOpen] = useState(false)
    const [amendmentEmployee, setAmendmentEmployee] = useState<any>(null)
    const [isSendingAmendment, setIsSendingAmendment] = useState(false)
    const [isRelievingReviewOpen, setIsRelievingReviewOpen] = useState(false)
    const [relievingEmployee, setRelievingEmployee] = useState<any>(null)
    const [isSendingRelieving, setIsSendingRelieving] = useState(false)

    const [searchQuery, setSearchQuery] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")
    const [deptFilter, setDeptFilter] = useState("all")
    const [isAssignOpen, setIsAssignOpen] = useState(false)
    const [assignEmployee, setAssignEmployee] = useState<any>(null)
    const [isAddingTeam, setIsAddingTeam] = useState(false)

    const currentEmployee = employees.find(e =>
        e.authUid === user?.uid ||
        (e.email && user?.email && e.email.toLowerCase() === user.email.toLowerCase())
    )

    const checkHR = (val?: string) => {
        if (!val) return false;
        const n = val.trim().toLowerCase();
        return /\bhr\b/.test(n) || n.includes('human') || n.includes('humar') || n.includes('recruitment') || n.includes('talent');
    }

    const isHR = checkHR(currentEmployee?.team) || checkHR(currentEmployee?.department)
    const isTeamLead = currentEmployee?.isTeamLead === true
    const isRestrictedTeamLead = isTeamLead && !isAdmin && !isHR

    useEffect(() => {
        const unsubscribe = settingsService.subscribeToTeams((teams) => {
            setAvailableTeams(teams);
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const resetLeaveStatusForNewDay = async () => {
            const today = new Date().toDateString()
            const employeesOnLeave = employees.filter(emp =>
                emp.isOnLeave && emp.leaveDate && new Date(emp.leaveDate).toDateString() !== today
            )
            for (const emp of employeesOnLeave) {
                if (emp.id) {
                    try {
                        await employeeService.updateEmployee(emp.id, {
                            isOnLeave: false,
                            leaveDate: null
                        })
                    } catch (error) {
                        console.error(`Failed to reset leave for ${emp.name}:`, error)
                    }
                }
            }
            if (employeesOnLeave.length > 0) {
                toast.info(`${employeesOnLeave.length} employee(s) automatically marked as available for the new day`)
            }
        }
        if (!loading && employees.length > 0) {
            resetLeaveStatusForNewDay()
        }
    }, [loading, employees.length])

    const handleTeamChange = async (employeeId: string, team: string) => {
        try {
            await employeeService.updateEmployee(employeeId, { team: team === "Unassigned" ? "" : team });
            toast.success("Team updated successfully");
        } catch (error) {
            toast.error("Failed to update team");
        }
    }

    const handleRoleChange = async (employeeId: string, role: string) => {
        try {
            await employeeService.updateEmployee(employeeId, { role });
            toast.success("Role updated successfully");
        } catch (error) {
            toast.error("Failed to update role");
        }
    }

    const handleDepartmentChange = async (employeeId: string, department: string) => {
        try {
            await employeeService.updateEmployee(employeeId, { department });
            toast.success("Department updated successfully");
        } catch (error) {
            toast.error("Failed to update department");
        }
    }

    const handleEmploymentTypeChange = async (employeeId: string, type: string) => {
        const employee = employees.find(e => e.id === employeeId);
        if (!employee) {
            toast.error("Employee not found in list");
            return;
        }
        const isFromCandidate = !!employee.candidateId;
        const isUnpaidToPaid = employee.employmentType === 'Internship (Unpaid)' && type === 'Internship (Paid)';
        const isFullTimeConversion = type === 'Full Time' && employee.employmentType !== 'Full Time';
        if (isFromCandidate && (isUnpaidToPaid || isFullTimeConversion)) {
            setPromotionEmployee(employee);
            setPromotionType(type);
            setIsPromotionOpen(true);
            return;
        }
        if (type === 'Left') {
            setRelievingEmployee(employee);
            setIsRelievingReviewOpen(true);
            return;
        }
        try {
            await employeeService.updateEmployee(employeeId, { employmentType: type as any });
            toast.success("Employment type updated successfully");
        } catch (error) {
            toast.error("Failed to update employment type");
        }
    }

    const handleSendCompletionPDF = async (employee: any, docData: any) => {
        setIsSendingCompletion(true);
        try {
            const config = await candidateService.getOfferConfig();
            const doc = generateInternshipCompletionPDF(employee, config, docData.internshipEndDate);
            const pdfBlob = doc.output('blob');
            const fileName = `Internship_Completion_${employee.name.replace(/\s+/g, '_')}.pdf`;
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
            const pdfUrl = await candidateService.uploadOfferAsset(file, 'internship_completion');
            await candidateService.sendCandidateEmail({
                to: employee.email,
                subject: `Internship Completion Certificate - ${docData.companyName || "UXDLAB"}`,
                text: `Dear ${employee.name},\n\nPlease find attached your internship completion certificate.`,
                html: `<p>Dear <b>${employee.name}</b>,</p><p>Please find attached your internship completion certificate.</p>`,
                attachments: [{
                    name: fileName,
                    url: pdfUrl,
                    type: 'application/pdf'
                }]
            });
            await employeeService.updateEmployee(employee.id, { internshipCompletionUrl: pdfUrl });
            toast.success("Completion certificate sent successfully!");
            setIsCompletionReviewOpen(false);
        } catch (error) {
            console.error("Failed to send completion certificate:", error);
            toast.error("Failed to generate or send certificate");
        } finally {
            setIsSendingCompletion(false);
        }
    };

    const handleSendAmendmentPDF = async (employee: any, docData: any) => {
        setIsSendingAmendment(true);
        try {
            const config = await candidateService.getOfferConfig();
            const doc = generateAmendmentLetterPDF(employee, config, docData.effectiveDate, docData.newSalary, "Internship");
            const pdfBlob = doc.output('blob');
            const fileName = `Amendment_Letter_${employee.name.replace(/\s+/g, '_')}.pdf`;
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
            const pdfUrl = await candidateService.uploadOfferAsset(file, 'amendment_letter');
            await candidateService.sendCandidateEmail({
                to: employee.email,
                subject: `Amendment Letter - ${docData.companyName || "UXDLAB"}`,
                text: `Dear ${employee.name},\n\nPlease find attached your amendment letter regarding the changes in your employment terms.`,
                html: `<p>Dear <b>${employee.name}</b>,</p><p>Please find attached your amendment letter regarding the changes in your employment terms.</p>`,
                attachments: [{
                    name: fileName,
                    url: pdfUrl,
                    type: 'application/pdf'
                }]
            });
            toast.success("Amendment letter sent successfully!");
            setIsAmendmentReviewOpen(false);
        } catch (error) {
            console.error("Failed to send amendment letter:", error);
            toast.error("Failed to generate or send letter");
        } finally {
            setIsSendingAmendment(false);
        }
    };

    const handleSendRelievingPDF = async (employee: any, docData: any) => {
        setIsSendingRelieving(true);
        try {
            const config = await candidateService.getOfferConfig();
            const doc = generateRelievingLetterPDF(employee, config, docData.relievingDate);
            const pdfBlob = doc.output('blob');
            const fileName = `Relieving_Letter_${employee.name.replace(/\s+/g, '_')}.pdf`;
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
            const pdfUrl = await candidateService.uploadOfferAsset(file, 'relieving_letter');
            await candidateService.sendCandidateEmail({
                to: employee.email,
                subject: `Relieving & Experience Letter - ${docData.companyName || "UXDLAB"}`,
                text: `Dear ${employee.name},\n\nPlease find attached your relieving and experience letter. We wish you all the best for your future endeavors.`,
                html: `<p>Dear <b>${employee.name}</b>,</p><p>Please find attached your relieving and experience letter. We wish you all the best for your future endeavors.</p>`,
                attachments: [{
                    name: fileName,
                    url: pdfUrl,
                    type: 'application/pdf'
                }]
            });
            await employeeService.updateEmployee(employee.id, { 
                employmentType: 'Left',
                relievingLetterUrl: pdfUrl 
            });
            toast.success("Relieving letter sent successfully and status updated to 'Left'!");
            setIsRelievingReviewOpen(false);
        } catch (error) {
            console.error("Failed to send relieving letter:", error);
            toast.error("Failed to generate or send letter");
        } finally {
            setIsSendingRelieving(false);
        }
    };

    const handleManualAddTeam = async () => {
        if (!newTeamName.trim()) return
        try {
            await settingsService.addTeam(newTeamName.trim())

            if (activeEmployeeId) {
                await employeeService.updateEmployee(activeEmployeeId, { team: newTeamName.trim() })
                toast.success("New team added and assigned")
            } else {
                toast.success("New team added")
            }

            setIsAddTeamOpen(false)
            setNewTeamName("")
            setActiveEmployeeId(null)
        } catch (error) {
            console.error("Error adding team:", error)
            toast.error("Failed to add team")
        } finally {
            setIsAddingTeam(false)
        }
    }

    // View/Edit State
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null)
    const [isViewOpen, setIsViewOpen] = useState(false)
    const [isEditOpen, setIsEditOpen] = useState(false)

    const handleDelete = async () => {
        if (deleteId) {
            await employeeService.deleteEmployee(deleteId)
            setDeleteId(null)
        }
    }

    // Get projects and tasks assigned to each employee from milestones (like Daily Updates module)
    const employeesWithProjects = useEmployeeWorkload(employees, projects);

    const onLeaveCount = employeesWithProjects.filter(e => e.isOnLeave).length;
    const freeCount = employeesWithProjects.filter(e => e.isFree).length;

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse font-medium">Loading employees...</p>
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-bold tracking-tight">Employees</h2>
                    <div className="flex items-center gap-2 mt-1">
                        {onLeaveCount > 0 && (
                            <Badge variant="outline" className="bg-destructive/5 text-destructive border-destructive/20 font-bold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider">
                                {onLeaveCount} On Leave
                            </Badge>
                        )}
                        {freeCount > 0 && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 font-bold px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider">
                                {freeCount} Free to assign
                            </Badge>
                        )}
                        {!isRestrictedTeamLead && (
                            <Badge
                                variant="outline"
                                className="cursor-pointer border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all text-primary/80 font-medium px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider flex items-center gap-1"
                                onClick={() => {
                                    setActiveEmployeeId(null);
                                    setIsAddTeamOpen(true);
                                }}
                            >
                                <Plus className="h-3 w-3" /> Add Team
                            </Badge>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center border rounded-lg p-1 mr-4 bg-muted/20">
                        <Button
                            variant={viewMode === 'teams' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setViewMode('teams')}
                        >
                            <LayoutGrid className="h-4 w-4 mr-2" />
                            Teams
                        </Button>
                        <Button
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setViewMode('list')}
                        >
                            <List className="h-4 w-4 mr-2" />
                            List
                        </Button>
                        {hiddenEmployeeIds.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-muted-foreground hover:text-foreground"
                                onClick={() => setHiddenEmployeeIds([])}
                                title="Show All Hidden Employees"
                            >
                                <Eye className="h-4 w-4 mr-2" />
                                Unhide All
                            </Button>
                        )}
                    </div>
                    {!isRestrictedTeamLead && employees.length > 0 && (
                        <>
                            <ImportEmployeesDialog />
                            <AddEmployeeSheet />
                        </>
                    )}
                </div>
            </div>
            {employees.length > 0 ? (
                <>
                    {viewMode === 'teams' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-10">
                            {[
                                { title: "Team A", filter: (e: any) => e.team?.toLowerCase() === "team a" },
                                { title: "Team B", filter: (e: any) => e.team?.toLowerCase() === "team b" },
                                { title: "Team C", filter: (e: any) => e.team?.toLowerCase() === "team c" },
                                { title: "Team D", filter: (e: any) => e.team?.toLowerCase() === "team d" },
                                { title: "QA", filter: (e: any) => e.team?.toLowerCase() === "qa" },
                                { 
                                    title: "Digital Marketing & Design", 
                                    filter: (e: any) => {
                                        const t = e.team?.toLowerCase() || "";
                                        const d = e.department?.toLowerCase() || "";
                                        const r = e.role?.toLowerCase() || "";
                                        return (
                                            t.includes("digital marketing") || t.includes("design") ||
                                            d.includes("digital marketing") || d.includes("design") ||
                                            r.includes("designer")
                                        );
                                    }
                                }
                            ].filter(section => {
                                if (!isRestrictedTeamLead) return true;
                                // If restricted team lead, only show their team
                                const userTeam = currentEmployee?.team?.toLowerCase() || "";
                                if (section.title === "Digital Marketing & Design") {
                                    return userTeam.includes("digital marketing") || userTeam.includes("design");
                                }
                                return section.title.toLowerCase() === userTeam;
                            }).map((section) => (
                                <TeamSection
                                    key={section.title}
                                    section={section}
                                    employeesWithProjects={employeesWithProjects}
                                    hiddenEmployeeIds={hiddenEmployeeIds}
                                    onPreview={(title: string, emps: any[]) => {
                                        setPreviewTeamName(title);
                                        setPreviewTeamEmployees(emps);
                                        setPreviewInitialEmployeeId(undefined);
                                        setIsPreviewOpen(true);
                                    }}
                                    onTeamLeadToggle={(id: string, isLead: boolean) => {
                                        employeeService.updateEmployee(id, { isTeamLead: isLead });
                                    }}
                                    onHideEmployee={(id: string) => {
                                        setHiddenEmployeeIds(prev => [...prev, id]);
                                    }}
                                    onPreviewTasks={(title: string, emps: any[], empId: string) => {
                                        setPreviewTeamName(title);
                                        setPreviewTeamEmployees(emps);
                                        setPreviewInitialEmployeeId(empId);
                                        setIsPreviewOpen(true);
                                    }}
                                    isRestrictedTeamLead={isRestrictedTeamLead}
                                />
                            ))}
                        </div>
                    ) : (
                        <>
                            {/* List View Controls */}
                            <div className="flex items-center justify-between gap-4 mb-6">
                                <div className="flex items-center gap-2 flex-1">
                                    <Input 
                                        placeholder="Search employees..." 
                                        className="max-w-sm" 
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                    />
                                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                                        <SelectTrigger className="h-8 w-8 p-0 justify-center" icon={null}>
                                            <ListFilter className="h-4 w-4" />
                                            <span className="sr-only">Filter by Status</span>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Statuses</SelectItem>
                                            <SelectItem value="on-leave">On Leave</SelectItem>
                                            <SelectItem value="available">Available</SelectItem>
                                            <SelectItem value="free">Free to Assign</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Select value={deptFilter} onValueChange={setDeptFilter}>
                                        <SelectTrigger className="h-8 w-8 p-0 justify-center" icon={null}>
                                            <Users className="h-4 w-4" />
                                            <span className="sr-only">Filter by Department</span>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Departments</SelectItem>
                                            {DEPARTMENTS.map(dept => (
                                                <SelectItem key={dept} value={dept.toLowerCase()}>{dept}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-8">
                                {(() => {
                                    const filteredEmployees = employeesWithProjects.filter(emp => {
                                        const matchesSearch = !searchQuery || 
                                            emp.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            emp.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            emp.role?.toLowerCase().includes(searchQuery.toLowerCase());
                                        
                                        const matchesStatus = statusFilter === "all" ||
                                            (statusFilter === "on-leave" && emp.isOnLeave) ||
                                            (statusFilter === "available" && !emp.isOnLeave) ||
                                            (statusFilter === "free" && emp.isFree);
                                        
                                        const matchesDept = deptFilter === "all" || 
                                            emp.department?.toLowerCase() === deptFilter.toLowerCase();
                                        
                                        return matchesSearch && matchesStatus && matchesDept;
                                    });

                                    const employeesByTeam = filteredEmployees.reduce((acc, emp) => {
                                        const team = emp.team || "Unassigned";
                                        if (!acc[team]) acc[team] = [];
                                        acc[team].push(emp);
                                        return acc;
                                    }, {} as Record<string, typeof employeesWithProjects>);

                                    const sortedTeams = Array.from(new Set([...Object.keys(employeesByTeam), ...availableTeams]))
                                        .filter(team => {
                                            if (team === 'Admin' || team === 'Admin Team') return false;
                                            if (!isRestrictedTeamLead) return true;
                                            return team.toLowerCase() === currentEmployee?.team?.toLowerCase();
                                        })
                                        .sort();
                                    
                                    if (sortedTeams.includes("Unassigned")) {
                                        sortedTeams.push(sortedTeams.splice(sortedTeams.indexOf("Unassigned"), 1)[0]);
                                    }

                                    return sortedTeams.filter(team => (employeesByTeam[team]?.length || 0) > 0 || !searchQuery).map(team => (
                                        <EmployeeListGroup
                                            key={team}
                                            team={team}
                                            employees={employeesByTeam[team] || []}
                                            handleRoleChange={handleRoleChange}
                                            handleDepartmentChange={handleDepartmentChange}
                                            handleTeamChange={handleTeamChange}
                                            setDeleteId={setDeleteId}
                                            setSelectedEmployee={setSelectedEmployee}
                                            setIsViewOpen={setIsViewOpen}
                                            setIsEditOpen={setIsEditOpen}
                                            setAssignEmployee={setAssignEmployee}
                                            setIsAssignOpen={setIsAssignOpen}
                                            availableTeams={availableTeams}
                                            searchTeam={searchTeam}
                                            setSearchTeam={setSearchTeam}
                                            setNewTeamName={setNewTeamName}
                                            setActiveEmployeeId={setActiveEmployeeId}
                                            setIsAddTeamOpen={setIsAddTeamOpen}
                                            DEPARTMENTS={DEPARTMENTS}
                                            COMMON_ROLES={COMMON_ROLES}
                                            handleEmploymentTypeChange={handleEmploymentTypeChange}
                                            setRelievingEmployee={setRelievingEmployee}
                                            setIsRelievingReviewOpen={setIsRelievingReviewOpen}
                                            setCompletionEmployee={setCompletionEmployee}
                                            setIsCompletionReviewOpen={setIsCompletionReviewOpen}
                                            setAmendmentEmployee={setAmendmentEmployee}
                                            setIsAmendmentReviewOpen={setIsAmendmentReviewOpen}
                                            isRestrictedTeamLead={isRestrictedTeamLead}
                                        />
                                    ));
                                })()}
                            </div>
                        </>
                    )}
                </>
            ) : (
                <div className="flex-1 flex items-center justify-center min-h-[calc(100vh-200px)]">
                    <Empty className="max-w-md">
                        <EmptyMedia className="h-20 w-20 bg-primary/10 rounded-full mb-4">
                            <Users className="h-10 w-10 text-primary/40" />
                        </EmptyMedia>
                        <EmptyHeader>
                            <EmptyTitle className="text-2xl">No employees found</EmptyTitle>
                            <EmptyDescription className="text-base leading-relaxed">
                                Build your dream team. Start by adding employees and assigning them to projects to manage resources and track progress.
                            </EmptyDescription>
                        </EmptyHeader>
                        <EmptyContent>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                                <AddEmployeeSheet trigger={
                                    <Button className="gap-2">
                                        <UserPlus className="h-4 w-4" />
                                        Add Employee
                                    </Button>
                                } />
                                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">or</div>
                                <ImportEmployeesDialog />
                            </div>
                        </EmptyContent>
                    </Empty>
                </div>
            )
            }

            <EmployeeDetailsSheet
                open={isViewOpen}
                onOpenChange={setIsViewOpen}
                employee={selectedEmployee}
            />

            <EmployeePromotionSheet
                open={isPromotionOpen}
                onOpenChange={setIsPromotionOpen}
                employee={promotionEmployee}
                promotionType={promotionType}
            />

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the employee record.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>


            <AddEmployeeSheet
                employeeToEdit={selectedEmployee}
                open={isEditOpen}
                onOpenChange={setIsEditOpen}
                trigger={null}
            />

            <TeamPreviewSheet
                teamName={previewTeamName}
                employees={previewTeamEmployees}
                open={isPreviewOpen}
                onOpenChange={setIsPreviewOpen}
                initialSelectedEmployeeId={previewInitialEmployeeId}
            />

            <Dialog open={isAddTeamOpen} onOpenChange={setIsAddTeamOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add New Team</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="new-team" className="text-right">Team Name</Label>
                            <Input
                                id="new-team"
                                placeholder="e.g. Design System"
                                value={newTeamName}
                                onChange={(e) => setNewTeamName(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsAddTeamOpen(false)}>Cancel</Button>
                            <Button onClick={handleManualAddTeam} disabled={isAddingTeam || !newTeamName.trim()}>
                                {isAddingTeam && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Add Team
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AssignTaskSheet
                open={isAssignOpen}
                onOpenChange={setIsAssignOpen}
                employee={assignEmployee}
            />

            {/* Document Review Dialogs */}
            <RelievingLetterReviewDialog
                open={isRelievingReviewOpen}
                onOpenChange={setIsRelievingReviewOpen}
                candidate={relievingEmployee}
                onSend={(docData: any) => handleSendRelievingPDF(relievingEmployee, docData)}
                isSending={isSendingRelieving}
            />

            <InternshipCompletionReviewDialog
                open={isCompletionReviewOpen}
                onOpenChange={setIsCompletionReviewOpen}
                candidate={completionEmployee}
                onSend={(docData: any) => handleSendCompletionPDF(completionEmployee, docData)}
                isSending={isSendingCompletion}
            />

            <AmendmentLetterReviewDialog
                open={isAmendmentReviewOpen}
                onOpenChange={setIsAmendmentReviewOpen}
                candidate={amendmentEmployee}
                onSend={(docData: any) => handleSendAmendmentPDF(amendmentEmployee, docData)}
                isSending={isSendingAmendment}
            />
        </div >
    )
}

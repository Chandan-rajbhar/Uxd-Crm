import { useState, useEffect, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useProjects } from "src/hooks/useProjects"
import { useEmployees } from "src/hooks/useEmployees"
import { useAuth } from "src/contexts/AuthContext"
import { format } from "date-fns"

export function useProjectTracker() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { projects, loading } = useProjects()
    const { user, isAdmin, isEmployee, isClient } = useAuth()
    const { employees } = useEmployees()

    const project = useMemo(() => projects.find(p => p.id === id), [projects, id])

    const currentEmployee = useMemo(() => {
        if (user && employees.length > 0) {
            return employees.find(e => e.authUid === user.uid || e.email === user.email)
        }
        return null
    }, [user, employees])

    // State
    const [items, setItems] = useState<any[]>([])
    const [selectedTask, setSelectedTask] = useState<any>(null)
    const [isSheetOpen, setIsSheetOpen] = useState(false)
    const [newTaskName, setNewTaskName] = useState("")
    const [tagTask, setTagTask] = useState<any>(null)
    const [isTagOpen, setIsTagOpen] = useState(false)
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [taskToDelete, setTaskToDelete] = useState<string | null>(null)
    const [isClearAllOpen, setIsClearAllOpen] = useState(false)
    const [isAIOpen, setIsAIOpen] = useState(false)
    const [isAIGenOpen, setIsAIGenOpen] = useState(false)
    const [aiGenTargetItem, setAiGenTargetItem] = useState<any>(null)
    const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false)
    const [isQuickPostOpen, setIsQuickPostOpen] = useState(false)
    const [quickPostWeek, setQuickPostWeek] = useState<string>("Week 1")
    const [quickPostTargetItem, setQuickPostTargetItem] = useState<any>(null)
    const [statusFilter, setStatusFilter] = useState<string>("All")
    const [showMyTasks, setShowMyTasks] = useState(false)
    const [viewDate, setViewDate] = useState(new Date())
    const [activeSubtaskParentId, setActiveSubtaskParentId] = useState<string | null>(null)
    const [newSubtaskName, setNewSubtaskName] = useState("")
    const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set())
    const [isResourcesSheetOpen, setIsResourcesSheetOpen] = useState(false)
    const [resourceSheetView, setResourceSheetView] = useState<'list' | 'add' | 'detail'>('list')
    const [selectedResource, setSelectedResource] = useState<any>(null)
    const [resourceType, setResourceType] = useState<'text' | 'file'>('text')
    const [resourceTitle, setResourceTitle] = useState("")
    const [resourceContent, setResourceContent] = useState("")
    const [resourceFile, setResourceFile] = useState<File | null>(null)
    const [isSavingResource, setIsSavingResource] = useState(false)
    const [activeTab, setActiveTab] = useState<'marketing' | 'more'>('marketing')

    const selectedMonth = format(viewDate, 'MMMM yyyy')

    const toggleExpand = (taskId: string) => {
        setExpandedTasks(prev => {
            const next = new Set(prev)
            if (next.has(taskId)) next.delete(taskId)
            else next.add(taskId)
            return next
        })
    }

    // Initialize timeline items
    useEffect(() => {
        if (!project) return;

        const milestones = (project.milestones || []).filter((m: any) => m.task && m.task.trim().length > 0);
        let combinedItems = [...milestones];

        if (project.notes) {
            const noteTasks = project.notes.split('\n')
                .filter((t: string) => t.trim().length > 0)
                .filter((note: string) => !milestones.some((m: any) => m.task === note.trim()))
                .map((note: string, index: number) => ({
                    id: `auto-${Date.now()}-${index}`,
                    task: note.trim(),
                    date: format(new Date(), 'yyyy-MM-dd'),
                    status: 'Pending',
                    description: 'Active task from Project Tracker',
                    assignedTo: project.devTeam?.[0] || { name: 'Unassigned', avatar: '' },
                    notes: [],
                    attachments: []
                }));

            combinedItems = [...combinedItems, ...noteTasks];
        }

        combinedItems.sort((a, b) => {
            const dateA = a.date || "";
            const dateB = b.date || "";
            if (dateB !== dateA) return dateB.localeCompare(dateA);
            if (a.priority === 'high' && b.priority !== 'high') return -1;
            if (a.priority !== 'high' && b.priority === 'high') return 1;
            if (a.isNewFeature && !b.isNewFeature) return -1;
            if (!a.isNewFeature && b.isNewFeature) return 1;
            
            const aTime = a.id.includes('task-') ? parseInt(a.id.split('-')[1]) : (a.id.includes('auto-') ? parseInt(a.id.split('-')[1]) : 0);
            const bTime = b.id.includes('task-') ? parseInt(b.id.split('-')[1]) : (b.id.includes('auto-') ? parseInt(b.id.split('-')[1]) : 0);
            return bTime - aTime;
        });

        const isTeamMember = !isAdmin && currentEmployee && (
            (currentEmployee.team && (project.assignedTeams?.includes(currentEmployee.team) || project.assignedTeam === currentEmployee.team)) ||
            project.devTeam?.some((d: any) => (typeof d === 'string' ? d : d.name) === currentEmployee.name)
        );

        if (!isAdmin && !isClient && !isTeamMember && currentEmployee && project.category !== "Digital Marketing") {
            combinedItems = combinedItems.filter(item => {
                const assignees = Array.isArray(item.assignedTo) ? item.assignedTo : (item.assignedTo ? [item.assignedTo] : []);
                return assignees.some((a: any) => (typeof a === 'string' ? a : a.name) === currentEmployee.name);
            });
        }

        if (isClient) {
            combinedItems = combinedItems.filter(item => !item.isHiddenFromClient);
        }

        if (statusFilter !== "All") {
            combinedItems = combinedItems.filter(item => item.status === statusFilter);
        }

        if (!isAdmin && showMyTasks && currentEmployee) {
            combinedItems = combinedItems.filter(item => {
                const assignees = Array.isArray(item.assignedTo) ? item.assignedTo : (item.assignedTo ? [item.assignedTo] : []);
                return assignees.some((a: any) => (typeof a === 'string' ? a : a.name) === currentEmployee.name);
            });
        }

        setItems(combinedItems);
    }, [project, isAdmin, currentEmployee, statusFilter, showMyTasks]);

    return {
        id, navigate, project, loading, user, isAdmin, isEmployee, isClient, currentEmployee,
        items, setItems, selectedTask, setSelectedTask, isSheetOpen, setIsSheetOpen,
        newTaskName, setNewTaskName, tagTask, setTagTask, isTagOpen, setIsTagOpen,
        isDeleteOpen, setIsDeleteOpen, taskToDelete, setTaskToDelete, isClearAllOpen, setIsClearAllOpen,
        isAIOpen, setIsAIOpen, isAIGenOpen, setIsAIGenOpen, aiGenTargetItem, setAiGenTargetItem,
        isTemplateManagerOpen, setIsTemplateManagerOpen, isQuickPostOpen, setIsQuickPostOpen,
        quickPostWeek, setQuickPostWeek, quickPostTargetItem, setQuickPostTargetItem,
        statusFilter, setStatusFilter, showMyTasks, setShowMyTasks, viewDate, setViewDate, selectedMonth,
        activeSubtaskParentId, setActiveSubtaskParentId, newSubtaskName, setNewSubtaskName,
        expandedTasks, toggleExpand, isResourcesSheetOpen, setIsResourcesSheetOpen,
        resourceSheetView, setResourceSheetView, selectedResource, setSelectedResource,
        resourceType, setResourceType, resourceTitle, setResourceTitle, resourceContent, setResourceContent,
        resourceFile, setResourceFile, isSavingResource, setIsSavingResource, activeTab, setActiveTab
    }
}

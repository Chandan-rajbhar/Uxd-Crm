import { useMemo } from 'react';
import type { Employee } from 'src/store/slices/employeesSlice';

export function useEmployeeWorkload(employees: Employee[], projects: any[]) {
    return useMemo(() => {
        return employees.map(emp => {
            const assignedProjects: { project: any; tasks: any[] }[] = [];

            projects.forEach(project => {
                const milestones = project.milestones || [];
                const assignedTasks: any[] = [];

                const t = emp.team?.toLowerCase() || "";
                const d = emp.department?.toLowerCase() || "";
                const r = (emp as any).role?.toLowerCase() || "";
                const isDMorDesigner = t.includes("digital marketing") || d.includes("digital marketing") || 
                                     t.includes("design") || d.includes("design") || r.includes("designer");

                milestones.forEach((m: any) => {
                    const assignees = Array.isArray(m.assignedTo) ? m.assignedTo : (m.assignedTo ? [m.assignedTo] : []);
                    const isAssigned = assignees.some((a: any) =>
                        a.name === emp.name || a.email === emp.email
                    );

                    // Include active tasks + tasks completed/delivered today
                    const isCompletedToday = (m.status === 'Completed' || m.status === 'Delivered' || m.status === 'Posted') &&
                        m.completedAt && new Date(m.completedAt).toDateString() === new Date().toDateString();

                    const isPending = m.status === 'Pending' || !m.status;
                    const shouldHideForDMDesign = isDMorDesigner && isPending;

                    if (isAssigned && !shouldHideForDMDesign && (m.status !== 'Completed' && m.status !== 'Delivered' && m.status !== 'Posted' || isCompletedToday)) {
                        assignedTasks.push({
                            id: m.id,
                            task: m.task,
                            status: m.status,
                            dueDate: m.dueDate,
                            createdAt: m.createdAt || null,
                            completedAt: m.completedAt || null,
                            subtasks: m.subtasks || []
                        });
                    }
                });

                // Include project only if employee has active tasks assigned
                if (assignedTasks.length > 0) {
                    assignedProjects.push({
                        project: project,
                        tasks: assignedTasks
                    });
                }
            });

            // Calculate total active tasks across all projects
            const totalActiveTasks = assignedProjects.reduce((sum, ap) => sum + ap.tasks.length, 0);

            return {
                ...emp,
                projects: assignedProjects.map(ap => ap.project),
                projectTasks: assignedProjects,  // Contains both project and tasks info
                totalActiveTasks,
                isFree: totalActiveTasks === 0 && !emp.isOnLeave  // Employee is free if no active tasks and not on leave
            };
        });
    }, [employees, projects]);
}

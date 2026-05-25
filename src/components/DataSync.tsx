import { useEffect } from 'react';
import { clientService } from 'src/firebase/clientService';
import { projectService } from 'src/firebase/projectService';
import { employeeService } from 'src/firebase/employeeService';
import { settingsService } from 'src/firebase/settingsService';
import { useAuth } from 'src/contexts/AuthContext';
import { useAppDispatch } from 'src/store/hooks';
import { setAvailableTeams } from 'src/store/slices/settingsSlice';

/**
 * DataSync is a headless component mounted once per authenticated session.
 * It initiates the primary Firestore snapshot listeners and feeds data into Redux,
 * preventing duplicate redundant listeners across different child components.
 */
export function DataSync() {
    const { user, role, loading: authLoading } = useAuth();
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (authLoading || !user) return;

        const unsubClients = clientService.subscribeToClients();
        const unsubEmployees = employeeService.subscribeToEmployees();
        const unsubTeams = settingsService.subscribeToTeams((teams) => {
            dispatch(setAvailableTeams(teams));
        });
        
        let unsubProjects: (() => void) | undefined;
        if (role === 'client' && user.email) {
            unsubProjects = projectService.subscribeToProjects({ clientEmail: user.email });
        } else {
            unsubProjects = projectService.subscribeToProjects();
        }

        return () => {
            unsubClients();
            unsubEmployees();
            unsubTeams();
            if (unsubProjects) unsubProjects();
        };
    }, [authLoading, user, role]);

    return null;
}

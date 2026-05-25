import { useEffect } from 'react';
import { useAppSelector } from 'src/store/hooks';
import { appsService } from 'src/firebase/appsService';

export function useApps() {
    const apps = useAppSelector((state) => state.apps.items);
    const loading = useAppSelector((state) => state.apps.loading);
    const error = useAppSelector((state) => state.apps.error);

    useEffect(() => {
        const unsubscribe = appsService.subscribeToApps();
        return () => unsubscribe();
    }, []);

    return { apps, loading, error };
}

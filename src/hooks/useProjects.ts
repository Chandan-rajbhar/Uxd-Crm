import { useAppSelector } from 'src/store/hooks';

export function useProjects() {
    const projects = useAppSelector((state) => state.projects.items);
    const loading = useAppSelector((state) => state.projects.loading);
    const error = useAppSelector((state) => state.projects.error);

    return { projects, loading, error };
}

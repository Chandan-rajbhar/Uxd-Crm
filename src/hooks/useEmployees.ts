import { useAppSelector } from 'src/store/hooks';

export function useEmployees() {
    const employees = useAppSelector((state) => state.employees.items);
    const loading = useAppSelector((state) => state.employees.loading);
    const error = useAppSelector((state) => state.employees.error);

    return { employees, loading, error };
}

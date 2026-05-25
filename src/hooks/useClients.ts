import { useAppSelector } from 'src/store/hooks';

export function useClients() {
    const clients = useAppSelector((state) => state.clients.items);
    const loading = useAppSelector((state) => state.clients.loading);
    const error = useAppSelector((state) => state.clients.error);

    return { clients, loading, error };
}

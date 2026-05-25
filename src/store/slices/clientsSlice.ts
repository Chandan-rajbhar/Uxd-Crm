import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Client {
    id?: string;
    name: string;
    company: string;
    email: string;
    phone: string;
    industry: string;
    location: string;
    timezone: string;
    status: 'Active' | 'Inactive' | 'Pending';
    lastSeen: string;
    projects: string[]; // List of Project IDs
    logo?: string;
    address?: string;
    intelligence?: string;
    intelligenceSources?: { title: string; url: string }[];
    intelligenceImages?: string[];
}

interface ClientsState {
    items: Client[];
    loading: boolean;
    error: string | null;
}

const initialState: ClientsState = {
    items: [],
    loading: false,
    error: null,
};

const clientsSlice = createSlice({
    name: 'clients',
    initialState,
    reducers: {
        setClients: (state, action: PayloadAction<Client[]>) => {
            state.items = action.payload;
        },
        addClient: (state, action: PayloadAction<Client>) => {
            state.items.push(action.payload);
        },
        updateClient: (state, action: PayloadAction<Client>) => {
            const index = state.items.findIndex(c => c.id === action.payload.id);
            if (index !== -1) {
                state.items[index] = action.payload;
            }
        },
        deleteClient: (state, action: PayloadAction<string>) => {
            state.items = state.items.filter(c => c.id !== action.payload);
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
        }
    },
});

export const { setClients, addClient, updateClient, deleteClient, setLoading, setError } = clientsSlice.actions;

export default clientsSlice.reducer;

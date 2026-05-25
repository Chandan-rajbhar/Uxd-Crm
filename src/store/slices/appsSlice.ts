import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface App {
    id: string;
    name: string;
    android: string;
    ios: string;
    logo: string;
    rejectionIssue: string;
    developer: string;
    status: string;
    playStoreLink?: string;
    appStoreLink?: string;
}

interface AppsState {
    items: App[];
    loading: boolean;
    error: string | null;
}

const initialState: AppsState = {
    items: [],
    loading: false,
    error: null,
};

const appsSlice = createSlice({
    name: 'apps',
    initialState,
    reducers: {
        setApps(state, action: PayloadAction<App[]>) {
            state.items = action.payload;
        },
        addApp(state, action: PayloadAction<App>) {
            state.items.push(action.payload);
        },
        updateApp(state, action: PayloadAction<App>) {
            const index = state.items.findIndex((app) => app.id === action.payload.id);
            if (index !== -1) {
                state.items[index] = action.payload;
            }
        },
        deleteApp(state, action: PayloadAction<string>) {
            state.items = state.items.filter((app) => app.id !== action.payload);
        },
        setLoading(state, action: PayloadAction<boolean>) {
            state.loading = action.payload;
        },
        setError(state, action: PayloadAction<string | null>) {
            state.error = action.payload;
        },
    },
});

export const { setApps, addApp, updateApp, deleteApp, setLoading, setError } = appsSlice.actions;

export default appsSlice.reducer;

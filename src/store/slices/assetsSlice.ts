import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface Asset {
    id: string;
    uniqueCode?: string;
    model: string;
    category: string;
    assignedTo: string;
    status: string;
    description: string;
    extraItems?: string;
    repairingDescription?: string;
    createdAt?: any;
    updatedAt?: any;
    images?: string[];
}

interface AssetsState {
    items: Asset[];
    loading: boolean;
    error: string | null;
}

const initialState: AssetsState = {
    items: [],
    loading: false,
    error: null,
};

const assetsSlice = createSlice({
    name: 'assets',
    initialState,
    reducers: {
        setAssets: (state, action: PayloadAction<Asset[]>) => {
            state.items = action.payload;
            state.loading = false;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setError: (state, action: PayloadAction<string>) => {
            state.error = action.payload;
            state.loading = false;
        },
        addAsset: (state, action: PayloadAction<Asset>) => {
            state.items.push(action.payload);
        },
        updateAsset: (state, action: PayloadAction<Asset>) => {
            const index = state.items.findIndex(item => item.id === action.payload.id);
            if (index !== -1) {
                state.items[index] = action.payload;
            }
        },
        deleteAsset: (state, action: PayloadAction<string>) => {
            state.items = state.items.filter(item => item.id !== action.payload);
        },
    },
});

export const { setAssets, setLoading, setError, addAsset, updateAsset, deleteAsset } = assetsSlice.actions;

export default assetsSlice.reducer;

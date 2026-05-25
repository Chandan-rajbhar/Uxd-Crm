import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface BlogProject {
    id: string;
    name: string;
    avatar: string;
    createdAt?: any;
}

interface BlogProjectsState {
    items: BlogProject[];
    loading: boolean;
}

const initialState: BlogProjectsState = {
    items: [],
    loading: false,
};

const blogProjectsSlice = createSlice({
    name: 'blogProjects',
    initialState,
    reducers: {
        setBlogProjects: (state, action: PayloadAction<BlogProject[]>) => {
            state.items = action.payload;
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        }
    },
});

export const { setBlogProjects, setLoading } = blogProjectsSlice.actions;
export default blogProjectsSlice.reducer;

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Blog {
    id?: string;
    title: string;
    content: any; // Can be string or structured object
    excerpt: string;
    coverImage: string;
    images: string[];
    author: string;
    authorRole?: string;
    authorAvatar?: string;
    category: string;
    readTime: string;
    tags: string[];
    createdAt: any;
    status: 'Draft' | 'Published';
}

interface BlogsState {
    items: Blog[];
    loading: boolean;
    error: string | null;
}

const initialState: BlogsState = {
    items: [],
    loading: false,
    error: null,
};

const blogsSlice = createSlice({
    name: 'blogs',
    initialState,
    reducers: {
        setBlogs: (state, action: PayloadAction<Blog[]>) => {
            state.items = action.payload;
        },
        addBlog: (state, action: PayloadAction<Blog>) => {
            state.items.push(action.payload);
        },
        updateBlog: (state, action: PayloadAction<Blog>) => {
            const index = state.items.findIndex(b => b.id === action.payload.id);
            if (index !== -1) {
                state.items[index] = action.payload;
            }
        },
        deleteBlog: (state, action: PayloadAction<string>) => {
            state.items = state.items.filter(b => b.id !== action.payload);
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        }
    },
});

export const { setBlogs, addBlog, updateBlog, deleteBlog, setLoading } = blogsSlice.actions;

export default blogsSlice.reducer;

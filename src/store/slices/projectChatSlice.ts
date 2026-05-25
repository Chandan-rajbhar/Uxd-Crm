import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface Message {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    createdAt: any;
}

interface ProjectChatState {
    messages: Message[];
    activeProjectId: string | null;
    loading: boolean;
    error: string | null;
}

const initialState: ProjectChatState = {
    messages: [],
    activeProjectId: null,
    loading: false,
    error: null,
};

const projectChatSlice = createSlice({
    name: 'projectChat',
    initialState,
    reducers: {
        setActiveProject: (state, action: PayloadAction<string | null>) => {
            state.activeProjectId = action.payload;
            state.messages = []; // Clear messages when switching projects
            state.loading = true;
        },
        setMessages: (state, action: PayloadAction<Message[]>) => {
            state.messages = action.payload;
            state.loading = false;
        },
        addMessage: (state, action: PayloadAction<Message>) => {
            state.messages.push(action.payload);
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
            state.loading = false;
        }
    },
});

export const { setActiveProject, setMessages, addMessage, setLoading, setError } = projectChatSlice.actions;
export default projectChatSlice.reducer;

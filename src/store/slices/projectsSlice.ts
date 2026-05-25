import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// Define a type for the project
export interface Project {
    id?: string;
    name: string;
    category?: 'Development' | 'Digital Marketing' | 'Internal';
    logo: string;
    client: string;
    clientId?: string;
    clientEmail?: string;
    status: 'In Progress' | 'Planning' | 'Completed' | 'Pending';
    priority: 'Critical' | 'High' | 'Medium' | 'Low';
    progress: number;
    team: { name: string; avatar: string }[];
    startDate?: string;
    endDate?: string;
    budget: string;
    credentials: Record<string, any>;
    links: Record<string, any>;
    milestones?: any[];
    notes?: string;
    logoFit?: 'cover' | 'contain' | 'fill';
    devTeam?: { name: string; avatar: string; id?: string }[];
    qaTeam?: { name: string; avatar: string; id?: string }[];
    teamName?: string;
    lastTaskDate?: string;
    sentEmails?: {
        date: string;
        subject: string;
        sender: string;
        content: string;
        htmlContent?: string;
        attachmentCount?: number;
        attachments?: { name: string; url: string; type: string; taskName?: string }[];
    }[];
    receivedEmails?: {
        sender: string;
        subject: string;
        content: string;
        htmlContent?: string;
        date: string;
        receivedAt: string;
        messageId?: string;
    }[];
    assignedTeam?: string;
    assignedTeams?: string[];
    meetings?: {
        id: string;
        title: string;
        date: string;
        notes?: string;
        meetLink?: string;
        transcription?: string;
        transcriptionStatus?: 'processing' | 'completed' | 'failed';
        tasks?: { task: string; description: string }[];
        summary?: string;
    }[];
    upcomingMeeting?: string;
    lastMeeting?: string;
    resources?: {
        id: string;
        title: string;
        type: 'text' | 'file';
        content?: string;
        fileName?: string;
        createdBy: string;
        createdAt: string;
    }[];
    lastEmailSent?: {
        date: string;
        subject: string;
        sender: string;
    };
    trackerComment?: string;
    hasUnreadReplies?: boolean;
}

interface ProjectsState {
    items: Project[];
    loading: boolean;
    error: string | null;
}

const initialState: ProjectsState = {
    items: [],
    loading: false,
    error: null,
};

const projectsSlice = createSlice({
    name: 'projects',
    initialState,
    reducers: {
        setProjects: (state, action: PayloadAction<Project[]>) => {
            state.items = action.payload;
        },
        addProject: (state, action: PayloadAction<Project>) => {
            state.items.push(action.payload);
        },
        updateProject: (state, action: PayloadAction<Project>) => {
            const index = state.items.findIndex(p => p.id === action.payload.id || p.name === action.payload.name);
            if (index !== -1) {
                state.items[index] = action.payload;
            }
        },
        deleteProject: (state, action: PayloadAction<string>) => {
            state.items = state.items.filter(p => p.id !== action.payload && p.name !== action.payload);
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        }
    },
});

export const { setProjects, addProject, updateProject, deleteProject, setLoading } = projectsSlice.actions;

export default projectsSlice.reducer;

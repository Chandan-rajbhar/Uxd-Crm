import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { db } from 'src/firebase/config';
import { collection, getDocs, doc, setDoc, deleteDoc, query, where } from 'firebase/firestore';

export interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
    userId: string;
    followUpOrder?: number; // 1: First, 2: Second, etc.
}

interface EmailTemplatesState {
    templates: EmailTemplate[];
    loading: boolean;
    error: string | null;
}

const initialState: EmailTemplatesState = {
    templates: [],
    loading: false,
    error: null,
};

export const fetchTemplates = createAsyncThunk(
    'emailTemplates/fetchTemplates',
    async (userId: string) => {
        const q = query(collection(db, 'emailTemplates'), where('userId', '==', userId));
        const querySnapshot = await getDocs(q);
        const templates: EmailTemplate[] = [];
        querySnapshot.forEach((doc: any) => {
            templates.push({ id: doc.id, ...doc.data() } as EmailTemplate);
        });
        return templates;
    }
);

export const addTemplate = createAsyncThunk(
    'emailTemplates/addTemplate',
    async (template: Omit<EmailTemplate, 'id'>) => {
        const newTemplateRef = doc(collection(db, 'emailTemplates'));
        const cleanData = JSON.parse(JSON.stringify(template)); // Strip undefined
        const newTemplate = { id: newTemplateRef.id, ...cleanData };
        await setDoc(newTemplateRef, newTemplate);
        return newTemplate as EmailTemplate;
    }
);

export const updateTemplate = createAsyncThunk(
    'emailTemplates/updateTemplate',
    async (template: EmailTemplate) => {
        const templateRef = doc(db, 'emailTemplates', template.id);
        const { id, ...data } = template;
        const cleanData = JSON.parse(JSON.stringify(data)); // Strip undefined
        await setDoc(templateRef, cleanData, { merge: true });
        return template;
    }
);

export const deleteTemplate = createAsyncThunk(
    'emailTemplates/deleteTemplate',
    async (templateId: string) => {
        const templateRef = doc(db, 'emailTemplates', templateId);
        await deleteDoc(templateRef);
        return templateId;
    }
);

const emailTemplatesSlice = createSlice({
    name: 'emailTemplates',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchTemplates.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchTemplates.fulfilled, (state, action: PayloadAction<EmailTemplate[]>) => {
                state.loading = false;
                state.templates = action.payload;
            })
            .addCase(fetchTemplates.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to fetch templates';
            })
            .addCase(addTemplate.fulfilled, (state, action: PayloadAction<EmailTemplate>) => {
                state.templates.push(action.payload);
            })
            .addCase(updateTemplate.fulfilled, (state, action: PayloadAction<EmailTemplate>) => {
                const index = state.templates.findIndex(t => t.id === action.payload.id);
                if (index !== -1) {
                    state.templates[index] = action.payload;
                }
            })
            .addCase(deleteTemplate.fulfilled, (state, action: PayloadAction<string>) => {
                state.templates = state.templates.filter(t => t.id !== action.payload);
            });
    },
});

export default emailTemplatesSlice.reducer;

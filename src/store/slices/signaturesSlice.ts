import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { db } from 'src/firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface SignatureFormData {
    name: string;
    designation: string;
    phone: string;
    mobile: string;
    website: string;
    photoUrl: string;
    logoUrl?: string;
}

export interface EmailSignature {
    id: string;           // same as the userId
    userId: string;
    signatureHtml: string; // Generated HTML signature
    formData: SignatureFormData; // Structured form data for editing
    updatedAt: string;
}

interface SignaturesState {
    signature: EmailSignature | null;
    loading: boolean;
    error: string | null;
}

const initialState: SignaturesState = {
    signature: null,
    loading: false,
    error: null,
};

// Fetch signature for a specific user
export const fetchSignature = createAsyncThunk(
    'signatures/fetchSignature',
    async (userId: string) => {
        const docRef = doc(db, 'emailSignatures', userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as EmailSignature;
        }
        return null;
    }
);

// Save/update signature for a specific user
export const saveSignature = createAsyncThunk(
    'signatures/saveSignature',
    async ({ userId, signatureHtml, formData }: { userId: string; signatureHtml: string; formData: SignatureFormData }) => {
        const docRef = doc(db, 'emailSignatures', userId);
        const data = {
            userId,
            signatureHtml,
            formData: { ...formData },
            updatedAt: new Date().toISOString(),
        };

        try {
            console.log("Firestore: Attempting to save signature for user", userId);
            await setDoc(docRef, data);
            console.log("Firestore: Signature saved successfully!");
            return { id: userId, ...data } as EmailSignature;
        } catch (err: any) {
            console.error("Firestore: CRITICAL SAVE ERROR", err);
            throw err;
        }
    }
);

const signaturesSlice = createSlice({
    name: 'signatures',
    initialState,
    reducers: {
        clearSignature: (state) => {
            state.signature = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchSignature.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchSignature.fulfilled, (state, action: PayloadAction<EmailSignature | null>) => {
                state.loading = false;
                state.signature = action.payload;
            })
            .addCase(fetchSignature.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message || 'Failed to fetch signature';
            })
            .addCase(saveSignature.fulfilled, (state, action: PayloadAction<EmailSignature>) => {
                state.signature = action.payload;
            });
    },
});

export const { clearSignature } = signaturesSlice.actions;
export default signaturesSlice.reducer;

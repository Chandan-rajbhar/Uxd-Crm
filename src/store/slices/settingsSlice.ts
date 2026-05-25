import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface SettingsState {
    availableTeams: string[];
    loading: boolean;
    error: string | null;
}

const initialState: SettingsState = {
    availableTeams: [],
    loading: false,
    error: null,
};

const settingsSlice = createSlice({
    name: 'settings',
    initialState,
    reducers: {
        setAvailableTeams: (state, action: PayloadAction<string[]>) => {
            state.availableTeams = action.payload;
        },
        setSettingsLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setSettingsError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
        }
    },
});

export const { setAvailableTeams, setSettingsLoading, setSettingsError } = settingsSlice.actions;

export default settingsSlice.reducer;

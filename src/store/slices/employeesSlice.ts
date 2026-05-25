import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// Leave Record Interface for history tracking
export interface LeaveRecord {
    id: string;
    date: string;
    type: 'Full Day' | 'Half Day' | 'Sick' | 'Other';
    reason?: string;
    status: 'Approved' | 'Pending' | 'Rejected';
}

export interface Employee {
    id?: string;
    candidateId?: string; // Reference to original candidate record
    authUid?: string; // Links to Firebase Auth UID
    uid?: string; // Added as per fix instructions
    name: string;
    role: string;
    email: string;
    department: string;
    team?: string;
    isTeamLead?: boolean;
    isOnLeave: boolean;
    leaveDate?: string | null; // Date when marked on leave (for daily reset)
    leaveHistory?: LeaveRecord[]; // History of past leaves
    location: string;
    timezone: string;
    status: 'Active' | 'Away' | 'Offline' | 'Probation' | 'Inactive';
    lastActive?: string;
    projectIds: string[]; // IDs of assigned projects
    avatar?: string | null; // URL of the uploaded photo
    appPassword?: string; // Google App Password for BDE employees to send lead emails
    bdEmail?: string; // Optional email for BDE to use with app password
    permittedDevices?: number; // Max devices allowed for session tracking
    joiningDate?: string; // Optional joining date
    dateOfBirth?: string; // Optional date of birth
    employmentType?: 'Full Time' | 'Internship (Paid)' | 'Internship (Unpaid)' | 'Internship (Hybrid)' | 'Left';
    amendmentLetterUrl?: string | null;
    amendmentLetterSentAt?: string | null;
    amendmentSignedAt?: string | null;
    signedAmendmentLetterUrl?: string | null;
    amendmentPortalCode?: string | null;
    pendingEmploymentType?: 'Full Time' | 'Internship (Paid)' | 'Internship (Unpaid)' | 'Internship (Hybrid)' | 'Left' | null;
    internshipCompletionUrl?: string | null;
    relievingLetterUrl?: string | null;
    amendmentEffectiveDate?: string | null;
    amendmentNewSalary?: string | null;
}

interface EmployeesState {
    items: Employee[];
    loading: boolean;
    error: string | null;
}

const initialState: EmployeesState = {
    items: [],
    loading: false,
    error: null,
};

const employeesSlice = createSlice({
    name: 'employees',
    initialState,
    reducers: {
        setEmployees: (state, action: PayloadAction<Employee[]>) => {
            state.items = action.payload;
        },
        addEmployee: (state, action: PayloadAction<Employee>) => {
            state.items.push(action.payload);
        },
        updateEmployee: (state, action: PayloadAction<Employee>) => {
            const index = state.items.findIndex(e => e.id === action.payload.id);
            if (index !== -1) {
                state.items[index] = action.payload;
            }
        },
        deleteEmployee: (state, action: PayloadAction<string>) => {
            state.items = state.items.filter(e => e.id !== action.payload);
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setError: (state, action: PayloadAction<string | null>) => {
            state.error = action.payload;
        }
    },
});

export const { setEmployees, addEmployee, updateEmployee, deleteEmployee, setLoading, setError } = employeesSlice.actions;

export default employeesSlice.reducer;

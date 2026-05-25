import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, getIdTokenResult, type User } from 'firebase/auth';
import { auth } from '@/firebase/config';
import { registerSession } from '@/firebase/sessionService';
import { toast } from 'sonner';

type Role = 'admin' | 'employee' | 'client' | null;

interface AuthContextType {
    user: User | null;
    role: Role;
    loading: boolean;
    isAdmin: boolean;
    isEmployee: boolean;
    isClient: boolean;
    is2FAVerified: boolean;
    mfaEnabled: boolean;
    verify2FA: () => void;
    refreshRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    role: null,
    loading: true,
    isAdmin: false,
    isEmployee: false,
    isClient: false,
    is2FAVerified: false,
    mfaEnabled: false,
    verify2FA: () => { },
    refreshRole: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<Role>(null);
    const [loading, setLoading] = useState(true);
    const [is2FAVerified, setIs2FAVerified] = useState(false);
    const [mfaEnabled, setMfaEnabled] = useState(false);

    const refreshRole = async (currentUser: User) => {
        try {
            // Force refresh to get latest custom claims
            const tokenResult = await getIdTokenResult(currentUser, true);
            const userRole = tokenResult.claims.role as Role;
            const isVerified = tokenResult.claims.is2FAVerified as boolean;
            const mfaEnabled = tokenResult.claims.mfaEnabled as boolean;
            const isAdmin = userRole === 'admin';
            const effectiveMFA = mfaEnabled === true || isAdmin;

            setRole(userRole || null);
            setMfaEnabled(effectiveMFA);

            // Check if 2FA is needed
            if (effectiveMFA) {
                setIs2FAVerified(isVerified === true);
            } else {
                // If not enabled, always verified
                setIs2FAVerified(true);
            }
            return isAdmin;
        } catch (error) {
            console.error("Error fetching user role:", error);
            setRole(null);
            setIs2FAVerified(false);
            setMfaEnabled(false);
            return false;
        }
    };

    const verify2FA = () => {
        // No-op: client side cannot simply "verify" itself anymore.
        // This function is kept for interface compatibility but should not be called used for logic.
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const isAdmin = await refreshRole(currentUser);
                try {
                    await registerSession(currentUser.uid, isAdmin);
                } catch (e: any) {
                    if (e.message === 'DEVICE_BLOCK') {
                        console.error("User is blocked from all devices. Signing out.");
                        await auth.signOut();
                    } else if (e.message === 'DEVICE_LIMIT_REACHED') {
                        toast.error("Device limit reached. Please logout from other devices.");
                        await auth.signOut();
                    } else {
                        console.error("Failed to register session:", e);
                    }
                }
            } else {
                setRole(null);
                setIs2FAVerified(false);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const value = {
        user,
        role,
        loading,
        isAdmin: role === 'admin',
        isEmployee: role === 'employee',
        isClient: role === 'client',
        is2FAVerified,
        mfaEnabled,
        verify2FA,
        refreshRole: async () => {
            if (user) await refreshRole(user);
        }
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
interface AuthContextType {
    backendUserId: string | null;
    isLoading: boolean;
    error: string | null;
}

const AuthContext = createContext<AuthContextType>({
    backendUserId: null,
    isLoading: true,
    error: null,
});

export const useBackendAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useBackendAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { getToken, isSignedIn } = useAuth();
    const { user } = useUser();
    
    const [backendUserId, setBackendUserId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const syncedRef = useRef(false);

    useEffect(() => {
        const syncUser = async () => {
            // Skip if already synced or not signed in
            if (syncedRef.current || !isSignedIn || !user) {
                if (!isSignedIn) {
                    setIsLoading(false);
                }
                return;
            }

            try {
                setIsLoading(true);
                const token = await getToken();
                
                const response = await fetch(`${BACKEND_URL}/auth/sync-user`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (!response.ok) {
                    throw new Error('Failed to sync user');
                }

                const data = await response.json();
                
                if (data.uuid) {
                    setBackendUserId(data.uuid);
                    syncedRef.current = true;
                    
                    // Cache in sessionStorage for instant retrieval on page refresh
                    sessionStorage.setItem('backend_user_id', data.uuid);
                }
            } catch (err) {
                console.error("User sync failed:", err);
                setError(err instanceof Error ? err.message : 'Sync failed');
            } finally {
                setIsLoading(false);
            }
        };

        // Try to get from cache first for instant load
        const cachedUserId = sessionStorage.getItem('backend_user_id');
        if (cachedUserId && isSignedIn) {
            setBackendUserId(cachedUserId);
            setIsLoading(false);
            syncedRef.current = true;
        } else {
            syncUser();
        }
    }, [isSignedIn, user, getToken]);

    return (
        <AuthContext.Provider value={{ backendUserId, isLoading, error }}>
            {children}
        </AuthContext.Provider>
    );
};
/**
 * contexts/AuthContext.tsx
 * Replaces Clerk-based AuthContext with manual JWT auth context.
 * Exposes: isAuthenticated, userId, token, logout, isLoading.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentToken, getCurrentUserId, isAuthenticated as checkAuth, logout as authLogout } from '../services/auth';

interface AuthContextType {
    isAuthenticated: boolean;
    userId: string | null;
    token: string | null;
    isLoading: boolean;
    logout: () => void;
    /** Call after a successful login/register to refresh context state */
    refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType>({
    isAuthenticated: false,
    userId: null,
    token: null,
    isLoading: true,
    logout: () => {},
    refreshAuth: () => {},
});

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

/** @deprecated Use useAuth() instead — kept for backward compatibility */
export const useBackendAuth = () => {
    const { userId, isLoading } = useAuth();
    return { backendUserId: userId, isLoading, error: null };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [token, setToken] = useState<string | null>(getCurrentToken);
    const [userId, setUserId] = useState<string | null>(getCurrentUserId);
    const [isLoading, setIsLoading] = useState(false);

    const refreshAuth = () => {
        setToken(getCurrentToken());
        setUserId(getCurrentUserId());
    };

    const logout = () => {
        authLogout();
        setToken(null);
        setUserId(null);
    };

    // Listen for storage events (multi-tab sync)
    useEffect(() => {
        const handler = () => refreshAuth();
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, []);

    return (
        <AuthContext.Provider value={{
            isAuthenticated: !!token,
            userId,
            token,
            isLoading,
            logout,
            refreshAuth,
        }}>
            {children}
        </AuthContext.Provider>
    );
};
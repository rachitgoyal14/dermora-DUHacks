import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

import { lazy, Suspense } from 'react';

// Pages
const Login = lazy(() => import('./components/Login'));
const Home = lazy(() => import('./components/Home'));
const DetectPage = lazy(() => import('./components/DetectPage'));
const MindPage = lazy(() => import('./components/MindPage'));
const InsightsPage = lazy(() => import('./components/InsightsPage'));
const SignUpPage = lazy(() => import('./components/SignUpPage'));

// ── Protected route wrapper ──────────────────────────────────────────────────

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-400" />
            </div>
        );
    }

    return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
};

// ── App ──────────────────────────────────────────────────────────────────────

function AppRoutes() {
    const { isAuthenticated } = useAuth();

    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-400" />
            </div>
        }>
            <Routes>
                {/* Public: Login page (redirects to /home if already authed) */}
                <Route
                    path="/"
                    element={isAuthenticated ? <Navigate to="/home" replace /> : <Login />}
                />

                {/* Public: Sign-up page — Login.tsx now handles both modes, but keep route for compat */}
                <Route path="/sign-up" element={<SignUpPage />} />

                {/* Protected routes */}
                <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                <Route path="/skin" element={<ProtectedRoute><DetectPage /></ProtectedRoute>} />
                <Route path="/mind" element={<ProtectedRoute><MindPage /></ProtectedRoute>} />
                <Route path="/insights" element={<ProtectedRoute><InsightsPage /></ProtectedRoute>} />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
}

function App() {
    return (
        <AuthProvider>
            <ToastProvider position="top" maxToasts={3}>
                <Router>
                    <AppRoutes />
                </Router>
            </ToastProvider>
        </AuthProvider>
    );
}

export default App;
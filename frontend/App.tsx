import React, { useEffect, useState } from 'react';
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

// ── Global loading screen — matches Clay & Bone design system ────────────────
const GlobalLoader: React.FC = () => {
    const [visible, setVisible] = useState(false);
    useEffect(() => { const t = setTimeout(() => setVisible(true), 40); return () => clearTimeout(t); }, []);

    return (
        <div
            className="min-h-screen flex flex-col items-center justify-center gap-6"
            style={{
                backgroundColor: 'var(--color-bone-50)',
                opacity: visible ? 1 : 0,
                transition: 'opacity 300ms ease',
            }}
        >
            {/* Spinner — clay-500 to match primary accent */}
            <div
                className="rounded-full"
                style={{
                    width: 44,
                    height: 44,
                    border: '3px solid color-mix(in srgb, var(--color-clay-500) 18%, transparent)',
                    borderTopColor: 'var(--color-clay-500)',
                    animation: 'spin 0.9s linear infinite',
                }}
            />
            <div className="text-center">
                <p
                    className="text-2xl tracking-tight"
                    style={{ fontFamily: 'var(--font-display)', color: 'var(--color-ink-900)' }}
                >
                    dermora
                </p>
                <p
                    className="text-sm mt-1"
                    style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-ink-500)' }}
                >
                    Loading…
                </p>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
};

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) return <GlobalLoader />;

    return isAuthenticated ? <>{children}</> : <Navigate to="/" replace />;
};

// ── App ──────────────────────────────────────────────────────────────────────

function AppRoutes() {
    const { isAuthenticated } = useAuth();

    return (
        <Suspense fallback={<GlobalLoader />}>
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
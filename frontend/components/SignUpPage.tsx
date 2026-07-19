/**
 * SignUpPage.tsx
 * Redirects to Login (which now handles both login + register via a tab toggle).
 */
import React from 'react';
import { Navigate } from 'react-router-dom';

const SignUpPage: React.FC = () => {
    // Login.tsx now handles both login and register via mode toggle.
    return <Navigate to="/" replace />;
};

export default SignUpPage;

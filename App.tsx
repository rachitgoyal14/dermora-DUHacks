import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ClerkProvider, SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';

// Pages
import Home from './components/Home';
import DetectPage from './components/DetectPage';
import MindPage from './components/MindPage';
import InsightsPage from './components/InsightsPage';
import SignUpPage from './components/SignUpPage';

// Clerk Publishable Key
const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CLERK_PUBLISHABLE_KEY) {
  throw new Error('Missing Clerk Publishable Key');
}

function App() {
  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <AuthProvider>
        <ToastProvider position="top" maxToasts={3}>
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/sign-up" element={<SignUpPage />} />
              
              {/* Protected Routes */}
              <Route
                path="/home"
                element={
                  <SignedIn>
                    <Home />
                  </SignedIn>
                }
              />
              
              <Route
                path="/skin"
                element={
                  <SignedIn>
                    <DetectPage />
                  </SignedIn>
                }
              />
              
              <Route
                path="/mind"
                element={
                  <SignedIn>
                    <MindPage />
                  </SignedIn>
                }
              />
              
              <Route
                path="/insights"
                element={
                  <SignedIn>
                    <InsightsPage />
                  </SignedIn>
                }
              />
              
              {/* Redirect */}
              <Route
                path="/"
                element={
                  <>
                    <SignedIn>
                      <Navigate to="/home" replace />
                    </SignedIn>
                    <SignedOut>
                      <RedirectToSignIn />
                    </SignedOut>
                  </>
                }
              />
            </Routes>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </ClerkProvider>
  );
}

export default App;
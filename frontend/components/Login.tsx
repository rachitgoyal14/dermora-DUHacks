import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login, register } from '../services/auth';
import { useAuth } from '../contexts/AuthContext';
import SkinLayersVisual from './SkinLayersVisual';

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { refreshAuth } = useAuth();

    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            if (mode === 'login') {
                await login(email, password);
            } else {
                await register(email, password, fullName || undefined);
            }
            refreshAuth();
            navigate('/home');
        } catch (err: any) {
            setError(err.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 w-full h-full bg-[#FFF5F5] font-sans text-skin-text flex flex-col justify-between overflow-hidden">

            {/* Top Section: Visual & Logo */}
            <div className="flex-1 w-full flex items-center justify-center relative min-h-[40%]">
                <h1 className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 font-display text-5xl font-bold tracking-tight text-[#1A1A1A] z-30 whitespace-nowrap">
                    Dermora.ai
                </h1>
                <div className="w-full max-w-[400px] aspect-square flex items-center justify-center relative z-0">
                    <div className="transform scale-110 opacity-100">
                        <SkinLayersVisual size="lg" variant="clean" />
                    </div>
                </div>
            </div>

            {/* Bottom Section: Auth Form */}
            <div className="w-full bg-white rounded-t-[3rem] shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.05)] px-8 pt-10 pb-12 flex flex-col items-center gap-4 z-20 min-h-[50%]">

                {/* Mode toggle */}
                <div className="flex w-full max-w-sm rounded-full bg-gray-100 p-1 mb-2">
                    <button
                        type="button"
                        onClick={() => { setMode('login'); setError(null); }}
                        className={`flex-1 py-2 rounded-full text-sm font-medium transition-all ${mode === 'login' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                    >
                        Log In
                    </button>
                    <button
                        type="button"
                        onClick={() => { setMode('register'); setError(null); }}
                        className={`flex-1 py-2 rounded-full text-sm font-medium transition-all ${mode === 'register' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
                    >
                        Sign Up
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-3">
                    {mode === 'register' && (
                        <input
                            id="full-name"
                            type="text"
                            placeholder="Full Name (optional)"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-300"
                        />
                    )}

                    <input
                        id="email"
                        type="email"
                        placeholder="Email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-300"
                    />

                    <input
                        id="password"
                        type="password"
                        placeholder="Password"
                        required
                        minLength={6}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-300"
                    />

                    {error && (
                        <p className="text-red-500 text-xs text-center">{error}</p>
                    )}

                    <button
                        id="auth-submit"
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-black text-white text-sm font-medium hover:bg-gray-900 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;

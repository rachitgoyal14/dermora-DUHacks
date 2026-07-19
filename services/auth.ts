/**
 * services/auth.ts
 * Manual email/password auth service — replaces Clerk.
 * Token is stored in both memory and localStorage (key: dermora_token).
 */

const BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
const TOKEN_KEY = 'dermora_token';
const USER_ID_KEY = 'dermora_user_id';

// ── In-memory token store (fastest lookup) ──────────────────────────────────
let _token: string | null = null;
let _userId: string | null = null;

// ── Initialise from localStorage on module load ─────────────────────────────
_token = localStorage.getItem(TOKEN_KEY);
_userId = localStorage.getItem(USER_ID_KEY);

// ── Helpers ──────────────────────────────────────────────────────────────────

export function getCurrentToken(): string | null {
    return _token;
}

export function getCurrentUserId(): string | null {
    return _userId;
}

export function isAuthenticated(): boolean {
    return !!_token;
}

function _persist(token: string, userId: string) {
    _token = token;
    _userId = userId;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_ID_KEY, userId);
}

// ── Auth API calls ───────────────────────────────────────────────────────────

export interface AuthResponse {
    access_token: string;
    token_type: string;
    user_id: string;
}

export async function register(email: string, password: string, fullName?: string): Promise<AuthResponse> {
    const res = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Registration failed' }));
        throw new Error(err.detail || 'Registration failed');
    }

    const data: AuthResponse = await res.json();
    _persist(data.access_token, data.user_id);
    return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Invalid email or password' }));
        throw new Error(err.detail || 'Invalid email or password');
    }

    const data: AuthResponse = await res.json();
    _persist(data.access_token, data.user_id);
    return data;
}

export function logout(): void {
    _token = null;
    _userId = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_ID_KEY);
}

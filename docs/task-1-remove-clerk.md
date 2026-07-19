# Task 1: Remove Clerk, Implement Manual Authentication

## Context

The project currently references Clerk (`VITE_CLERK_PUBLISHABLE_KEY` in `.env`, `frontend/src/components/Login.tsx`) but the backend has **no actual Clerk JWT verification middleware** — every endpoint trusts a raw `user_id` passed as a query/path param with zero verification. Clerk was a planned-but-abandoned direction. We are now dropping it entirely in favor of simple manual email/password auth owned by our own backend.

All backend routers (`skin.py`, `mood.py`, `voice.py`, `reports.py`) currently accept `user_id: UUID` as an explicit parameter on every route. This pattern should be preserved structurally, but `user_id` should come from a verified session/token instead of being client-supplied.

## Goal

Replace Clerk with a self-hosted email/password auth system:
- User registration (hashed password storage)
- Login issuing a JWT (or session token)
- A `get_current_user` FastAPI dependency that all protected routes use instead of accepting raw `user_id`
- Frontend: replace `Login.tsx`'s Clerk components with a real login/signup form, store the token, attach it to all API calls

## Backend Tasks

1. **Remove Clerk entirely:**
   - Delete any Clerk-related imports/config.
   - Remove `VITE_CLERK_PUBLISHABLE_KEY` and any Clerk-related backend env vars.

2. **`users` table** — confirm/add columns:
   ```sql
   ALTER TABLE users
     ADD COLUMN IF NOT EXISTS hashed_password TEXT,
     ADD COLUMN IF NOT EXISTS email TEXT UNIQUE;
   ```
   (Some of this may already exist per earlier schema dumps — check first, don't duplicate.)

3. **New file `backend/app/core/security.py`:**
   - `hash_password(password: str) -> str` using `passlib[bcrypt]` (add to `requirements.txt` if missing).
   - `verify_password(plain: str, hashed: str) -> bool`
   - `create_access_token(user_id: UUID) -> str` using `python-jose` or `pyjwt`, signed with a `JWT_SECRET_KEY` from `.env`, expiry via `JWT_EXPIRE_MINUTES` (default 10080 = 7 days).
   - `decode_access_token(token: str) -> UUID` — raises `HTTPException(401)` on invalid/expired token.

4. **New file `backend/app/core/dependencies.py`:**
   ```python
   from fastapi import Depends, HTTPException, Header
   from uuid import UUID
   from app.core.security import decode_access_token

   async def get_current_user_id(authorization: str = Header(...)) -> UUID:
       if not authorization.startswith("Bearer "):
           raise HTTPException(401, "Invalid authorization header")
       token = authorization.removeprefix("Bearer ").strip()
       return decode_access_token(token)
   ```

5. **New router `backend/app/routers/auth.py`** (replace whatever placeholder exists):
   - `POST /auth/register` — body: `{email, password}`. Hash password, insert user, return access token.
   - `POST /auth/login` — body: `{email, password}`. Verify password, return access token.
   - `GET /auth/me` — protected by `get_current_user_id`, returns the current user's profile.

6. **Migrate every protected route** in `skin.py`, `mood.py`, `voice.py`, `reports.py`:
   - Change signature from taking `user_id: UUID` as a path/query param to using `user_id: UUID = Depends(get_current_user_id)` instead, **wherever the route is meant to act on "the logged-in user."**
   - ⚠️ Judgment call needed: some routes may legitimately need to accept a `user_id` path param even post-auth (e.g. an admin viewing another user's data) — for this app, assume NOT, and convert all of them to use the dependency. Flag any route where this breaks an existing frontend contract instead of silently changing the URL shape without noting it in your summary.
   - This changes URLs like `GET /voice/prompt/{user_id}` → `GET /voice/prompt` (user comes from token, not URL). Update accordingly and note every URL that changed.

7. **`.env` additions:**
   ```
   JWT_SECRET_KEY=<generate a random 32+ char string>
   JWT_EXPIRE_MINUTES=10080
   ```

## Frontend Tasks

1. **`services/auth.ts` (new file):**
   - `register(email, password)`, `login(email, password)` — call `/auth/register` / `/auth/login`, store returned token.
   - Store token in memory + `localStorage` (key: `dermora_token`).
   - `logout()` — clear stored token.
   - `getCurrentToken()` helper.

2. **`services/api.ts`:**
   - Add an Axios request interceptor that attaches `Authorization: Bearer <token>` to every request automatically.
   - Remove `userId` parameters from every exported function that previously took one explicitly (e.g. `getVoicePrompt(userId)` → `getVoicePrompt()`), since the backend now derives it from the token. Update all call sites.

3. **`components/Login.tsx`:**
   - Replace Clerk's `<SignIn>`/`<SignUp>` components with plain controlled email/password form(s), toggle between login and register modes.
   - On success, store token via `services/auth.ts`, navigate to `/home`.

4. **Route protection:** Add a simple `<ProtectedRoute>` wrapper in `App.tsx` that redirects to `/` (login) if no token is present, wrapping `/home`, `/detect`, `/mood`, `/solace`.

5. **Remove `USER_ID` hardcoded constants** from `SolacePage.tsx` and anywhere else — the backend now infers the user from the token.

## Testing Checklist
- [ ] `POST /auth/register` creates a user and returns a token
- [ ] `POST /auth/login` with correct credentials returns a token; wrong password returns 401
- [ ] Any protected endpoint called without a token returns 401
- [ ] Any protected endpoint called with a valid token succeeds and returns data scoped to that user
- [ ] Frontend: registering → auto-logged-in → navigating to `/solace` fetches the prompt without manually passing a user ID anywhere
- [ ] Logging out and trying to hit a protected page redirects to login

## Deliverable
List every backend URL whose shape changed (path param removed) so the person can update any bookmarked API calls, Postman collections, or docs.
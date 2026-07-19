# Task 4: Performance & UI Improvements

## Context

This is a broader, more open-ended task than the others. The app currently works functionally (skin analysis, mood tracking, weekly reports, Solace voice agent) but has accumulated dev-mode rough edges: debug overlays left in production-facing components, no code-splitting, synchronous/blocking patterns in a few places, and UI that was built incrementally without a cohesive design pass. Treat this as two separate work-streams — **performance** and **UI** — and report progress on each separately since they have different risk profiles (performance changes can introduce subtle bugs; UI changes are mostly safe/reversible).

## Part A: Performance

### A1. Remove/gate debug overlays
`SolacePage.tsx` currently renders a permanent debug panel (`Status`, `Mood`, `Score`, raw debug messages) in production. Wrap it in a dev-only flag:
```typescript
const DEBUG_MODE = import.meta.env.DEV;
// ...
{DEBUG_MODE && (
  <div className="absolute top-4 left-4 ...">...</div>
)}
```
Audit other components for similar `console.log`-heavy or debug-UI patterns left over from earlier debugging sessions in this project's history and apply the same gating.

### A2. Canvas visualizer efficiency
The waveform visualizer in `SolacePage.tsx` runs a `requestAnimationFrame` loop doing trigonometric sine-wave calculations on every frame regardless of whether it's producing a meaningfully different frame (e.g., in `idle` state, the animation still runs at full rate). Throttle or pause the animation loop when `status === 'idle'` and the canvas is visually static, resuming only when `status` changes. This also helps Task 3 (voice cracking) by freeing main-thread cycles during active audio sessions.

### A3. Frontend bundle / routing
- Confirm `App.tsx`'s routes are using `React.lazy()` + `Suspense` for page-level code splitting (`DetectPage`, `SolacePage`, `MoodPage` are all reasonably heavy — DINOv2-adjacent upload UI, Gemini SDKs, canvas rendering — none of this needs to be in the initial bundle for `/` (Login) or `/home`).
- Check `vite.config.ts` for `build.rollupOptions.output.manualChunks` — split `@google/genai` / `@google/generative-ai` into their own chunk since they're only needed on `/solace` and `/detect`.

### A4. API call efficiency
- Audit `services/api.ts` consumers for any component that fires multiple sequential `await api.get(...)` calls that could be parallelized with `Promise.all`.
- Confirm the weekly-report caching behavior (backend already caches per `user_id + week_start` — see `report_generator.py`) is actually being leveraged by the frontend, i.e. the frontend isn't passing `force_regenerate=true` anywhere it shouldn't be, and isn't re-fetching the report on every render/mount without a cache check of its own (e.g. React Query or a simple in-memory cache) if the report page is visited repeatedly in one session.
- Consider introducing `@tanstack/react-query` (or confirm if already present) for automatic request deduplication/caching across `getSkinHistory`, `getImprovementTracker`, `getWeeklyReport` — these are all read-heavy, infrequently-changing endpoints that are good caching candidates. This is a judgment call on scope — implement if the codebase doesn't already have a data-fetching library, otherwise just tighten existing `useEffect` dependency arrays to avoid redundant fetches.

### A5. Image handling
- Confirm uploaded images are compressed/resized client-side before upload (large phone camera photos, e.g. 4000×3000px, are unnecessary for a DINOv2 model that almost certainly resizes to a small fixed input size anyway, e.g. 224×224 or 384×384 — check `backend/app/models/transforms.py` for the actual expected input size). If no client-side resize exists, add one (canvas-based resize before `FormData` upload) to cut upload time and R2 storage costs (relevant now that Task 2 moves storage to R2).

## Part B: UI Improvements

### B1. Consistency pass
Audit color usage across `Home.tsx`, `DetectPage.tsx`, `MoodPage.tsx`, `SolacePage.tsx` — confirm they share a consistent palette/gradient language (the existing Solace gradient is `from-[#FFF0F0] via-[#FDF5E6] to-[#F8F9FF]` with purple/pink accent buttons). If other pages use a visually disconnected palette, either intentionally differentiate by feature area (acceptable) or unify into a shared design token set (e.g. a `tailwind.config.js` custom color palette) — agent should inspect current state first and report which approach fits before making sweeping changes.

### B2. Loading & empty states
Check each data-fetching page (`DetectPage`, `MoodPage`, report views, improvement tracker view if one exists in the frontend) for:
- A proper loading skeleton/spinner instead of a blank screen during fetch
- A meaningful empty state (e.g. "No skin images yet — upload your first photo" rather than a blank chart) when a new user has no data
- Error states that surface backend error messages in a user-friendly way rather than raw `console.error` only

### B3. Mobile responsiveness
Confirm all pages render correctly at common mobile viewport widths (375px, 390px, 414px) — this is a health app likely to be used primarily on phones. Pay particular attention to:
- `SolacePage`'s canvas visualizer sizing (`width={400} height={256}` is currently fixed pixel dimensions, not responsive)
- Any data tables/grids in report or history views that might overflow on narrow screens

### B4. Micro-interactions
The Solace page already has `framer-motion` in use for button taps and fade-ins. Extend this consistently to other pages if they lack any transition/motion polish (page-load fade-ins, button press feedback, skeleton-to-content transitions).

### B5. Report/insight display polish
The AI-generated weekly report HTML (`report_generator.py`'s `generate_html_report`) is currently a fully separate styled HTML document meant for a WebView. If the frontend is now rendering this natively (not in a WebView) rather than via `<iframe>`/WebView, consider whether it should instead be rendered as native React components consuming the structured JSON (`key_insights`, `recommendations`, `metrics`) for better integration with the rest of the app's UI system, rather than an embedded styled HTML blob. **Flag this as a larger architectural decision** rather than executing it automatically — ask before ripping out the HTML-generation approach, since the backend caching strategy (Task from earlier conversation) was built around serving that HTML directly.

## Deliverable
Since this task is broad, produce a before/after summary organized by the A1–A5 / B1–B5 subsections above, noting which were completed, which were judgment calls made a particular way (and why), and which were flagged back to the human rather than auto-decided (especially B5).
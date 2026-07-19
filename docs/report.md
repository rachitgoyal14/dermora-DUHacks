# Dermora — Implementation Report

**Project:** AI-powered dermatology + mental health companion app
**Stack:** FastAPI + SQLAlchemy (async) + NeonDB (Postgres) | React/TypeScript frontend
**Purpose of this doc:** Snapshot of everything built, so the system can be understood and resumed without re-deriving decisions from scratch.

---

## 1. High-Level Architecture

```
┌─────────────────┐       ┌──────────────────────┐       ┌────────────────┐
│  React Frontend │──────▶│   FastAPI Backend     │──────▶│  NeonDB (PG)   │
│  (TypeScript)   │◀──────│   (async SQLAlchemy)  │◀──────│                │
└─────────────────┘       └──────────────────────┘       └────────────────┘
        │                          │
        │                          ├──▶ DINOv2 (local .pth) — skin classification
        │                          ├──▶ Azure OpenAI (GPT-4o/mini) — vision comparison,
        │                          │     weekly report generation, medical advice text
        │                          └──▶ STT + LLM — voice mood inference pipeline
        │
        └──▶ Gemini Live API (client-side, direct) — voice-to-voice therapy conversations
```

Two different AI vendors are used for two different jobs and this is intentional:
- **Azure OpenAI**: server-side, used for anything that needs to read images/JSON and produce structured medical-style output (severity scoring, comparisons, reports).
- **Gemini Live**: client-side only, used purely for the real-time voice conversation UX in Solace. The backend never touches Gemini Live directly — it only decides *what prompt* Gemini should be given.

---

## 2. Database Schema

| Table | Purpose |
|---|---|
| `users` | Core identity (UUID PK). Originally planned for Google OAuth → Clerk, currently unauthenticated with a hardcoded test UUID (`00000000-0000-0000-0000-000000000000`). |
| `mood_logs` | Emoji-based mood check-ins: `mood_score`, `stress`, `anxiety`, `sadness`, `energy`. Written by both the frontend mood questionnaire and the voice mood-inference pipeline. |
| `skin_images` | Uploaded photos. `image_type` constrained to `initial`, `weekly`, `before`, `progress`, `after`. Stored on local disk (`uploads/skin_images/`), URL saved as a relative path — **not yet migrated to S3/Cloudinary**. |
| `skin_diagnoses` | One row per image: DINOv2 `prediction` + `confidence`, plus optional Azure-derived `severity_score`, `redness_level`, `texture_roughness`, `affected_area_percentage`. |
| `user_medical_profiles` | Static medical context (age, gender, primary concern, triggers, treatment). Collected but not yet wired into the report generator's prompt context. |
| `improvement_records` | One row per user per week. Caches: primary condition, average severity/confidence, improvement %, trend direction, medical advice, urgency flag, linked before/after image IDs. Recomputed lazily when the improvement tracker endpoint is called with no cached row for that week. |
| `weekly_reports` | AI-generated weekly report cache: `report_html`, `condition_summary`, `key_insights` (JSONB), `recommendations` (JSONB), `metrics` (JSONB). Generated once per (user, week_start) pair and reused on subsequent reads — this was an explicit optimization (see §5). |
| `voice_sessions` | Reserved for logging Solace conversation sessions (summary, mood delta, duration). Present in schema; not yet actively written to by the current voice pipeline — mood is logged directly to `mood_logs` instead. |

All tables use `uuid_generate_v4()` PKs and `TIMESTAMP WITH TIME ZONE` for temporal fields.

---

## 3. Backend Modules

### 3.1 Skin Analysis (`routers/skin.py`)
- `POST /skin/infer` — legacy endpoint, raw DINOv2 inference only, no persistence. Kept for backward compatibility.
- `POST /skin/upload` — full pipeline: save file → DINOv2 inference → optional Azure Vision analysis → persist `skin_images` + `skin_diagnoses`.
- `POST /skin/analyze/{image_id}` — re-run Azure Vision on an already-stored image.
- `POST /skin/compare` — Azure Vision side-by-side comparison of two images (severity delta, redness/texture change, recommendations).
- `GET /skin/progress/{user_id}/comparison` — auto-compares consecutive images across a time window.
- `GET /skin/improvement-tracker/{user_id}` — full weekly breakdown + medical advice + best/worst week (see §3.2).
- `DELETE /skin/image/{image_id}`

**Comparison methodology decision:** Originally planned around Azure Computer Vision requiring same-body-part photos. Settled on **Azure OpenAI Vision (GPT-4o/mini) as a general-purpose comparator** instead — it doesn't require exact body-part matching, returns structured severity/redness/texture deltas, and doubles as the report-writing engine, avoiding a second vendor integration. Alternative approaches considered and rejected for MVP: DINOv2 embedding cosine-similarity (cheap but not clinically interpretable), lesion segmentation (too much training data needed), raw color-histogram diffing (too lighting-sensitive).

### 3.2 Improvement Tracking (`services/improvement_analyzer.py`)
- Buckets images into Monday–Sunday weeks.
- For each week: pulls all diagnoses, computes average confidence, most-common condition (`Counter.most_common`).
- Compares consecutive weeks via Azure Vision image comparison when available; falls back to confidence-delta comparison if Azure is unavailable or fails.
- Trend classification: `improving` (>+10%), `worsening` (<-10%), `stable` (in between).
- **Medical advice engine** (rule-based, not LLM): averages improvement over the last 4 weeks and maps it to one of four canned advice tiers, each with a `needs_doctor_visit` boolean and `urgency_level` (low/medium/high). This was a deliberate choice to keep medical-advice logic deterministic and auditable rather than LLM-generated (LLM is reserved for narrative report text, not the doctor-referral decision itself).
- Weekly computations are cached in `improvement_records`; `POST /skin/improvement-tracker/{user_id}/refresh` force-recomputes.

### 3.3 Weekly Reports (`services/report_generator.py`, `routers/reports.py`)
- `GET /reports/weekly/{user_id}` — gathers the week's context (images, diagnoses, current vs. previous week improvement data) into a JSON blob, sends it to Azure OpenAI with a structured prompt, and parses the JSON response into: `report_title`, `condition_summary`, `key_insights[]`, `recommendations[]`, `metrics_interpretation`, `next_steps`.
- Renders a self-contained, styled HTML document server-side (gradient header, color-coded insight cards, priority-badged recommendations, metrics grid) — designed to be dropped straight into a mobile WebView.
- `GET /reports/weekly/{user_id}/html` — returns that HTML directly.
- **Caching optimization:** both endpoints check `weekly_reports` for an existing row before calling Azure. First call generates + persists (HTML, insights, recommendations, metrics all stored as columns/JSONB); every subsequent call for the same `(user_id, week_start)` reads straight from Postgres — no duplicate LLM spend. `force_regenerate=true` bypasses the cache. This halved report-related Azure costs relative to the naive first implementation (which had `/html` internally re-calling the JSON endpoint's generation logic every time).
- PDF export (`report_pdf_url`) is schema-ready but **not implemented** — HTML-to-PDF rendering (e.g. WeasyPrint) is the next step if needed.

### 3.4 Mood Voice Agent (`routers/voice.py`, `services/voice_prompt_selector.py`, `services/mood_inference_service.py`)
Two-endpoint design, cleanly separating "what to say" from "what was heard":

**a) Prompt selection — `GET /voice/prompt/{user_id}`**
- Pulls `mood_logs` from the last 7 days, averages `mood_score`.
- Maps the average into one of 6 bands (severe_low 0–20 → high 85–100), each with a full hand-written system prompt (crisis support, emotional support, gentle encouragement, balanced check-in, positive reinforcement, celebration) plus a suggested session duration and a `follow_up_recommended` flag.
- Defaults to the neutral band if no mood history exists yet.
- Prompts are static Python dicts, not LLM-generated — this keeps therapeutic tone consistent and reviewable, and avoids the failure mode of an LLM improvising unsafe mental-health framing.
- `GET /voice/prompt-preview/{mood_score}` and `GET /voice/mood-categories` exist purely for testing/debugging the band logic without needing real mood history.

**b) Mood inference from conversation — `POST /voice/mood/analyze`**
- Accepts an audio file (webm from the browser's `MediaRecorder`).
- Pipeline: normalize audio via `ffmpeg` (mono, 16kHz, PCM s16le — required for reliable STT) → transcribe (`utils/stt.py`) → send transcript to an LLM with a strict "return JSON only" prompt scoring `stress`, `anxiety`, `sadness`, `energy` (0–100 each) → compute a composite `mood_score` via a fixed weighted formula (`100 − (0.4·stress + 0.3·anxiety + 0.3·sadness) + 0.5·energy`, clamped 0–100) → write to `mood_logs`.
- The composite formula, not just the LLM's raw output, is what's persisted — keeping the score computation deterministic and inspectable even though the four inputs are LLM-derived.

### 3.5 Auth
Not implemented. Originally planned Google OAuth → pivoted to Clerk (better multi-provider/mobile SDK support), but Clerk middleware (`get_current_user_id` dependency, JWT verification, `users.clerk_user_id` mapping) was **never built**. All endpoints currently take `user_id` as a raw path/query parameter with no verification. This is the single largest gap before any real multi-user deployment.

---

## 4. Frontend

### 4.1 API layer (`services/api.ts`)
Thin Axios wrapper (`baseURL: http://localhost:8000`) exposing typed functions per domain: skin upload/history/improvement-tracker, mood log/questions, voice prompt/mood-analysis, weekly report. All interfaces mirror the backend Pydantic response shapes.

### 4.2 Gemini integration (`services/gemini.ts`)
Two distinct usage patterns coexist in this file:
- **Text-mode Gemini** (`getGeminiStream`, `getGeminiResponse`, `analyzeSkinWithGemini`) — uses `@google/generative-ai`, older/simpler SDK, used for streaming chat and a client-side Gemini vision fallback for skin analysis.
- **Live voice-mode Gemini** (`connectToSolaceLive`) — uses `@google/genai` (the newer SDK with `.live.connect`), model `gemini-2.5-flash-native-audio-preview-09-2025`. Streams 16kHz PCM mic audio to Gemini via `ScriptProcessorNode` (deprecated API, functional but flagged for future `AudioWorkletNode` migration), receives 24kHz PCM audio back, decodes it into `AudioBuffer`s for playback, and surfaces live input/output transcripts. Voice fixed to `'Aoede'` (calm/empathetic preset). System prompt is **never hardcoded here** — it's always the string returned by the backend's `/voice/prompt/{user_id}`.
- A `MediaRecorder` runs in parallel to the raw PCM stream, capturing only the user's mic input as a `webm/opus` blob for later upload to `/voice/mood/analyze` — the Live API audio path and the mood-analysis recording path are intentionally separate concerns.

### 4.3 SolacePage.tsx
State machine: `idle → loading → connected ⇄ speaking/processing → idle`.
- On mount: fetches the mood-aware prompt.
- On "Start Session": opens `connectToSolaceLive` with that prompt; guards against duplicate connections (a real bug hit during dev — see §6).
- Canvas-based waveform visualizer reacts to `status` (amplitude/speed/color per state) — cosmetic, no real audio analysis feeding it yet (uses a sine-wave animation, not the actual `AnalyserNode` data, despite `getAnalyser()` being exposed).
- On "End Session": stops the recorder, disconnects the Live session, uploads the recorded blob to `/voice/mood/analyze`, displays the resulting mood score.
- Debug overlay (mood category/score, status, last message) present in the current build — flagged as dev-only, should be stripped before any real ship.

### 4.4 Earlier iteration (superseded)
The very first SolacePage implementation used the **browser's native Web Speech API** (`SpeechRecognition` + `speechSynthesis`) combined with text-mode `getGeminiStream`, manually splitting streamed text into sentences and queueing them through `SpeechSynthesisUtterance`. This was replaced with the Gemini Live approach for lower latency and a more natural conversational feel, but the text-streaming functions remain in `gemini.ts` and are still used elsewhere (e.g. general chat, if present).

---

## 5. Notable Engineering Decisions & Trade-offs

| Decision | Reasoning |
|---|---|
| Report HTML generated & cached server-side, not client-rendered | Lets the exact same HTML serve both an in-app WebView and (eventually) a PDF export from one source of truth; avoids re-implementing the report layout twice. |
| Medical advice is rule-based, report narrative is LLM-based | Keeps the "should this person see a doctor" decision deterministic and testable; reserves the LLM for language generation, not clinical judgment calls. |
| Mood score is a fixed formula over LLM-scored sub-dimensions, not a single LLM-assigned number | Makes the final number reproducible and debuggable; the LLM's job is narrower (rate 4 independent dimensions from text) rather than holistic scoring. |
| Voice system prompts are hand-authored per mood band, not generated per-session | Predictable therapeutic tone; avoids an LLM improvising crisis-response language. |
| Azure OpenAI Vision chosen over Azure Computer Vision for skin comparison | Removes the "must photograph the exact same body part" UX constraint; one vendor call produces both structured metrics and human-readable clinical language. |
| Gemini Live kept entirely client-side | Backend never needs to proxy audio streams; only supplies the system prompt. Simpler backend, though it does mean the Gemini API key is exposed client-side (see §6). |

---

## 6. Known Issues / Technical Debt

1. **No authentication.** Every endpoint trusts a client-supplied `user_id`. Clerk integration was planned (schema has `clerk_user_id` groundwork) but never implemented.
2. **Gemini API key is hardcoded and shipped client-side** in `gemini.ts`. Fine for a hackathon demo, not production-safe — needs to move behind a backend proxy or ephemeral token exchange.
3. **React StrictMode double-invocation bug**: caused `connectToSolaceLive` to open two WebSocket connections in dev, with the second killing the first mid-handshake (visible as "connected" immediately followed by "disconnected" in logs). Fixed via a connection lock (`isConnectingRef`) plus stopping the audio processor (`processor.onaudioprocess = null`) *before* closing the session, rather than after.
4. **`ScriptProcessorNode` deprecation** — functional today, flagged by Chrome as deprecated in favor of `AudioWorkletNode`. Not urgent but will eventually need migration.
5. **Local disk storage for images** (`uploads/skin_images/`) — no cloud storage (S3/Cloudinary) integration yet; won't survive a redeploy or scale past a single instance.
6. **PDF export** — schema field (`report_pdf_url`) exists, generation logic does not.
7. **`voice_sessions` table** is defined but currently unused; mood data goes straight to `mood_logs` instead, bypassing per-session grouping.
8. **`user_medical_profiles`** data is collected but not yet fed into the weekly report or improvement-tracker LLM prompts — a clear next step for personalization.
9. **CORS** had to be manually added (`CORSMiddleware` was missing initially) — confirm it's still present on restart.
10. **Azure deployment name drift risk** — `.env` at one point referenced `gpt-4.1-mini`; confirm the currently-configured deployment name actually exists in the Azure resource before assuming reports/vision will work.

---

## 7. Suggested Next Steps (Priority Order)

1. Implement Clerk auth middleware and wire `user_id` extraction from verified JWTs instead of trusting client input.
2. Move Gemini API key server-side (short-lived token minting endpoint, or full audio proxy through the backend).
3. Migrate skin image storage to S3/Cloudinary.
4. Wire `user_medical_profiles` into the report-generation prompt context.
5. Implement PDF export for weekly reports (WeasyPrint or similar, reusing the existing HTML template).
6. Migrate `ScriptProcessorNode` → `AudioWorkletNode`.
7. Decide whether `voice_sessions` should replace/supplement direct `mood_logs` writes for better per-conversation analytics.
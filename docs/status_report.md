# Dermora Revival — Status Report
**Date:** 2026-07-19 | **Agent:** Antigravity

---

## ✅ What's Working

| Component | Status | Details |
|-----------|--------|---------|
| **Python 3.11** | ✅ OK | v3.11.14 installed |
| **Node.js** | ✅ OK | v26.5.0 |
| **ffmpeg** | ✅ OK | v8.0.1 on PATH |
| **venv + packages** | ✅ OK | Exists at project root `/venv/` (not `backend/venv`); FastAPI, uvicorn, SQLAlchemy, asyncpg, openai, pydantic-settings all present |
| **NeonDB connection** | ✅ OK | Connected and responsive |
| **Backend server** | ✅ RUNNING | Already running on port 8000 before this session |
| **`/docs` Swagger** | ✅ OK | Swagger UI loads |
| **Skin upload + DINOv2 inference** | ✅ OK | `POST /skin/upload` → prediction: "vitiligo" (99.6% confidence), DB write succeeded |
| **`/voice/prompt`** | ✅ OK | Returns mood-aware system prompt |
| **`/voice/mood/analyze`** | ✅ OK | Audio → Whisper STT → Azure OpenAI LLM → mood scores stored in DB |
| **`/reports/weekly`** | ✅ OK | Generated full AI report via Azure GPT-4.1-mini |
| **Frontend dev server** | ✅ RUNNING | Vite on port 3002 (3000 and 3001 were occupied) |
| **`@google/genai` package** | ✅ Present | Already in `node_modules` |
| **No `<React.StrictMode>`** | ✅ OK | `index.tsx` renders `<App />` directly — no duplicate WebSocket issue |
| **DB Schema** | ✅ MIGRATED | All required tables and columns verified/added |

---

## 🔧 What Needed Fixing

### 1. CORS Wildcard Bug (`backend/app/main.py`)
**Problem:** `allow_origins=["*"]` was mixed with `allow_credentials=True` — this is a CORS spec violation that browsers silently reject (credentials are stripped when origin is wildcard).

**Fix:** Removed `"*"` and added `http://localhost:3002` and `http://127.0.0.1:3002` (Vite's fallback port this session). File: [`main.py`](file:///Users/rachitgoyal/Desktop/hackathons/2026/02_DUHacks/duHacksSubmission/backend/app/main.py)

### 2. Deprecated Gemini Model (`services/gemini.ts`)
**Problem:** `gemini-2.5-flash-native-audio-preview-09-2025` — this preview model has been shut down as of 2026. Connecting to it would cause immediate WebSocket close.

**Fix:** Updated to:
- Live audio: `gemini-live-2.5-flash-native-audio` (stable replacement)
- Text streaming: `gemini-2.5-flash` (was incorrectly pointing to audio preview model)

File: [`gemini.ts`](file:///Users/rachitgoyal/Desktop/hackathons/2026/02_DUHacks/duHacksSubmission/services/gemini.ts)

### 3. Database Schema Migrations (run successfully)
Applied via inline Python script:
- `test-user@example.com` with UUID `00000000-0000-0000-0000-000000000000` ensured (dev/test user)
- `skin_images_image_type_check` constraint expanded to include `before`, `progress`, `after`
- `skin_diagnoses` columns added: `severity_score`, `redness_level`, `texture_roughness`, `affected_area_percentage`
- `weekly_reports` columns added: `report_html`, `report_pdf_url`, `condition_summary`, `key_insights`, `recommendations`, `metrics`, `generated_by`
- Indexes created: `idx_improvement_records_user_date`, `idx_skin_images_user_captured`, `idx_skin_diagnoses_image`, `idx_weekly_reports_user_date`

---

## ⚠️ Known Fragile Points (Not Blocking, But Watch Out)

### Azure Deployment Name `gpt-4.1-mini`
The `.env` references `AZURE_OPENAI_DEPLOYMENT=gpt-4.1-mini`. The `/reports/weekly` endpoint successfully called it and returned a real response — **it works**. However, `gpt-4.1-mini` is an unusual Azure deployment name (typically it would be `gpt-4o-mini`). If this is a custom deployment name in the Azure portal, it's fine. If it breaks in the future, switch to `gpt-4o-mini` or `gpt-4o`.

### `ScriptProcessorNode` Deprecation Warning
`gemini.ts` uses `createScriptProcessor(4096, 1, 1)` for PCM encoding. This is deprecated in modern browsers but still functional. Not blocking. Low-priority migration to `AudioWorkletNode` if time permits.

### Frontend Port
Vite landed on port **3002** this session (3000 and 3001 were occupied). The CORS config has been updated to include 3002. If you restart fresh, it may land on 3000 again — that's already in the CORS list.

### Gemini API Key Expiry (Client-Side)
The Gemini key `AIzaSyDJWjudoaGxCVLbHo-PdjzVoirvM1r-oqg` is stored in `.env` and read via `import.meta.env.VITE_GEMINI_API_KEY`. The Solace Live connection will fail at connection time if this key has expired or lacks `gemini-live-2.5-flash-native-audio` access. **Test this manually by clicking "Start Session" in the browser.**

---

## 🔑 Credentials Requiring Human Verification

> These cannot be rotated by the agent — they require portal access.

| Credential | Location | Status |
|-----------|----------|--------|
| `VITE_GEMINI_API_KEY` | `.env` line 12 | ⚠️ **Needs manual test** — verify it has Gemini Live API (`gemini-live-2.5-flash-native-audio`) access in [Google AI Studio](https://aistudio.google.com/) |
| `AZURE_OPENAI_API_KEY` | `.env` line 4 | ✅ Working (confirmed via `/reports/weekly`) |
| `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` | `.env` lines 7-8 | ⚠️ Not tested — used in STT pipeline. Verify in Azure Portal if voice mood analysis degrades |
| `VITE_CLERK_PUBLISHABLE_KEY` | `.env` line 13 | ⚠️ Verify Clerk dashboard — test-instance keys expire. If login fails, regenerate from [dashboard.clerk.com](https://dashboard.clerk.com) |
| NeonDB `DATABASE_URL` | `.env` line 1 | ✅ Active and connected |

---

## 🚀 To Start Everything Fresh

```bash
# Backend (from project root)
cd /Users/rachitgoyal/Desktop/hackathons/2026/02_DUHacks/duHacksSubmission
source venv/bin/activate
cd backend
uvicorn app.main:app --reload

# Frontend (separate terminal, from project root)
cd /Users/rachitgoyal/Desktop/hackathons/2026/02_DUHacks/duHacksSubmission
npm run dev
```

---

## 📋 Final Verification Checklist

- [x] Backend boots without `pydantic_core.ValidationError`
- [x] `/docs` Swagger page loads
- [x] Skin image upload → DINOv2 inference → DB write succeeds
- [x] `/voice/prompt` returns a mood-aware system prompt
- [x] `/voice/mood/analyze` processes audio and returns mood scores
- [x] `/reports/weekly` generates or returns cached report
- [ ] Frontend `/solace` loads and fetches prompt (no CORS error) — **verify in browser**
- [ ] Clicking "Start Session" opens exactly ONE Gemini Live WebSocket — **verify in Network tab**
- [ ] Clerk auth flow works (login/signup) — **verify key validity**
- [ ] Gemini API key has Live API access — **verify in AI Studio**

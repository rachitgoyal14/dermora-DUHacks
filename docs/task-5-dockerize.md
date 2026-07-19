# Task 5: Dockerize Backend & Deploy to GCP

## Context

The backend (`backend/app/`) currently runs via `uvicorn app.main:app --reload` from a local Python venv, connecting to NeonDB (already cloud-hosted, no change needed there) and, after Task 2, Cloudflare R2 for image storage. This task containerizes it and ships it to Google Cloud Platform. **This task should be done after (or independent of) Tasks 1 and 2** since it will need whatever final env-var shape those produce (JWT secret, R2 credentials) baked into the deployment config — confirm with the human which of Tasks 1/2 have landed before finalizing the env var list below.

## Goal

A production-ready Docker image for the FastAPI backend, deployed on **Cloud Run** (recommended over GCE/GKE for this workload — stateless API, no persistent local disk needed now that images live in R2, scales to zero, simplest ops surface for a small team).

## Part A: Dockerfile

Create `backend/Dockerfile`:
```dockerfile
FROM python:3.11-slim AS base

# System deps: ffmpeg required for audio normalization (voice mood pipeline)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run injects $PORT — must listen on it, not a hardcoded 8000
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
```

Notes for the agent to verify against the actual `requirements.txt` and codebase before finalizing:
- Confirm `ffmpeg` is genuinely still needed (it is, per `audio_utils.py`'s `normalize_audio_for_azure` — used in the voice mood-analysis pipeline). Do not remove it.
- Confirm no code still references `backend/uploads/skin_images/` as a **required-to-exist** directory (post-Task-2 R2 migration, local disk writes for images should be gone — if any local-write code paths remain, either remove them or ensure the container still creates the directory defensively so it doesn't crash. Cloud Run containers have an ephemeral, mostly-read-only filesystem outside `/tmp` — note that `mood_inference_service.py`'s `_save_temp_audio` writes to `/tmp/`, which **is** writable on Cloud Run, so that part is fine as-is).
- Add a `.dockerignore` (venv, `__pycache__`, `.env`, `dataset/`, `.git`, test images) so the build context stays small and secrets never get baked into the image.

## Part B: GCP Setup

1. **Enable required APIs** (if not already): Cloud Run, Artifact Registry, Cloud Build.
2. **Create an Artifact Registry repo** for the container image:
   ```bash
   gcloud artifacts repositories create dermora-backend \
     --repository-format=docker \
     --location=us-central1
   ```
3. **Build & push** the image:
   ```bash
   gcloud builds submit --tag us-central1-docker.pkg.dev/<PROJECT_ID>/dermora-backend/api:latest ./backend
   ```
4. **Secrets management:** Do **not** bake `.env` into the image. Use Google Secret Manager for every sensitive value and reference them in the Cloud Run deploy step:
   ```bash
   # One-time secret creation per value:
   echo -n "<value>" | gcloud secrets create DATABASE_URL --data-file=-
   echo -n "<value>" | gcloud secrets create AZURE_OPENAI_API_KEY --data-file=-
   echo -n "<value>" | gcloud secrets create JWT_SECRET_KEY --data-file=-
   echo -n "<value>" | gcloud secrets create R2_ACCESS_KEY_ID --data-file=-
   echo -n "<value>" | gcloud secrets create R2_SECRET_ACCESS_KEY --data-file=-
   # ...repeat for every remaining .env value (AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_DEPLOYMENT,
   # AZURE_OPENAI_API_VERSION, R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_PUBLIC_URL_BASE, etc.)
   ```
   Compile the **actual full list** by reading the current `backend/.env` at execution time — don't guess, since Tasks 1 and 2 will have added new required vars (`JWT_SECRET_KEY`, `R2_*`) beyond what's documented here.

5. **Deploy to Cloud Run:**
   ```bash
   gcloud run deploy dermora-backend \
     --image us-central1-docker.pkg.dev/<PROJECT_ID>/dermora-backend/api:latest \
     --region us-central1 \
     --platform managed \
     --allow-unauthenticated \
     --memory 1Gi \
     --cpu 1 \
     --min-instances 0 \
     --max-instances 5 \
     --set-secrets="DATABASE_URL=DATABASE_URL:latest,AZURE_OPENAI_API_KEY=AZURE_OPENAI_API_KEY:latest,JWT_SECRET_KEY=JWT_SECRET_KEY:latest,R2_ACCESS_KEY_ID=R2_ACCESS_KEY_ID:latest,R2_SECRET_ACCESS_KEY=R2_SECRET_ACCESS_KEY:latest"
   ```
   (Extend `--set-secrets` with every remaining var from step 4; `gcloud run deploy` has a flag length limit — if the full list is unwieldy, use a `--env-vars-file` YAML instead, referencing secret values via the `secretKeyRef` syntax in a full `service.yaml` + `gcloud run services replace` deploy instead of the flag-based command.)

   Notes:
   - `--memory 1Gi` — verify this is sufficient once DINOv2 model weights are loaded into memory; increase to `2Gi` if the container OOMs on startup (check `backend/app/models/model.py` for the `.pth` file size to estimate).
   - `--min-instances 0` means cold starts are possible — the DINOv2 model load + Azure client init on startup will add latency to the first request after idle. If this matters for the user experience, set `--min-instances 1` (small ongoing cost) instead.
   - DO NOT set `--allow-unauthenticated` if Task 1's auth is meant to be the *only* auth layer and you want defense-in-depth — but for a public-facing API meant to be hit by the frontend directly, `--allow-unauthenticated` at the Cloud Run level (with JWT auth handled inside the app) is the correct/expected setup. Flag this choice explicitly in your summary so the human confirms it's intentional.

6. **Get the deployed URL** (`gcloud run services describe dermora-backend --region us-central1 --format='value(status.url)'`) and update:
   - Frontend `services/api.ts` `baseURL` (currently hardcoded `http://localhost:8000`) — move this to an environment variable (`VITE_API_BASE_URL`) instead of hardcoding, defaulting to localhost for local dev.
   - Backend's own CORS `allow_origins` list in `main.py` — add the production frontend domain once known (and keep `localhost` origins for continued local dev).

## Part C: CI/CD (Optional but Recommended)

If time permits, add `backend/cloudbuild.yaml` so future pushes to a `main`/`deploy` branch auto-build and deploy:
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'us-central1-docker.pkg.dev/$PROJECT_ID/dermora-backend/api:$SHORT_SHA', './backend']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'us-central1-docker.pkg.dev/$PROJECT_ID/dermora-backend/api:$SHORT_SHA']
  - name: 'gcr.io/google-cloud-sdk/slim'
    entrypoint: gcloud
    args:
      - run
      - deploy
      - dermora-backend
      - --image=us-central1-docker.pkg.dev/$PROJECT_ID/dermora-backend/api:$SHORT_SHA
      - --region=us-central1
```
Connect this via a Cloud Build trigger on the GitHub repo if the human wants push-to-deploy — otherwise treat this file as optional and skip if not requested.

## Testing Checklist
- [ ] `docker build -t dermora-backend ./backend` succeeds locally
- [ ] `docker run -p 8080:8080 --env-file backend/.env dermora-backend` boots and `/docs` is reachable at `localhost:8080/docs`
- [ ] Image successfully pushed to Artifact Registry
- [ ] Cloud Run deployment succeeds and returns a live URL
- [ ] `<cloud-run-url>/docs` loads
- [ ] A real end-to-end request (e.g. `/auth/login` then an authenticated `/voice/prompt`) succeeds against the deployed URL
- [ ] Frontend, pointed at the new `VITE_API_BASE_URL`, successfully talks to the deployed backend (test at least one full flow: login → skin upload → view result)
- [ ] Confirm NeonDB and R2 both accept connections from Cloud Run's IP range (usually fine since both are public-internet-reachable services, but verify no IP allowlisting on NeonDB blocks it)

## Deliverable
The final Cloud Run service URL, the full list of secrets that were created in Secret Manager (names only, not values), and an explicit note on the `--allow-unauthenticated` / `--min-instances` decisions made above so the human can revisit them.
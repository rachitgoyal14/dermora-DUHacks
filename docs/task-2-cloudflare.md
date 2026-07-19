# Task 2: Migrate Image Storage to Cloudflare R2

## Context

Skin images are currently saved to local disk at `backend/uploads/skin_images/` via `backend/app/services/storage.py` (`StorageService.save_image`), and the relative file path is stored in `skin_images.image_url`. This does not survive redeploys, doesn't scale past a single instance, and every consumer of `image_url` (Azure Vision analysis, the frontend `<img>` tags, the report generator's HTML) currently assumes it's a local path readable via `open()`.

We're moving to **Cloudflare R2** (S3-compatible object storage) so images persist independently of the backend server and can be served via public/signed URLs.

## Goal

Replace local disk storage with R2 uploads. `skin_images.image_url` should store a full public (or signed) R2 URL instead of a local path. Every place that currently does `open(image.image_url, "rb")` needs updating to fetch bytes over HTTP instead.

## Backend Tasks

1. **Add dependency:** `boto3` (R2 is S3-compatible, so the standard AWS SDK works against R2's endpoint).
   ```
   pip install boto3
   ```

2. **`.env` additions:**
   ```
   R2_ACCOUNT_ID=<cloudflare account id>
   R2_ACCESS_KEY_ID=<r2 access key>
   R2_SECRET_ACCESS_KEY=<r2 secret key>
   R2_BUCKET_NAME=dermora-skin-images
   R2_PUBLIC_URL_BASE=https://<your-r2-public-bucket-domain>   # or custom domain if configured
   ```
   Note: R2 buckets are private by default. Either (a) enable public access + a custom domain for read access, or (b) generate presigned GET URLs on read. **Default to option (a)** for simplicity (skin photos are already sensitive — flag to the human that a private-bucket + presigned-URL approach is more appropriate for a production medical app, but implement public-bucket-with-obscure-UUID-keys for now unless told otherwise, since it requires zero URL-refresh logic).

3. **Rewrite `backend/app/core/config.py`** — add the R2 settings as `Optional[str]` fields (same pattern as Azure settings), so the app still boots if unset.

4. **Rewrite `backend/app/services/storage.py`:**
   ```python
   import boto3
   from botocore.config import Config as BotoConfig
   import uuid
   from fastapi import UploadFile, HTTPException
   from app.core.config import settings

   class StorageService:
       def __init__(self):
           self.client = boto3.client(
               "s3",
               endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
               aws_access_key_id=settings.R2_ACCESS_KEY_ID,
               aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
               config=BotoConfig(signature_version="s3v4"),
               region_name="auto",
           )
           self.bucket = settings.R2_BUCKET_NAME
           self.public_base = settings.R2_PUBLIC_URL_BASE

       async def save_image(self, file: UploadFile, user_id: str) -> str:
           if not file.content_type.startswith("image/"):
               raise HTTPException(400, "Only image files are allowed")

           ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
           key = f"skin_images/{user_id}/{uuid.uuid4()}.{ext}"

           contents = await file.read()
           self.client.put_object(
               Bucket=self.bucket,
               Key=key,
               Body=contents,
               ContentType=file.content_type,
           )
           return f"{self.public_base}/{key}"

       def delete_image(self, image_url: str) -> bool:
           try:
               key = image_url.replace(f"{self.public_base}/", "")
               self.client.delete_object(Bucket=self.bucket, Key=key)
               return True
           except Exception:
               return False

       def get_full_path(self, url: str) -> str:
           # No longer meaningful for R2 — kept for interface compatibility, returns the URL as-is
           return url
   ```

5. **Fix every consumer that reads image bytes from a local path:**
   - `backend/app/services/azure_vision.py` — `_encode_image()` currently does `open(image_path, "rb")`. Change to fetch over HTTP:
     ```python
     import httpx

     async def _encode_image(self, image_url: str) -> str:
         async with httpx.AsyncClient() as client:
             resp = await client.get(image_url)
             resp.raise_for_status()
             return base64.b64encode(resp.content).decode('utf-8')
     ```
     Note this changes `_encode_image` from sync to async — update all call sites (`analyze_single_image`, `compare_images`) to `await` it.
   - Search the whole `backend/` directory for any other `open(`, `Path(`, or `os.path` usage against `image_url` / `image.image_url` / `file_path` values coming from `skin_images` — there may be spots in `report_generator.py`'s context-gathering or `improvement_analyzer.py` — fix each one to treat the value as a remote URL, not a local path.

6. **Skin router (`skin.py`) upload flow** — the current `upload_and_analyze` endpoint runs DINOv2 inference on the **in-memory PIL image** before storage (good, don't change that part), but double check it isn't also relying on the local `file_path` afterward for anything other than passing to `azure_vision_service` and DB storage — replace those usages with the returned R2 URL.

7. **Add `boto3` and `httpx` to `requirements.txt`** if not already present.

## Frontend Tasks
- No changes needed if the frontend was already just rendering `image.image_url` as an `<img src>` — R2 public URLs work as drop-in replacements. **Verify** by finding every place `image_url` or `image_url` fields from API responses are rendered and confirm no code prepends `http://localhost:8000/` to them (a plausible leftover assumption from local-file serving).

## Migration Note (Not Automated)
Existing rows in `skin_images` still have local paths like `uploads/skin_images/xyz.jpg` in `image_url` — these will break once the local server no longer serves that directory. Since this is dev/test data, **do not attempt automatic migration**; instead, note in your summary that pre-existing test rows will need either manual re-upload or a one-off migration script if real user data existed (it doesn't yet).

## Testing Checklist
- [ ] Upload a new skin image → confirm it appears in the R2 bucket (Cloudflare dashboard)
- [ ] `skin_images.image_url` in the DB is a full `https://` URL, not a local path
- [ ] `/skin/analyze/{image_id}` (Azure Vision) successfully fetches the image over HTTP and returns analysis
- [ ] `/skin/compare` works with two R2-hosted images
- [ ] Frontend correctly displays the uploaded image using the R2 URL
- [ ] Deleting an image via `DELETE /skin/image/{image_id}` removes it from the R2 bucket


Here are the API Keys to use:
```python
R2_BUCKET=mootion
R2_ENDPOINT=https://2c420388f7fe8b10f019e2dcc1bc6ae3.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=1832caef4fd2a094a687a78926e2ddc4
R2_SECRET_ACCESS_KEY=27356524244973e85da2715aedd943fffcb02f02f10211b47bd76aa668f52b8e
R2_PUBLIC_URL=https://pub-b234580e28f64da091f40793f8cd0007.r2.dev
```
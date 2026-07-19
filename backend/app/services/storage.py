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
        public_base_clean = self.public_base.rstrip("/")
        return f"{public_base_clean}/{key}"

    def delete_image(self, image_url: str) -> bool:
        try:
            public_base_clean = self.public_base.rstrip("/")
            key = image_url.replace(f"{public_base_clean}/", "")
            self.client.delete_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False

    def get_full_path(self, url: str) -> str:
        # No longer meaningful for R2 — kept for interface compatibility, returns the URL as-is
        return url
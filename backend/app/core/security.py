import secrets
from datetime import datetime, timedelta
from uuid import UUID

import hashlib
import bcrypt
from jose import JWTError, jwt
from fastapi import HTTPException

# ─── Password hashing ───────────────────────────────────────────────────────
# We use bcrypt directly to avoid passlib deprecation / compatibility issues with bcrypt >= 4.0.0.
# We also pre-hash with SHA-256 to support passwords longer than 72 bytes safely.

def hash_password(password: str) -> str:
    pwd_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_hash.encode('utf-8'), salt)
    return hashed.decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    if not hashed:
        return False
    pwd_hash = hashlib.sha256(plain.encode('utf-8')).hexdigest()
    try:
        return bcrypt.checkpw(pwd_hash.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


# ─── JWT ─────────────────────────────────────────────────────────────────────
from app.core.config import settings  # noqa: E402 (after stdlib imports)

SECRET_KEY: str = settings.JWT_SECRET_KEY
ALGORITHM = "HS256"
DEFAULT_EXPIRE_MINUTES: int = settings.JWT_EXPIRE_MINUTES


def create_access_token(user_id: UUID, expires_minutes: int = DEFAULT_EXPIRE_MINUTES) -> str:
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> UUID:
    """Decode and validate a JWT, returning the user's UUID.
    Raises HTTPException(401) on any failure.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id_str: str = payload.get("sub")
        if not user_id_str:
            raise HTTPException(status_code=401, detail="Invalid token: missing subject")
        return UUID(user_id_str)
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {e}")
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid user ID in token")

from fastapi import Depends, HTTPException, Header
from uuid import UUID

from app.core.security import decode_access_token


async def get_current_user_id(authorization: str = Header(...)) -> UUID:
    """FastAPI dependency — extracts and validates the Bearer JWT,
    returning the authenticated user's UUID.

    Raises HTTPException(401) on missing / malformed / expired token.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header — expected 'Bearer <token>'")
    token = authorization.removeprefix("Bearer ").strip()
    return decode_access_token(token)

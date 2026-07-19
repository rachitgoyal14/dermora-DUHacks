# mood.py
# Updated for Clerk authentication: Uses get_current_user dependency
# Removed TEMP_USER_ID - derives from token via X-User-Id header
# Matches skin.py and reports.py structure

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.entities.user import User
from app.entities.mood_log import MoodLog
from app.schemas.mood import MoodLogCreate

router = APIRouter(prefix="/mood", tags=["Mood"])


# ============================================================================
# 🔐 JWT USER DEPENDENCY
# ============================================================================

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
) -> User:
    """Resolve JWT user_id to a full User ORM object."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "User does not exist")
    return user


# ============================================================================
# ENDPOINT 1: GET MOOD QUESTIONS (PUBLIC - NO AUTH NEEDED)
# ============================================================================

@router.get("/questions")
async def get_mood_questions():
    """
    Returns mood questions.
    Frontend handles emoji UI + numeric mapping.
    No authentication required - questions are static.
    """
    return {
        "version": "v1",
        "questions": [
            {
                "id": "mood",
                "prompt": "How are you feeling right now?"
            },
            {
                "id": "stress",
                "prompt": "How stressed do you feel?"
            },
            {
                "id": "anxiety",
                "prompt": "How anxious are you feeling?"
            },
            {
                "id": "energy",
                "prompt": "How is your energy level?"
            }
        ]
    }


# ============================================================================
# ENDPOINT 2: LOG MOOD (AUTHENTICATED)
# ============================================================================

@router.post("/log")
async def log_mood(
    payload: MoodLogCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Stores numeric mood values for authenticated user.
    Emoji → number conversion is handled by frontend.
    User is automatically derived from X-User-Id header.
    """

    mood_log = MoodLog(
        user_id=user.id,  # ✅ Uses authenticated user's UUID
        mood_score=payload.mood_score,
        stress=payload.stress,
        anxiety=payload.anxiety,
        energy=payload.energy,
        logged_at=payload.logged_at,
    )

    db.add(mood_log)
    await db.commit()
    await db.refresh(mood_log)

    return {
        "status": "ok",
        "mood_log_id": str(mood_log.id),
        "user_id": str(user.id),
        "message": "Mood logged successfully"
    }


# ============================================================================
# ENDPOINT 3: GET USER MOOD HISTORY (AUTHENTICATED)
# ============================================================================

@router.get("/history")
async def get_mood_history(
    limit: int = 30,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get mood log history for authenticated user.
    Returns most recent logs (default: last 30).
    """
    from sqlalchemy import desc
    
    result = await db.execute(
        select(MoodLog)
        .where(MoodLog.user_id == user.id)
        .order_by(desc(MoodLog.logged_at))
        .limit(limit)
    )
    logs = result.scalars().all()

    return {
        "total_logs": len(logs),
        "logs": [
            {
                "mood_log_id": str(log.id),
                "mood_score": log.mood_score,
                "stress": log.stress,
                "anxiety": log.anxiety,
                "energy": log.energy,
                "logged_at": log.logged_at.isoformat(),
            }
            for log in logs
        ]
    }


# ============================================================================
# ENDPOINT 4: DELETE MOOD LOG (AUTHENTICATED)
# ============================================================================

@router.delete("/log/{mood_log_id}")
async def delete_mood_log(
    mood_log_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Delete a specific mood log for authenticated user.
    Ensures users can only delete their own logs.
    """
    result = await db.execute(
        select(MoodLog).where(
            MoodLog.id == mood_log_id,
            MoodLog.user_id == user.id  # Ensure ownership
        )
    )
    mood_log = result.scalar_one_or_none()

    if not mood_log:
        raise HTTPException(404, "Mood log not found")

    await db.delete(mood_log)
    await db.commit()

    return {
        "message": "Mood log deleted successfully",
        "mood_log_id": str(mood_log_id)
    }
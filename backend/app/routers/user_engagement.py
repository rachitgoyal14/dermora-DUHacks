# user_engagement.py
# New router for streak tracking, dashboard, insights, and preferences
# All endpoints use Clerk authentication via X-User-Id header

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from datetime import datetime, timedelta, date
from uuid import UUID
from pydantic import BaseModel
from typing import Optional, Dict, Any

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.entities.user import User
from app.entities.skin_image import SkinImage
from app.entities.skin_diagnosis import SkinDiagnosis
from app.entities.mood_log import MoodLog

router = APIRouter(prefix="/engagement", tags=["User Engagement"])


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class CheckInResponse(BaseModel):
    """Response after daily check-in"""
    current_streak: int
    longest_streak: int
    last_check_in: str
    streak_maintained: bool
    message: str


class StreakData(BaseModel):
    """User streak information"""
    current_streak: int
    longest_streak: int
    last_check_in: Optional[str]
    total_check_ins: int


class DashboardData(BaseModel):
    """Complete dashboard data for home screen"""
    streak: StreakData
    recent_activity: Dict[str, Any]
    quick_stats: Dict[str, Any]
    daily_insight: Optional[str]


class DailyInsight(BaseModel):
    """Personalized daily insight"""
    insight_text: str
    insight_type: str  # "improvement", "reminder", "motivation", "tip"
    icon: str
    generated_at: str


class UserPreferences(BaseModel):
    """User preferences and settings"""
    notification_time: Optional[str] = "09:00"
    theme: str = "light"
    onboarding_completed: bool = False
    skin_goals: list[str] = []
    reminder_enabled: bool = True
    language: str = "en"


# ============================================================================
# AUTHENTICATION DEPENDENCY
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
# HELPER FUNCTIONS
# ============================================================================

def calculate_streak(check_in_dates: list[date]) -> tuple[int, int]:
    """
    Calculate current and longest streak from check-in dates.
    Returns: (current_streak, longest_streak)
    """
    if not check_in_dates:
        return 0, 0
    
    sorted_dates = sorted(check_in_dates, reverse=True)
    
    # Calculate current streak
    current_streak = 0
    today = date.today()
    expected_date = today
    
    for check_date in sorted_dates:
        if check_date == expected_date or check_date == expected_date - timedelta(days=1):
            current_streak += 1
            expected_date = check_date - timedelta(days=1)
        else:
            break
    
    # Calculate longest streak
    longest_streak = 0
    temp_streak = 1
    
    for i in range(1, len(sorted_dates)):
        if (sorted_dates[i-1] - sorted_dates[i]).days == 1:
            temp_streak += 1
            longest_streak = max(longest_streak, temp_streak)
        else:
            temp_streak = 1
    
    longest_streak = max(longest_streak, temp_streak)
    
    return current_streak, longest_streak


# ============================================================================
# ENDPOINT 1: GET STREAK DATA
# ============================================================================

@router.get("/streak", response_model=StreakData)
async def get_user_streak(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get user's current streak information.
    Streak is maintained by daily check-ins (uploading images or logging mood).
    """
    
    # Get all dates where user had activity (images or mood logs)
    image_dates_result = await db.execute(
        select(func.date(SkinImage.captured_at))
        .where(SkinImage.user_id == user.id)
        .distinct()
    )
    image_dates = [row[0] for row in image_dates_result.all()]
    
    mood_dates_result = await db.execute(
        select(func.date(MoodLog.logged_at))
        .where(MoodLog.user_id == user.id)
        .distinct()
    )
    mood_dates = [row[0] for row in mood_dates_result.all()]
    
    # Combine and get unique dates
    all_dates = list(set(image_dates + mood_dates))
    
    current_streak, longest_streak = calculate_streak(all_dates)
    
    # Get last check-in
    last_check_in = max(all_dates) if all_dates else None
    
    return StreakData(
        current_streak=current_streak,
        longest_streak=longest_streak,
        last_check_in=last_check_in.isoformat() if last_check_in else None,
        total_check_ins=len(all_dates)
    )


# ============================================================================
# ENDPOINT 2: DAILY CHECK-IN
# ============================================================================

@router.post("/check-in", response_model=CheckInResponse)
async def daily_check_in(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Mark today as checked in. Can be called manually or automatically
    when user uploads image or logs mood.
    """
    
    today = date.today()
    
    # Check if already checked in today
    image_today = await db.execute(
        select(SkinImage)
        .where(
            SkinImage.user_id == user.id,
            func.date(SkinImage.captured_at) == today
        )
        .limit(1)
    )
    has_image_today = image_today.scalar_one_or_none() is not None
    
    mood_today = await db.execute(
        select(MoodLog)
        .where(
            MoodLog.user_id == user.id,
            func.date(MoodLog.logged_at) == today
        )
        .limit(1)
    )
    has_mood_today = mood_today.scalar_one_or_none() is not None
    
    already_checked_in = has_image_today or has_mood_today
    
    # Get current streak data
    streak_data = await get_user_streak(db, user)
    
    if already_checked_in:
        return CheckInResponse(
            current_streak=streak_data.current_streak,
            longest_streak=streak_data.longest_streak,
            last_check_in=today.isoformat(),
            streak_maintained=True,
            message=f"Already checked in today! {streak_data.current_streak} day streak!"
        )
    
    return CheckInResponse(
        current_streak=streak_data.current_streak,
        longest_streak=streak_data.longest_streak,
        last_check_in=streak_data.last_check_in or today.isoformat(),
        streak_maintained=False,
        message="Don't forget to upload an image or log your mood to maintain your streak!"
    )


# ============================================================================
# ENDPOINT 3: DASHBOARD DATA
# ============================================================================

@router.get("/dashboard", response_model=DashboardData)
async def get_dashboard_data(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Get all data needed for home screen dashboard.
    Single endpoint to reduce API calls.
    """
    
    # Get streak
    streak_data = await get_user_streak(db, user)
    
    # Get recent activity (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    
    recent_images = await db.execute(
        select(func.count(SkinImage.id))
        .where(
            SkinImage.user_id == user.id,
            SkinImage.captured_at >= week_ago
        )
    )
    images_this_week = recent_images.scalar() or 0
    
    recent_moods = await db.execute(
        select(func.count(MoodLog.id))
        .where(
            MoodLog.user_id == user.id,
            MoodLog.logged_at >= week_ago
        )
    )
    moods_this_week = recent_moods.scalar() or 0
    
    # Get total stats
    total_images = await db.execute(
        select(func.count(SkinImage.id))
        .where(SkinImage.user_id == user.id)
    )
    total_images_count = total_images.scalar() or 0
    
    total_moods = await db.execute(
        select(func.count(MoodLog.id))
        .where(MoodLog.user_id == user.id)
    )
    total_moods_count = total_moods.scalar() or 0
    
    # Get average mood score (last 7 days)
    avg_mood = await db.execute(
        select(func.avg(MoodLog.mood_score))
        .where(
            MoodLog.user_id == user.id,
            MoodLog.logged_at >= week_ago
        )
    )
    avg_mood_score = avg_mood.scalar() or 0
    
    # Generate quick insight
    insight = await generate_daily_insight(db, user)
    
    return DashboardData(
        streak=streak_data,
        recent_activity={
            "images_this_week": images_this_week,
            "moods_this_week": moods_this_week,
            "days_active": min(streak_data.current_streak, 7)
        },
        quick_stats={
            "total_images": total_images_count,
            "total_mood_logs": total_moods_count,
            "avg_mood_this_week": round(avg_mood_score, 1),
            "days_tracked": streak_data.total_check_ins
        },
        daily_insight=insight.insight_text if insight else None
    )


# ============================================================================
# ENDPOINT 4: DAILY INSIGHT
# ============================================================================

async def generate_daily_insight(
    db: AsyncSession,
    user: User
) -> Optional[DailyInsight]:
    """Generate personalized daily insight based on user data."""
    
    # Get recent data
    week_ago = datetime.utcnow() - timedelta(days=7)
    
    # Check skin progress
    recent_images = await db.execute(
        select(SkinImage)
        .where(
            SkinImage.user_id == user.id,
            SkinImage.captured_at >= week_ago
        )
        .order_by(SkinImage.captured_at)
    )
    images = recent_images.scalars().all()
    
    if len(images) >= 2:
        # Get diagnoses for first and last image
        first_diag = await db.execute(
            select(SkinDiagnosis)
            .where(SkinDiagnosis.skin_image_id == images[0].id)
        )
        last_diag = await db.execute(
            select(SkinDiagnosis)
            .where(SkinDiagnosis.skin_image_id == images[-1].id)
        )
        
        first_diagnosis = first_diag.scalar_one_or_none()
        last_diagnosis = last_diag.scalar_one_or_none()
        
        if first_diagnosis and last_diagnosis:
            improvement = (last_diagnosis.confidence - first_diagnosis.confidence) * 100
            
            if improvement > 5:
                return DailyInsight(
                    insight_text=f"Your skin improved {improvement:.1f}% this week! Keep it up! 🌟",
                    insight_type="improvement",
                    icon="📈",
                    generated_at=datetime.utcnow().isoformat()
                )
            elif improvement < -5:
                return DailyInsight(
                    insight_text=f"Let's adjust your routine. Try logging your mood to find triggers.",
                    insight_type="reminder",
                    icon="💡",
                    generated_at=datetime.utcnow().isoformat()
                )
    
    # Check mood trends
    moods = await db.execute(
        select(MoodLog.mood_score)
        .where(
            MoodLog.user_id == user.id,
            MoodLog.logged_at >= week_ago
        )
    )
    mood_scores = [m for m in moods.scalars().all()]
    
    if mood_scores:
        avg_mood = sum(mood_scores) / len(mood_scores)
        if avg_mood > 70:
            return DailyInsight(
                insight_text="You're in a great headspace this week! Your positivity shows. ✨",
                insight_type="motivation",
                icon="😊",
                generated_at=datetime.utcnow().isoformat()
            )
    
    # Default motivational insight
    motivational_tips = [
        "Consistency is key! Try to check in daily for best results.",
        "Remember: progress takes time. You're doing great!",
        "Your skin tells a story. Keep tracking to see the full picture.",
        "Small steps every day lead to big changes over time.",
    ]
    
    import random
    tip = random.choice(motivational_tips)
    
    return DailyInsight(
        insight_text=tip,
        insight_type="tip",
        icon="💡",
        generated_at=datetime.utcnow().isoformat()
    )


@router.get("/insights/daily", response_model=DailyInsight)
async def get_daily_insight(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get personalized daily insight for user."""
    
    insight = await generate_daily_insight(db, user)
    
    if not insight:
        # Fallback
        return DailyInsight(
            insight_text="Welcome back! Upload an image to track your progress.",
            insight_type="reminder",
            icon="📸",
            generated_at=datetime.utcnow().isoformat()
        )
    
    return insight


# ============================================================================
# ENDPOINT 5: MOOD HISTORY & SUMMARY
# ============================================================================

@router.get("/mood/history")
async def get_mood_history(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get mood history for charts (last N days)."""
    
    start_date = datetime.utcnow() - timedelta(days=days)
    
    result = await db.execute(
        select(MoodLog)
        .where(
            MoodLog.user_id == user.id,
            MoodLog.logged_at >= start_date
        )
        .order_by(MoodLog.logged_at)
    )
    logs = result.scalars().all()
    
    return {
        "total_logs": len(logs),
        "days_covered": days,
        "mood_data": [
            {
                "date": log.logged_at.date().isoformat(),
                "mood_score": log.mood_score,
                "stress": log.stress,
                "anxiety": log.anxiety,
                "energy": log.energy,
            }
            for log in logs
        ]
    }


@router.get("/mood/summary")
async def get_mood_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get mood summary statistics."""
    
    # Last 7 days
    week_ago = datetime.utcnow() - timedelta(days=7)
    
    result = await db.execute(
        select(
            func.avg(MoodLog.mood_score).label('avg_mood'),
            func.avg(MoodLog.stress).label('avg_stress'),
            func.avg(MoodLog.anxiety).label('avg_anxiety'),
            func.avg(MoodLog.energy).label('avg_energy'),
            func.count(MoodLog.id).label('total_logs')
        )
        .where(
            MoodLog.user_id == user.id,
            MoodLog.logged_at >= week_ago
        )
    )
    
    stats = result.one()
    
    return {
        "period": "last_7_days",
        "avg_mood": round(stats.avg_mood or 0, 1),
        "avg_stress": round(stats.avg_stress or 0, 1),
        "avg_anxiety": round(stats.avg_anxiety or 0, 1),
        "avg_energy": round(stats.avg_energy or 0, 1),
        "total_logs": stats.total_logs or 0,
        "mood_trend": "improving" if (stats.avg_mood or 0) > 60 else "stable"
    }


# ============================================================================
# ENDPOINT 6 & 7: USER PREFERENCES
# ============================================================================
# FIXED: Only the preferences endpoints (line 520-580)
# Replace these two functions in your user_engagement.py
# FIXED: Only the preferences endpoints (line 520-580)
# Replace these two functions in your user_engagement.py
@router.get("/preferences", response_model=UserPreferences)
async def get_user_preferences(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get user preferences and settings."""
    
    try:
        if user.user_metadata is None:
            metadata = {}
        elif isinstance(user.user_metadata, dict):
            metadata = user.user_metadata
        else:
            metadata = {}
    except Exception:
        metadata = {}
    
    return UserPreferences(
        notification_time=metadata.get("notification_time", "09:00"),
        theme=metadata.get("theme", "light"),
        onboarding_completed=metadata.get("onboarding_completed", False),
        skin_goals=metadata.get("skin_goals", []),
        reminder_enabled=metadata.get("reminder_enabled", True),
        language=metadata.get("language", "en")
    )


@router.put("/preferences")
async def update_user_preferences(
    preferences: UserPreferences,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Update user preferences."""
    
    if user.user_metadata is None or not isinstance(user.user_metadata, dict):
        user.user_metadata = {}
    
    user.user_metadata.update({
        "notification_time": preferences.notification_time,
        "theme": preferences.theme,
        "onboarding_completed": preferences.onboarding_completed,
        "skin_goals": preferences.skin_goals,
        "reminder_enabled": preferences.reminder_enabled,
        "language": preferences.language
    })
    
    from sqlalchemy.orm.attributes import flag_modified
    flag_modified(user, "user_metadata")
    
    await db.commit()
    await db.refresh(user)
    
    return {
        "message": "Preferences updated successfully",
        "preferences": preferences
    }
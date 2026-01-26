# reports.py
# FIXED VERSION - Improved DB queries and error handling

from fastapi import APIRouter, Depends, HTTPException, Header
from fastapi.responses import HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func
from datetime import date, datetime, timedelta
from uuid import UUID
from typing import Optional

from app.core.database import get_db
from app.entities.user import User
from app.entities.weekly_report import WeeklyReport
from app.schemas.reports import WeeklyMetrics
from app.schemas.reports_api import WeeklyReportAPIResponse
from app.services.report_generator import ReportGenerator

router = APIRouter(prefix="/reports", tags=["Reports"])
report_generator = ReportGenerator()


# ============================================================================
# 🔐 AUTH
# ============================================================================

async def get_current_user(
    db: AsyncSession = Depends(get_db),
    x_user_id: str = Header(..., alias="X-User-Id"),
) -> User:
    """Authenticate user from header."""
    try:
        user_uuid = UUID(x_user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user UUID format")

    try:
        result = await db.execute(
            select(User).where(User.id == user_uuid)
        )
        user = result.scalar_one_or_none()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    if not user:
        raise HTTPException(status_code=401, detail="User does not exist")

    return user


# ============================================================================
# 🔧 METRICS NORMALIZER
# ============================================================================

def normalize_metrics(raw_metrics: dict, *, days_tracked: int, consistent_tracking: bool) -> dict:
    """Normalize metrics to ensure consistent schema."""
    
    # Handle case where raw_metrics might be a string or None
    if not isinstance(raw_metrics, dict):
        raw_metrics = {}
    
    normalized = {
        "average_severity": raw_metrics.get("average_severity"),
        "average_confidence": raw_metrics.get("average_confidence", 0.0),
        "improvement_vs_last_week": raw_metrics.get(
            "improvement_vs_last_week",
            raw_metrics.get("improvement_percentage")
        ),
        "total_images_uploaded": raw_metrics.get(
            "total_images_uploaded",
            raw_metrics.get("total_images", 0)
        ),
        "consistent_tracking": consistent_tracking,
        "days_tracked": days_tracked,
    }

    return WeeklyMetrics(**normalized).model_dump()


# ============================================================================
# INTERNAL HELPER
# ============================================================================

async def _get_or_generate_report(
    user: User,
    week_start: date,
    force_regenerate: bool,
    db: AsyncSession
):
    """Get existing report or generate new one."""
    week_end = week_start + timedelta(days=6)

    # Try to fetch cached report
    if not force_regenerate:
        try:
            result = await db.execute(
                select(WeeklyReport).where(
                    and_(
                        WeeklyReport.user_id == user.id,
                        WeeklyReport.week_start == week_start
                    )
                )
            )
            existing = result.scalar_one_or_none()

            if existing and existing.report_html:
                # Auto-migrate metrics if needed
                raw_metrics = existing.metrics or {}
                
                existing.metrics = normalize_metrics(
                    raw_metrics,
                    days_tracked=raw_metrics.get("days_tracked", 0),
                    consistent_tracking=raw_metrics.get("consistent_tracking", False),
                )

                await db.commit()
                await db.refresh(existing)
                return existing, False
                
        except Exception as e:
            # Log error but continue to generation
            print(f"Error fetching cached report: {e}")

    # Generate new report
    if not report_generator.is_available():
        raise HTTPException(status_code=503, detail="Report generation service unavailable")

    try:
        context = await report_generator.gather_weekly_context(
            db, user.id, week_start, week_end
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error gathering context: {str(e)}")

    if not context:
        raise HTTPException(status_code=404, detail="No data found for this week")

    # Calculate tracking metrics
    unique_dates = set()
    for diag in context.get("diagnoses", []):
        try:
            # Handle both string and datetime objects
            if isinstance(diag["date"], str):
                diag_date = datetime.fromisoformat(diag["date"]).date()
            elif isinstance(diag["date"], datetime):
                diag_date = diag["date"].date()
            else:
                diag_date = diag["date"]
            
            unique_dates.add(diag_date)
        except (KeyError, ValueError) as e:
            print(f"Error parsing diagnosis date: {e}")
            continue

    days_tracked = len(unique_dates)
    consistent_tracking = days_tracked >= 3

    # Generate report with LLM
    try:
        report_data = await report_generator.generate_report_with_llm(context, user.id)
        
        # Validate required fields exist
        if not isinstance(report_data, dict):
            raise ValueError("LLM returned invalid report format")
        
        # Debug: Log what keys we got from LLM
        print(f"📊 LLM returned keys: {list(report_data.keys())}")
        print(f"📊 Report data sample: {str(report_data)[:200]}...")
            
    except Exception as e:
        print(f"Error generating report with LLM: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")

    # Normalize metrics with better fallbacks
    raw_metrics_data = report_data.get("metrics", report_data.get("metrics_interpretation", {}))
    
    # If metrics_interpretation is a string or missing, create default metrics from context
    if isinstance(raw_metrics_data, str) or not raw_metrics_data:
        print(f"⚠️ No valid metrics found, generating defaults from context")
        
        # Calculate basic metrics from context
        diagnoses = context.get("diagnoses", [])
        if diagnoses:
            avg_severity = sum(d.get("severity", 0) for d in diagnoses) / len(diagnoses) if diagnoses else None
            avg_confidence = sum(d.get("confidence", 0) for d in diagnoses) / len(diagnoses) if diagnoses else 0.0
        else:
            avg_severity = None
            avg_confidence = 0.0
        
        raw_metrics_data = {
            "average_severity": avg_severity,
            "average_confidence": avg_confidence,
            "improvement_vs_last_week": None,
            "total_images_uploaded": len(diagnoses)
        }
    
    metrics = normalize_metrics(
        raw_metrics_data,
        days_tracked=days_tracked,
        consistent_tracking=consistent_tracking,
    )

    # Generate HTML
    try:
        report_html = report_generator.generate_html_report(report_data, context)
    except Exception as e:
        print(f"❌ Error generating HTML: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error generating HTML: {str(e)}")

    # Extract skin trend from various possible keys
    skin_trend = (
        report_data.get("skin_trend") or 
        report_data.get("trend") or 
        report_data.get("condition_summary", "")[:100] or
        "stable"
    )
    
    # Create plain text version of report
    report_text_parts = [
        f"Weekly Report: {week_start} to {week_end}",
        f"\nCondition Summary:\n{report_data.get('condition_summary', 'No summary available')}",
        f"\nSkin Trend: {skin_trend}",
    ]
    
    # Add key insights
    insights = report_data.get("key_insights", [])
    if insights:
        report_text_parts.append("\nKey Insights:")
        for i, insight in enumerate(insights, 1):
            title = insight.get("title", "") if isinstance(insight, dict) else str(insight)
            report_text_parts.append(f"{i}. {title}")
    
    # Add recommendations
    recommendations = report_data.get("recommendations", report_data.get("next_steps", []))
    if recommendations:
        report_text_parts.append("\nRecommendations:")
        for i, rec in enumerate(recommendations, 1):
            action = rec.get("action", "") if isinstance(rec, dict) else str(rec)
            report_text_parts.append(f"{i}. {action}")
    
    report_text = "\n".join(report_text_parts)

    # Save to database with safe defaults
    try:
        weekly_report = WeeklyReport(
            user_id=user.id,
            week_start=week_start,
            week_end=week_end,
            condition_summary=report_data.get("condition_summary", "No summary available"),
            skin_trend=skin_trend,
            report_text=report_text,
            metrics=metrics,
            key_insights=report_data.get("key_insights", []),
            recommendations=recommendations,
            report_html=report_html,
        )
        
        print(f"✅ Created WeeklyReport object successfully")
        print(f"   - condition_summary: {len(weekly_report.condition_summary)} chars")
        print(f"   - skin_trend: {weekly_report.skin_trend}")
        print(f"   - metrics keys: {list(metrics.keys())}")
        
    except Exception as e:
        print(f"❌ Error creating WeeklyReport object: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error creating report object: {str(e)}")

    try:
        print(f"💾 Attempting to save to database...")
        db.add(weekly_report)
        await db.commit()
        print(f"✅ Database commit successful")
        await db.refresh(weekly_report)
        print(f"✅ Database refresh successful")
    except Exception as e:
        print(f"❌ Database error: {e}")
        import traceback
        traceback.print_exc()
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error saving report: {str(e)}")

    return weekly_report, True


# ============================================================================
# ENDPOINT 1: WEEKLY REPORT (JSON)
# ============================================================================

@router.get("/weekly", response_model=WeeklyReportAPIResponse)
async def get_report_json(
    week_start: Optional[date] = None,
    force_regenerate: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get weekly report in JSON format."""
    if not week_start:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())

    weekly_report, _ = await _get_or_generate_report(
        user, week_start, force_regenerate, db
    )

    return WeeklyReportAPIResponse(
        report_id=weekly_report.id,
        user_id=user.id,
        week_start=weekly_report.week_start,
        week_end=weekly_report.week_end,
        condition_summary=weekly_report.condition_summary,
        skin_trend=weekly_report.skin_trend,
        metrics=weekly_report.metrics,
        key_insights=weekly_report.key_insights,
        recommendations=weekly_report.recommendations,
        generated_at=weekly_report.created_at,
    )


# ============================================================================
# ENDPOINT 2: WEEKLY REPORT (HTML)
# ============================================================================

@router.get("/weekly/html")
async def get_report_html(
    week_start: Optional[date] = None,
    force_regenerate: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Get weekly report as rendered HTML."""
    if not week_start:
        today = date.today()
        week_start = today - timedelta(days=today.weekday())

    weekly_report, _ = await _get_or_generate_report(
        user, week_start, force_regenerate, db
    )

    if not weekly_report.report_html:
        raise HTTPException(status_code=500, detail="Report HTML not available")

    return HTMLResponse(content=weekly_report.report_html)


# ============================================================================
# ENDPOINT 3: LIST ALL REPORTS
# ============================================================================

@router.get("/weekly/list")
async def list_weekly_reports(
    limit: int = 10,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List all weekly reports for the user."""
    try:
        result = await db.execute(
            select(WeeklyReport)
            .where(WeeklyReport.user_id == user.id)
            .order_by(desc(WeeklyReport.week_start))
            .limit(limit)
            .offset(offset)
        )
        reports = result.scalars().all()
        
        return {
            "total": len(reports),
            "reports": [
                {
                    "report_id": str(r.id),
                    "week_start": r.week_start.isoformat(),
                    "week_end": r.week_end.isoformat(),
                    "condition_summary": r.condition_summary[:100] + "..." if len(r.condition_summary) > 100 else r.condition_summary,
                    "skin_trend": r.skin_trend,
                    "generated_at": r.created_at.isoformat(),
                }
                for r in reports
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing reports: {str(e)}")
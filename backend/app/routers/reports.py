# reports.py - FIXED to handle weeks with no data gracefully

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
# HELPER: Generate Empty Week Report
# ============================================================================

def generate_empty_week_report(week_start: date, week_end: date) -> dict:
    """Generate a report for a week with no data."""
    empty_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                max-width: 800px;
                margin: 40px auto;
                padding: 20px;
                background: linear-gradient(135deg, #FFF5F5 0%, #FFE5E5 100%);
            }}
            .container {{
                background: white;
                border-radius: 20px;
                padding: 40px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            }}
            h1 {{
                color: #FF6B9D;
                margin-bottom: 10px;
            }}
            .date-range {{
                color: #666;
                font-size: 14px;
                margin-bottom: 30px;
            }}
            .empty-state {{
                text-align: center;
                padding: 60px 20px;
            }}
            .empty-icon {{
                font-size: 64px;
                margin-bottom: 20px;
            }}
            .empty-message {{
                font-size: 18px;
                color: #333;
                margin-bottom: 10px;
            }}
            .empty-subtitle {{
                color: #666;
                font-size: 14px;
            }}
            .cta {{
                margin-top: 30px;
                padding: 15px 30px;
                background: linear-gradient(135deg, #FF6B9D, #C44569);
                color: white;
                border-radius: 10px;
                text-decoration: none;
                display: inline-block;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Weekly Report</h1>
            <div class="date-range">{week_start.strftime('%B %d')} - {week_end.strftime('%B %d, %Y')}</div>
            
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <div class="empty-message">No Data This Week</div>
                <div class="empty-subtitle">Start tracking your skin and mood to generate insights!</div>
            </div>
        </div>
    </body>
    </html>
    """
    
    return {
        "condition_summary": "No data was logged during this week. Start tracking your skin condition and mood to generate personalized insights and recommendations.",
        "skin_trend": "insufficient_data",
        "report_text": f"Weekly Report ({week_start} to {week_end}): No data available for this period.",
        "metrics": {
            "average_severity": None,
            "average_confidence": 0.0,
            "improvement_vs_last_week": None,
            "total_images_uploaded": 0,
            "consistent_tracking": False,
            "days_tracked": 0,
        },
        "key_insights": [
            {
                "title": "Start Your Journey",
                "description": "Upload your first skin image to begin tracking your progress.",
                "category": "action",
                "severity": "info",
                "icon": "🚀"
            }
        ],
        "recommendations": [
            {
                "action": "Upload a skin photo to establish your baseline",
                "priority": "high",
                "category": "tracking",
                "reasoning": "Establishing a baseline will help track your progress over time."
            },
            {
                "action": "Log your mood daily to track patterns",
                "priority": "high", 
                "category": "tracking",
                "reasoning": "Daily mood tracking helps identify patterns between your mental state and skin condition."
            }
        ],
        "report_html": empty_html
    }


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

    # FIXED: Handle empty weeks gracefully instead of raising 404
    if not context or not context.get("diagnoses"):
        print(f"ℹ️ No data for week {week_start} - {week_end}, generating empty report")
        empty_report_data = generate_empty_week_report(week_start, week_end)
        
        # Check if report already exists (in case force_regenerate was called twice)
        try:
            result = await db.execute(
                select(WeeklyReport).where(
                    and_(
                        WeeklyReport.user_id == user.id,
                        WeeklyReport.week_start == week_start
                    )
                )
            )
            existing_report = result.scalar_one_or_none()
            
            if existing_report:
                # Update existing report
                print(f"♻️ Updating existing empty report for week {week_start}")
                existing_report.week_end = week_end
                existing_report.condition_summary = empty_report_data["condition_summary"]
                existing_report.skin_trend = empty_report_data["skin_trend"]
                existing_report.report_text = empty_report_data["report_text"]
                existing_report.metrics = empty_report_data["metrics"]
                existing_report.key_insights = empty_report_data["key_insights"]
                existing_report.recommendations = empty_report_data["recommendations"]
                existing_report.report_html = empty_report_data["report_html"]
                
                await db.commit()
                await db.refresh(existing_report)
                return existing_report, True
        except Exception as e:
            print(f"⚠️ Error checking for existing report: {e}")
        
        # Create new empty week report
        weekly_report = WeeklyReport(
            user_id=user.id,
            week_start=week_start,
            week_end=week_end,
            condition_summary=empty_report_data["condition_summary"],
            skin_trend=empty_report_data["skin_trend"],
            report_text=empty_report_data["report_text"],
            metrics=empty_report_data["metrics"],
            key_insights=empty_report_data["key_insights"],
            recommendations=empty_report_data["recommendations"],
            report_html=empty_report_data["report_html"],
        )
        
        try:
            db.add(weekly_report)
            await db.commit()
            await db.refresh(weekly_report)
            return weekly_report, True
        except Exception as e:
            print(f"❌ Error saving empty report: {e}")
            await db.rollback()
            raise HTTPException(status_code=500, detail=f"Error saving report: {str(e)}")

    # Calculate tracking metrics for weeks with data
    unique_dates = set()
    for diag in context.get("diagnoses", []):
        try:
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
        
        if not isinstance(report_data, dict):
            raise ValueError("LLM returned invalid report format")
            
    except Exception as e:
        print(f"Error generating report with LLM: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating report: {str(e)}")

    # Normalize metrics
    raw_metrics_data = report_data.get("metrics", report_data.get("metrics_interpretation", {}))
    
    if isinstance(raw_metrics_data, str) or not raw_metrics_data:
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
        raise HTTPException(status_code=500, detail=f"Error generating HTML: {str(e)}")

    # Extract skin trend
    skin_trend = (
        report_data.get("skin_trend") or 
        report_data.get("trend") or 
        report_data.get("condition_summary", "")[:100] or
        "stable"
    )
    
    # Create report text
    report_text_parts = [
        f"Weekly Report: {week_start} to {week_end}",
        f"\nCondition Summary:\n{report_data.get('condition_summary', 'No summary available')}",
        f"\nSkin Trend: {skin_trend}",
    ]
    
    insights = report_data.get("key_insights", [])
    if insights:
        report_text_parts.append("\nKey Insights:")
        for i, insight in enumerate(insights, 1):
            title = insight.get("title", "") if isinstance(insight, dict) else str(insight)
            report_text_parts.append(f"{i}. {title}")
    
    recommendations = report_data.get("recommendations", report_data.get("next_steps", []))
    if recommendations:
        report_text_parts.append("\nRecommendations:")
        for i, rec in enumerate(recommendations, 1):
            action = rec.get("action", "") if isinstance(rec, dict) else str(rec)
            report_text_parts.append(f"{i}. {action}")
    
    report_text = "\n".join(report_text_parts)

    # Save to database
    try:
        # Check if report already exists for this week
        result = await db.execute(
            select(WeeklyReport).where(
                and_(
                    WeeklyReport.user_id == user.id,
                    WeeklyReport.week_start == week_start
                )
            )
        )
        existing_report = result.scalar_one_or_none()
        
        if existing_report:
            # Update existing report
            print(f"♻️ Updating existing report for week {week_start}")
            existing_report.week_end = week_end
            existing_report.condition_summary = report_data.get("condition_summary", "No summary available")
            existing_report.skin_trend = skin_trend
            existing_report.report_text = report_text
            existing_report.metrics = metrics
            existing_report.key_insights = report_data.get("key_insights", [])
            existing_report.recommendations = recommendations
            existing_report.report_html = report_html
            
            await db.commit()
            await db.refresh(existing_report)
            return existing_report, True
        
        # Create new report
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
        
        db.add(weekly_report)
        await db.commit()
        await db.refresh(weekly_report)
        
    except Exception as e:
        print(f"❌ Database error: {e}")
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


# ============================================================================
# ENDPOINT 4: DELETE REPORT
# ============================================================================

@router.delete("/weekly/{report_id}")
async def delete_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a specific weekly report."""
    try:
        report_uuid = UUID(report_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid report UUID format")
    
    try:
        # Find the report
        result = await db.execute(
            select(WeeklyReport).where(
                and_(
                    WeeklyReport.id == report_uuid,
                    WeeklyReport.user_id == user.id
                )
            )
        )
        report = result.scalar_one_or_none()
        
        if not report:
            raise HTTPException(status_code=404, detail="Report not found or you don't have permission to delete it")
        
        # Delete the report
        await db.delete(report)
        await db.commit()
        
        return {
            "success": True,
            "message": "Report deleted successfully",
            "report_id": report_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting report: {str(e)}")
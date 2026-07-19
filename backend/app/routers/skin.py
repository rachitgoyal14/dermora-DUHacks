from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, delete
from datetime import datetime, timedelta
from pydantic import BaseModel  
from uuid import UUID
from PIL import Image
import io, os
import uuid as uuid_lib

from app.core.database import get_db
from app.core.dependencies import get_current_user_id
from app.entities.skin_image import SkinImage
from app.entities.skin_diagnosis import SkinDiagnosis
from app.entities.improvement_record import ImprovementRecord
from app.entities.user import User

from app.schemas.skin import (
    SkinImageUploadResponse,
    SkinAnalysisResult,
    SkinComparisonResult,
    ImprovementTrackerResponse,
)

from app.services.storage import StorageService
from app.services.azure_vision import AzureVisionService
from app.models.inference import run_skin_inference
from app.services.improvement_analyzer import ImprovementAnalyzer


router = APIRouter(prefix="/skin", tags=["Skin Analysis"])
storage = StorageService()
vision_service = AzureVisionService()
improvement_analyzer = ImprovementAnalyzer()


class ImageCompareRequest(BaseModel):
    """Request model for comparing two images"""
    before_image_id: UUID
    after_image_id: UUID

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


# Add this helper function at the top of your file (after imports)
def url_to_filesystem_path(url_path: str) -> str:
    """Convert URL path to filesystem path."""
    # Remove leading slash: /uploads/skin_images/file.jpg -> uploads/skin_images/file.jpg
    return url_path.lstrip('/')

# ============================================================================
# ENDPOINT 1: /infer (legacy, no auth)
# ============================================================================

@router.post("/infer")
async def diagnose_skin(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Invalid image file")

    img_bytes = await file.read()
    pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

    result = run_skin_inference(pil_img)

    return {
        "inference_id": str(uuid_lib.uuid4()),
        "prediction": result["prediction"],
        "confidence": result["confidence"],
    }


# ============================================================================
# ENDPOINT 2: UPLOAD + ANALYZE (FIXED)
# ============================================================================

@router.post("/upload", response_model=SkinImageUploadResponse)
async def upload_and_analyze(
    file: UploadFile = File(...),
    image_type: str = "weekly",
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not file.content_type.startswith("image/"):
        raise HTTPException(400, "Invalid image file")

    # Save file
    file_path = await storage.save_image(file, str(user.id))

    # ML inference
    await file.seek(0)
    img_bytes = await file.read()
    pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    inference = run_skin_inference(pil_img)

    # Azure Vision (optional)
    try:
        azure = await vision_service.analyze_single_image(file_path)
    except Exception:
        azure = None

    # DB insert (UUID SAFE)
    skin_image = SkinImage(
        user_id=user.id,
        image_url=file_path,
        image_type=image_type,
        captured_at=datetime.utcnow(),
    )
    db.add(skin_image)
    await db.flush()

    diagnosis = SkinDiagnosis(
        skin_image_id=skin_image.id,
        prediction=inference["prediction"],
        confidence=inference["confidence"],
        model_version="v1",
    )
    db.add(diagnosis)

    await db.commit()
    await db.refresh(skin_image)

    msg = "Image uploaded successfully"
    if azure:
        msg += f" | Severity: {azure['severity_score']}/100"

    return SkinImageUploadResponse(
        image_id=skin_image.id,
        image_url=file_path,
        prediction=inference["prediction"],
        confidence=inference["confidence"],
        captured_at=skin_image.captured_at,
        message=msg,
    )


# ============================================================================
# ENDPOINT 3: MY IMAGES
# ============================================================================

@router.get("/my-images")
async def get_my_images(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SkinImage)
        .where(SkinImage.user_id == user.id)
        .order_by(desc(SkinImage.captured_at))
    )
    images = result.scalars().all()

    return [
        {
            "image_id": str(img.id),
            "image_url": img.image_url,
            "captured_at": img.captured_at.isoformat(),
            "image_type": img.image_type,
        }
        for img in images
    ]


# ============================================================================
# ENDPOINT 4: ANALYZE EXISTING IMAGE (FIXED - CORRECT PATH HANDLING)
# ============================================================================

@router.post("/analyze/{image_id}")
async def analyze_existing_image(
    image_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Re-analyze an existing image using Azure Vision."""
    result = await db.execute(
        select(SkinImage).where(
            SkinImage.id == image_id,
            SkinImage.user_id == user.id,
        )
    )
    image = result.scalar_one_or_none()

    if not image:
        raise HTTPException(404, "Image not found")

    try:
        # Call Azure Vision with R2 URL directly
        analysis = await vision_service.analyze_single_image(image.image_url)
        
        # Update diagnosis in database with new analysis
        diag_result = await db.execute(
            select(SkinDiagnosis).where(SkinDiagnosis.skin_image_id == image_id)
        )
        diagnosis = diag_result.scalar_one_or_none()
        
        if diagnosis:
            # Update existing diagnosis
            diagnosis.prediction = analysis.get("condition", "unknown")
            diagnosis.confidence = analysis.get("severity_score", 0) / 100  # Convert to 0-1 scale
            await db.commit()
        
        return {
            "prediction": analysis.get("condition", "unknown"),
            "confidence": analysis.get("severity_score", 0) / 100,
            "severity_score": analysis.get("severity_score", 0),
            "affected_area": analysis.get("affected_area_percentage", 0),
            "redness_level": analysis.get("redness_level", 0),
            "texture_roughness": analysis.get("texture_roughness", 0),
            "description": analysis.get("description", ""),
            "message": "Re-analysis complete"
        }
        
    except FileNotFoundError:
        raise HTTPException(
            status_code=404,
            detail=f"Image file not found: {file_path}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Azure Vision analysis failed: {str(e)}"
        )
# ============================================================================
# ENDPOINT 5: WEEKLY COMPARISON
# ============================================================================

# ============================================================================
# ENDPOINT 5: WEEKLY COMPARISON (FIXED PATH HANDLING)
# ============================================================================

@router.get("/progress/comparison")
async def get_weekly_comparison(
    weeks: int = 4,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    end = datetime.utcnow()
    start = end - timedelta(weeks=weeks)

    result = await db.execute(
        select(SkinImage)
        .where(
            SkinImage.user_id == user.id,
            SkinImage.captured_at.between(start, end),
        )
        .order_by(SkinImage.captured_at)
    )
    images = result.scalars().all()

    if len(images) < 2:
        return {"message": "Not enough images"}

    comparisons = []
    for i in range(len(images) - 1):
        try:
            comp = await vision_service.compare_images(images[i].image_url, images[i + 1].image_url)
            comparisons.append(comp)
        except Exception as e:
            print(f"Comparison failed: {e}")
            # Continue with next comparison even if one fails
            continue

    return {
        "user_id": str(user.id),
        "weeks": weeks,
        "comparisons": comparisons,
    }

# ============================================================================
# ENDPOINT 6: DELETE IMAGE
# ============================================================================

@router.delete("/image/{image_id}")
async def delete_skin_image(
    image_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SkinImage).where(
            SkinImage.id == image_id,
            SkinImage.user_id == user.id,
        )
    )
    image = result.scalar_one_or_none()

    if not image:
        raise HTTPException(404, "Image not found")

    storage.delete_image(image.image_url)
    await db.delete(image)
    await db.commit()

    return {"message": "Deleted", "image_id": str(image_id)}



# ============================================================================
# ENDPOINT 8: REFRESH IMPROVEMENT TRACKER (AUTHENTICATED) - SIMPLIFIED
# ============================================================================

@router.post("/improvement-tracker/refresh")
async def refresh_improvement_tracker(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Force refresh of improvement tracking data for authenticated user.
    Recalculates all progress metrics.
    """
    try:
        # Just recalculate - no need to clear anything since we're computing on-the-fly
        result = await db.execute(
            select(SkinImage)
            .where(SkinImage.user_id == user.id)
            .order_by(SkinImage.captured_at)
        )
        images = result.scalars().all()

        if len(images) < 2:
            return {
                "message": "Not enough images to track improvement. Upload at least 2 images.",
                "total_images": len(images),
                "weekly_improvements": [],
                "overall_trend": "insufficient_data"
            }

        # Get diagnoses for these images
        image_ids = [img.id for img in images]
        diag_result = await db.execute(
            select(SkinDiagnosis)
            .where(SkinDiagnosis.skin_image_id.in_(image_ids))
        )
        diagnoses = {d.skin_image_id: d for d in diag_result.scalars().all()}

        # Calculate weekly improvements
        weekly_improvements = []
        
        # Group images by week
        weeks = {}
        for img in images:
            week_start = img.captured_at - timedelta(days=img.captured_at.weekday())
            week_key = week_start.strftime("%Y-%W")
            if week_key not in weeks:
                weeks[week_key] = []
            weeks[week_key].append(img)

        # Compare consecutive weeks
        sorted_weeks = sorted(weeks.items())
        for i in range(1, len(sorted_weeks)):
            prev_week_key, prev_images = sorted_weeks[i-1]
            curr_week_key, curr_images = sorted_weeks[i]
            
            # Get average confidence for each week
            prev_confidences = [diagnoses[img.id].confidence for img in prev_images if img.id in diagnoses]
            curr_confidences = [diagnoses[img.id].confidence for img in curr_images if img.id in diagnoses]
            
            if prev_confidences and curr_confidences:
                prev_avg = sum(prev_confidences) / len(prev_confidences)
                curr_avg = sum(curr_confidences) / len(curr_confidences)
                confidence_change = curr_avg - prev_avg
                
                trend = "improving" if confidence_change > 0.05 else "worsening" if confidence_change < -0.05 else "stable"
                
                weekly_improvements.append({
                    "week_number": i,
                    "week_start": curr_week_key,
                    "trend": trend,
                    "confidence_change": confidence_change,
                    "summary": f"Week {i}: {trend.capitalize()} trend detected"
                })

        # Overall trend
        if weekly_improvements:
            avg_change = sum([w["confidence_change"] for w in weekly_improvements]) / len(weekly_improvements)
            overall_trend = "improving" if avg_change > 0.02 else "worsening" if avg_change < -0.02 else "stable"
        else:
            overall_trend = "insufficient_data"

        return {
            "message": "Improvement tracker refreshed successfully",
            "total_images": len(images),
            "weeks_tracked": len(weeks),
            "weekly_improvements": weekly_improvements,
            "overall_trend": overall_trend,
            "summary": f"Refreshed data for {len(images)} images over {len(weeks)} weeks"
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to refresh improvement tracker: {str(e)}"
        )

# ============================================================================
# FALLBACK: If ImprovementAnalyzer doesn't exist, use simple version
# ============================================================================

# If you don't have ImprovementAnalyzer service, use this simpler version:

@router.get("/improvement-tracker")
async def get_improvement_tracker(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Simple improvement tracker without analyzer service.
    Returns basic statistics about user's skin tracking.
    """
    from datetime import datetime, timedelta
    
    # Get all images with diagnoses
    result = await db.execute(
        select(SkinImage)
        .where(SkinImage.user_id == user.id)
        .order_by(SkinImage.captured_at)
    )
    images = result.scalars().all()

    if len(images) < 2:
        return {
            "message": "Not enough images to track improvement",
            "total_images": len(images),
            "weekly_improvements": [],
            "overall_trend": "insufficient_data"
        }

    # Get diagnoses for these images
    image_ids = [img.id for img in images]
    diag_result = await db.execute(
        select(SkinDiagnosis)
        .where(SkinDiagnosis.skin_image_id.in_(image_ids))
    )
    diagnoses = {d.skin_image_id: d for d in diag_result.scalars().all()}

    # Calculate weekly improvements
    weekly_improvements = []
    
    # Group images by week
    weeks = {}
    for img in images:
        week_start = img.captured_at - timedelta(days=img.captured_at.weekday())
        week_key = week_start.strftime("%Y-%W")
        if week_key not in weeks:
            weeks[week_key] = []
        weeks[week_key].append(img)

    # Compare consecutive weeks
    sorted_weeks = sorted(weeks.items())
    for i in range(1, len(sorted_weeks)):
        prev_week_key, prev_images = sorted_weeks[i-1]
        curr_week_key, curr_images = sorted_weeks[i]
        
        # Get average confidence for each week
        prev_confidences = [diagnoses[img.id].confidence for img in prev_images if img.id in diagnoses]
        curr_confidences = [diagnoses[img.id].confidence for img in curr_images if img.id in diagnoses]
        
        if prev_confidences and curr_confidences:
            prev_avg = sum(prev_confidences) / len(prev_confidences)
            curr_avg = sum(curr_confidences) / len(curr_confidences)
            confidence_change = curr_avg - prev_avg
            
            trend = "improving" if confidence_change > 0.05 else "worsening" if confidence_change < -0.05 else "stable"
            
            weekly_improvements.append({
                "week_number": i,
                "week_start": curr_week_key,
                "trend": trend,
                "confidence_change": confidence_change,
                "summary": f"Week {i}: {trend.capitalize()} trend detected"
            })

    # Overall trend
    if weekly_improvements:
        avg_change = sum([w["confidence_change"] for w in weekly_improvements]) / len(weekly_improvements)
        overall_trend = "improving" if avg_change > 0.02 else "worsening" if avg_change < -0.02 else "stable"
    else:
        overall_trend = "insufficient_data"

    return {
        "total_images": len(images),
        "weeks_tracked": len(weeks),
        "weekly_improvements": weekly_improvements,
        "overall_trend": overall_trend,
        "summary": f"Tracked {len(images)} images over {len(weeks)} weeks"
    }


# ============================================================================
# ENDPOINT: COMPARE TWO IMAGES (AUTHENTICATED)
# ============================================================================

@router.post("/compare")
async def compare_two_images(
    request: ImageCompareRequest,  # ✅ Use the Pydantic model
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Compare two skin images from authenticated user.
    
    Request body:
    {
        "before_image_id": "uuid",
        "after_image_id": "uuid"
    }
    """
    
    # Get both images and verify ownership
    before_result = await db.execute(
        select(SkinImage).where(
            SkinImage.id == request.before_image_id,
            SkinImage.user_id == user.id
        )
    )
    before_image = before_result.scalar_one_or_none()
    
    after_result = await db.execute(
        select(SkinImage).where(
            SkinImage.id == request.after_image_id,
            SkinImage.user_id == user.id
        )
    )
    after_image = after_result.scalar_one_or_none()
    
    if not before_image or not after_image:
        raise HTTPException(404, "One or both images not found")
    
    # Get diagnoses for both images
    before_diag_result = await db.execute(
        select(SkinDiagnosis).where(SkinDiagnosis.skin_image_id == request.before_image_id)
    )
    before_diag = before_diag_result.scalar_one_or_none()
    
    after_diag_result = await db.execute(
        select(SkinDiagnosis).where(SkinDiagnosis.skin_image_id == request.after_image_id)
    )
    after_diag = after_diag_result.scalar_one_or_none()
    
    if not before_diag or not after_diag:
        raise HTTPException(404, "Diagnosis data not found for one or both images")
    
    # Calculate comparison
    confidence_change = after_diag.confidence - before_diag.confidence
    improvement_detected = confidence_change > 0.1  # 10% improvement threshold
    
    # Calculate days between images
    days_between = (after_image.captured_at - before_image.captured_at).days
    
    # Generate summary
    if improvement_detected:
        summary = f"Improvement detected! Confidence increased by {(confidence_change * 100):.1f}% over {days_between} days."
    elif confidence_change < -0.1:
        summary = f"Condition may have worsened. Confidence decreased by {(abs(confidence_change) * 100):.1f}% over {days_between} days."
    else:
        summary = f"Condition appears stable over {days_between} days with minimal change."
    
    return {
        "before_image": {
            "image_id": str(before_image.id),
            "image_url": before_image.image_url,
            "prediction": before_diag.prediction,
            "confidence": before_diag.confidence,
            "captured_at": before_image.captured_at.isoformat()
        },
        "after_image": {
            "image_id": str(after_image.id),
            "image_url": after_image.image_url,
            "prediction": after_diag.prediction,
            "confidence": after_diag.confidence,
            "captured_at": after_image.captured_at.isoformat()
        },
        "improvement_detected": improvement_detected,
        "confidence_change": confidence_change,
        "days_between": days_between,
        "summary": summary
    }
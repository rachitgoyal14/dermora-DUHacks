# ============================================================================
# FILE: backend/app/services/report_generator.py (FIXED VERSION)
# ============================================================================

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc, func
from datetime import datetime, timedelta, date
from typing import Dict, List, Optional
from uuid import UUID
import json

from app.entities.skin_image import SkinImage
from app.entities.skin_diagnosis import SkinDiagnosis
from app.entities.improvement_record import ImprovementRecord
from app.core.config import settings
from app.services.improvement_analyzer import ImprovementAnalyzer

class ReportGenerator:
    """Generates comprehensive weekly reports using Azure OpenAI"""
    
    def __init__(self):
        self.analyzer = ImprovementAnalyzer()
        
        # Initialize Azure OpenAI client if configured
        if settings.AZURE_OPENAI_API_KEY:
            from openai import AzureOpenAI
            self.client = AzureOpenAI(
                api_key=settings.AZURE_OPENAI_API_KEY,
                api_version=settings.AZURE_OPENAI_API_VERSION,
                azure_endpoint=settings.AZURE_OPENAI_ENDPOINT
            )
        else:
            self.client = None
    
    def is_available(self) -> bool:
        """Check if report generation is available"""
        return self.client is not None
    
    async def gather_weekly_context(
        self,
        db: AsyncSession,
        user_id: UUID,
        week_start: date,
        week_end: date
    ) -> Optional[Dict]:
        """Gather all data for the week to send to LLM"""
        
        # Get all skin images and diagnoses for the week
        result = await db.execute(
            select(SkinImage, SkinDiagnosis)
            .join(SkinDiagnosis, SkinImage.id == SkinDiagnosis.skin_image_id)
            .where(
                and_(
                    SkinImage.user_id == user_id,
                    SkinImage.captured_at >= datetime.combine(week_start, datetime.min.time()),
                    SkinImage.captured_at <= datetime.combine(week_end, datetime.max.time())
                )
            )
            .order_by(SkinImage.captured_at.asc())
        )
        images_data = result.all()
        
        if not images_data:
            return None
        
        # Build diagnoses list
        diagnoses_list = []
        conditions = []
        confidences = []
        
        for img, diag in images_data:
            diagnoses_list.append({
                "date": img.captured_at.isoformat(),
                "condition": diag.prediction,
                "confidence": diag.confidence,
                "image_type": img.image_type
            })
            conditions.append(diag.prediction)
            confidences.append(diag.confidence)
        
        # Determine primary condition (most common)
        from collections import Counter
        primary_condition = Counter(conditions).most_common(1)[0][0]
        average_confidence = sum(confidences) / len(confidences)
        
        # Get improvement record if exists
        result = await db.execute(
            select(ImprovementRecord).where(
                and_(
                    ImprovementRecord.user_id == user_id,
                    ImprovementRecord.week_start_date == week_start
                )
            )
        )
        improvement_record = result.scalar_one_or_none()
        
        # Get previous week for comparison
        prev_week_start = week_start - timedelta(days=7)
        prev_week_end = prev_week_start + timedelta(days=6)
        
        result = await db.execute(
            select(ImprovementRecord).where(
                and_(
                    ImprovementRecord.user_id == user_id,
                    ImprovementRecord.week_start_date == prev_week_start
                )
            )
        )
        previous_week_record = result.scalar_one_or_none()
        
        # Build current week data
        current_week_data = {
            "primary_condition": primary_condition,
            "average_confidence": average_confidence,
            "improvement_percentage": None,
            "severity_trend": "unknown",
            "medical_advice": None
        }
        
        if improvement_record:
            current_week_data.update({
                "improvement_percentage": improvement_record.improvement_percentage,
                "severity_trend": improvement_record.severity_trend or "unknown",
                "medical_advice": improvement_record.medical_advice,
                "average_severity_score": improvement_record.average_severity_score
            })
        
        # Build previous week data
        previous_week_data = None
        if previous_week_record:
            previous_week_data = {
                "primary_condition": previous_week_record.primary_condition,
                "average_confidence": previous_week_record.average_confidence,
                "improvement_percentage": previous_week_record.improvement_percentage
            }
        
        # Build context dictionary
        context = {
            "week_period": {
                "start": week_start.isoformat(),
                "end": week_end.isoformat()
            },
            "total_images": len(images_data),
            "diagnoses": diagnoses_list,
            "current_week": current_week_data,
            "previous_week": previous_week_data
        }
        
        return context
    
    async def generate_report_with_llm(
        self,
        context: Dict,
        user_id: UUID
    ) -> Dict:
        """Use Azure OpenAI to generate comprehensive report"""
        
        if not self.is_available():
            raise Exception("Azure OpenAI not configured")
        
        week_start = context["week_period"]["start"]
        week_end = context["week_period"]["end"]
        current_week = context.get("current_week", {})
        
        prompt = f"""You are a dermatology AI assistant creating a comprehensive weekly skin health report.

**Patient Context:**
- Week: {week_start} to {week_end}
- Total images uploaded: {context["total_images"]}
- Current condition: {current_week.get("primary_condition", "unknown")}
- Improvement vs last week: {current_week.get("improvement_percentage", "N/A")}%
- Severity trend: {current_week.get("severity_trend", "unknown")}

**Detailed Diagnoses:**
{json.dumps(context["diagnoses"], indent=2)}

**Previous Week Comparison:**
{json.dumps(context.get("previous_week", {}), indent=2)}

Generate a comprehensive medical report in JSON format with:

1. **report_title**: Catchy, encouraging title (e.g., "Week of Progress: Your Eczema Journey")
2. **condition_summary**: 2-3 sentence overview of the week's skin condition status
3. **key_insights**: Array of 3-5 insights, each with:
   - title: Short insight title
   - description: Detailed explanation
   - severity: 'positive', 'neutral', or 'negative'
   - icon: Relevant emoji (📈, ⚠️, ✅, 📊, 🎯)

4. **recommendations**: Array of 3-5 actionable recommendations, each with:
   - category: 'treatment', 'lifestyle', or 'monitoring'
   - action: Specific action to take
   - priority: 'high', 'medium', or 'low'
   - reasoning: Why this recommendation matters

5. **metrics_interpretation**: Natural language explanation of the numbers

6. **next_steps**: What the patient should do next week

Respond ONLY with valid JSON in this exact structure:
{{
    "report_title": "Your Week in Skin Health",
    "condition_summary": "...",
    "key_insights": [
        {{
            "title": "...",
            "description": "...",
            "severity": "positive",
            "icon": "📈"
        }}
    ],
    "recommendations": [
        {{
            "category": "treatment",
            "action": "...",
            "priority": "high",
            "reasoning": "..."
        }}
    ],
    "metrics_interpretation": "...",
    "next_steps": "..."
}}

Be encouraging but honest. Use medical terminology accurately but explain it clearly. Focus on actionable insights."""

        try:
            response = self.client.chat.completions.create(
                model=settings.AZURE_OPENAI_DEPLOYMENT,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a compassionate dermatology AI assistant creating personalized weekly skin health reports. Be professional, encouraging, and actionable."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=2000,
                temperature=0.7
            )
            
            # Parse JSON response
            response_text = response.choices[0].message.content
            
            # Remove markdown code blocks if present
            if response_text.startswith("```json"):
                response_text = response_text.replace("```json", "").replace("```", "").strip()
            elif response_text.startswith("```"):
                response_text = response_text.replace("```", "").strip()
            
            report_json = json.loads(response_text)
            return report_json
            
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            print(f"Raw response: {response_text}")
            raise Exception(f"Failed to parse LLM response as JSON: {str(e)}")
        except Exception as e:
            print(f"LLM generation error: {e}")
            raise
    
    
    def generate_html_report(
        self,
        report_data: Dict,
        context: Dict
    ) -> str:
        """Generate professional HTML report for display"""
        
        week_start = context["week_period"]["start"]
        week_end = context["week_period"]["end"]
        current_week = context.get("current_week", {})
        
        # Map severity to professional indicators
        severity_indicators = {
            'positive': {'color': '#10b981', 'bg': '#ecfdf5', 'label': 'Positive'},
            'negative': {'color': '#ef4444', 'bg': '#fef2f2', 'label': 'Attention Required'},
            'neutral': {'color': '#3b82f6', 'bg': '#eff6ff', 'label': 'Stable'}
        }
        
        html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Weekly Skin Health Report</title>
        <style>
            * {{
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }}
            
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
                line-height: 1.6;
                color: #1f2937;
                background: #f9fafb;
                padding: 0;
            }}
            
            .report-container {{
                max-width: 900px;
                margin: 0 auto;
                background: white;
            }}
            
            .report-header {{
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                color: white;
                padding: 48px 40px;
            }}
            
            .report-title {{
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 12px;
                letter-spacing: -0.5px;
            }}
            
            .report-subtitle {{
                font-size: 16px;
                opacity: 0.95;
                font-weight: 400;
            }}
            
            .report-meta {{
                display: flex;
                gap: 24px;
                margin-top: 24px;
                padding-top: 24px;
                border-top: 1px solid rgba(255,255,255,0.2);
            }}
            
            .meta-item {{
                display: flex;
                flex-direction: column;
            }}
            
            .meta-label {{
                font-size: 13px;
                opacity: 0.8;
                margin-bottom: 4px;
            }}
            
            .meta-value {{
                font-size: 18px;
                font-weight: 600;
            }}
            
            .report-content {{
                padding: 40px;
            }}
            
            .section {{
                margin-bottom: 40px;
            }}
            
            .section-header {{
                display: flex;
                align-items: center;
                margin-bottom: 20px;
                padding-bottom: 12px;
                border-bottom: 2px solid #e5e7eb;
            }}
            
            .section-title {{
                font-size: 20px;
                font-weight: 700;
                color: #111827;
            }}
            
            .summary-text {{
                font-size: 16px;
                line-height: 1.8;
                color: #374151;
            }}
            
            .insights-grid {{
                display: grid;
                gap: 16px;
            }}
            
            .insight-card {{
                padding: 20px;
                border-radius: 8px;
                border-left: 4px solid;
                transition: transform 0.2s;
            }}
            
            .insight-card:hover {{
                transform: translateX(4px);
            }}
            
            .insight-header {{
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 12px;
            }}
            
            .insight-title {{
                font-size: 16px;
                font-weight: 600;
                color: #111827;
            }}
            
            .insight-badge {{
                display: inline-block;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }}
            
            .insight-description {{
                font-size: 14px;
                line-height: 1.6;
                color: #4b5563;
            }}
            
            .recommendations-list {{
                display: grid;
                gap: 16px;
            }}
            
            .recommendation-card {{
                padding: 20px;
                background: #f9fafb;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
            }}
            
            .recommendation-header {{
                display: flex;
                align-items: start;
                justify-content: space-between;
                margin-bottom: 12px;
            }}
            
            .recommendation-action {{
                font-size: 16px;
                font-weight: 600;
                color: #111827;
                flex: 1;
            }}
            
            .priority-badge {{
                display: inline-block;
                padding: 4px 12px;
                border-radius: 12px;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                white-space: nowrap;
            }}
            
            .priority-high {{
                background: #fef2f2;
                color: #991b1b;
                border: 1px solid #fecaca;
            }}
            
            .priority-medium {{
                background: #fef3c7;
                color: #92400e;
                border: 1px solid #fde68a;
            }}
            
            .priority-low {{
                background: #eff6ff;
                color: #1e3a8a;
                border: 1px solid #bfdbfe;
            }}
            
            .recommendation-reasoning {{
                font-size: 14px;
                line-height: 1.6;
                color: #6b7280;
            }}
            
            .recommendation-category {{
                display: inline-block;
                font-size: 12px;
                color: #6b7280;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 8px;
            }}
            
            .metrics-grid {{
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-top: 20px;
            }}
            
            .metric-card {{
                background: #f9fafb;
                padding: 24px;
                border-radius: 8px;
                border: 1px solid #e5e7eb;
                text-align: center;
            }}
            
            .metric-value {{
                font-size: 36px;
                font-weight: 700;
                color: #4f46e5;
                margin-bottom: 8px;
            }}
            
            .metric-label {{
                font-size: 13px;
                color: #6b7280;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                font-weight: 600;
            }}
            
            .next-steps-box {{
                background: #eff6ff;
                padding: 24px;
                border-radius: 8px;
                border-left: 4px solid #3b82f6;
            }}
            
            .next-steps-text {{
                font-size: 15px;
                line-height: 1.8;
                color: #1e3a8a;
            }}
            
            .report-footer {{
                background: #f9fafb;
                padding: 32px 40px;
                text-align: center;
                border-top: 1px solid #e5e7eb;
            }}
            
            .footer-text {{
                font-size: 13px;
                color: #6b7280;
                line-height: 1.6;
            }}
            
            @media print {{
                body {{ background: white; }}
                .report-container {{ box-shadow: none; }}
            }}
        </style>
    </head>
    <body>
        <div class="report-container">
            <header class="report-header">
                <h1 class="report-title">{report_data.get('report_title', 'Weekly Skin Health Report')}</h1>
                <p class="report-subtitle">Comprehensive Analysis & Recommendations</p>
                <div class="report-meta">
                    <div class="meta-item">
                        <span class="meta-label">Reporting Period</span>
                        <span class="meta-value">{week_start} to {week_end}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Images Analyzed</span>
                        <span class="meta-value">{context['total_images']}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Primary Condition</span>
                        <span class="meta-value">{current_week.get('primary_condition', 'N/A').title()}</span>
                    </div>
                </div>
            </header>
            
            <main class="report-content">
                <!-- Executive Summary -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Executive Summary</h2>
                    </div>
                    <p class="summary-text">{report_data.get('condition_summary', 'Report generated successfully.')}</p>
                </section>
                
                <!-- Key Insights -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Clinical Insights</h2>
                    </div>
                    <div class="insights-grid">
    """
        
        # Add insights
        for insight in report_data.get('key_insights', []):
            severity = insight.get('severity', 'neutral')
            indicator = severity_indicators.get(severity, severity_indicators['neutral'])
            
            html += f"""
                        <div class="insight-card" style="background: {indicator['bg']}; border-color: {indicator['color']};">
                            <div class="insight-header">
                                <h3 class="insight-title">{insight.get('title', 'Insight')}</h3>
                                <span class="insight-badge" style="background: {indicator['color']}; color: white;">
                                    {indicator['label']}
                                </span>
                            </div>
                            <p class="insight-description">{insight.get('description', '')}</p>
                        </div>
    """
        
        html += """
                    </div>
                </section>
                
                <!-- Recommendations -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Recommended Actions</h2>
                    </div>
                    <div class="recommendations-list">
    """
        
        # Add recommendations
        for rec in report_data.get('recommendations', []):
            priority = rec.get('priority', 'medium').lower()
            category = rec.get('category', 'general').title()
            
            html += f"""
                        <div class="recommendation-card">
                            <div class="recommendation-category">{category}</div>
                            <div class="recommendation-header">
                                <div class="recommendation-action">{rec.get('action', '')}</div>
                                <span class="priority-badge priority-{priority}">{priority}</span>
                            </div>
                            <p class="recommendation-reasoning">{rec.get('reasoning', '')}</p>
                        </div>
    """
        
        # Calculate metrics with safe defaults
        avg_confidence = current_week.get('average_confidence', 0)
        if isinstance(avg_confidence, (int, float)):
            confidence_display = f"{avg_confidence:.0%}"
        else:
            confidence_display = "N/A"
        
        improvement = current_week.get('improvement_percentage')
        if improvement is not None:
            improvement_display = f"{improvement:+.1f}%"
        else:
            improvement_display = "N/A"
        
        html += f"""
                    </div>
                </section>
                
                <!-- Metrics -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Key Metrics</h2>
                    </div>
                    <p class="summary-text">{report_data.get('metrics_interpretation', 'Weekly metrics have been calculated and analyzed.')}</p>
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <div class="metric-value">{context['total_images']}</div>
                            <div class="metric-label">Images Analyzed</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value">{confidence_display}</div>
                            <div class="metric-label">Average Confidence</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-value">{improvement_display}</div>
                            <div class="metric-label">Weekly Change</div>
                        </div>
                    </div>
                </section>
                
                <!-- Next Steps -->
                <section class="section">
                    <div class="section-header">
                        <h2 class="section-title">Next Steps</h2>
                    </div>
                    <div class="next-steps-box">
                        <p class="next-steps-text">{report_data.get('next_steps', 'Continue monitoring your skin condition and follow the recommendations provided above.')}</p>
                    </div>
                </section>
            </main>
            
            <footer class="report-footer">
                <p class="footer-text">
                    This report is generated by AI analysis and should not replace professional medical advice.<br>
                    Always consult with a qualified dermatologist for diagnosis and treatment decisions.
                </p>
            </footer>
        </div>
    </body>
    </html>
    """
        
        return html
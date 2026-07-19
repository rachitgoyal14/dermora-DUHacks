import os
import base64
from typing import Tuple, Dict
from openai import AzureOpenAI
from app.core.config import settings

class AzureVisionService:
    """Service for Azure OpenAI Vision API interactions."""
    
    def __init__(self):
        self.client = AzureOpenAI(
            api_key=settings.AZURE_OPENAI_API_KEY,
            api_version=settings.AZURE_OPENAI_API_VERSION,
            azure_endpoint=settings.AZURE_OPENAI_ENDPOINT
        )
        self.deployment = settings.AZURE_OPENAI_DEPLOYMENT
    
    async def _encode_image(self, image_url: str) -> str:
        """Encode image to base64 from a URL."""
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(image_url)
            resp.raise_for_status()
            return base64.b64encode(resp.content).decode('utf-8')
    
    async def analyze_single_image(self, image_url: str) -> Dict:
        """
        Analyze a single skin image and extract detailed metrics.
        
        Returns:
            {
                "condition": "eczema",
                "severity": "moderate",
                "severity_score": 65,
                "affected_area_percentage": 12.5,
                "redness_level": 7.2,
                "texture_roughness": 6.8,
                "description": "Moderate eczema with..."
             }
        """
        
        base64_image = await self._encode_image(image_url)
        
        prompt = """You are a dermatology AI assistant. Analyze this skin condition image and provide:

1. Condition type (eczema, psoriasis, vitiligo, or normal skin)
2. Severity level (mild, moderate, severe)
3. Severity score (0-100, where 0=healthy, 100=most severe)
4. Estimated affected area percentage (0-100%)
5. Redness intensity (0-10 scale)
6. Texture roughness (0-10 scale, where 0=smooth, 10=very rough)
7. Brief clinical description

Respond ONLY in this JSON format:
{
    "condition": "eczema",
    "severity": "moderate",
    "severity_score": 65,
    "affected_area_percentage": 12.5,
    "redness_level": 7.2,
    "texture_roughness": 6.8,
    "description": "Clinical description here"
}"""

        response = self.client.chat.completions.create(
            model=self.deployment,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            max_tokens=500,
            temperature=0.3  # Lower temperature for more consistent medical analysis
        )
        
        # Parse JSON response
        import json
        result = json.loads(response.choices[0].message.content)
        return result
    
    async def compare_images(
        self,
        before_image_url: str,
        after_image_url: str
    ) -> Dict:
        """
        Compare two skin images and determine improvement.
        
        Returns:
            {
                "improvement_detected": true,
                "improvement_percentage": 35.2,
                "severity_change": "moderate -> mild",
                "affected_area_change": "15% -> 9.5%",
                "detailed_analysis": "...",
                "recommendations": ["..."]
            }
        """
        
        before_base64 = await self._encode_image(before_image_url)
        after_base64 = await self._encode_image(after_image_url)
        
        prompt = """You are a dermatology AI assistant comparing two skin condition images taken over time.

IMAGE 1 (BEFORE): Earlier photo
IMAGE 2 (AFTER): Recent photo

Analyze both images and provide:
1. Whether improvement was detected (true/false)
2. Percentage of improvement (0-100%, negative if worsened)
3. Change in severity (e.g., "moderate -> mild")
4. Change in affected area (e.g., "15% -> 9.5%")
5. Detailed clinical analysis comparing the two
6. List of recommendations for continued treatment

Respond ONLY in this JSON format:
{
    "improvement_detected": true,
    "improvement_percentage": 35.2,
    "severity_change": "moderate -> mild",
    "before_severity_score": 68,
    "after_severity_score": 44,
    "affected_area_change": "15% -> 9.5%",
    "redness_change": "7.5 -> 4.2",
    "texture_change": "rough -> smoother",
    "detailed_analysis": "Clinical comparison here",
    "recommendations": ["Continue current treatment", "Monitor for..."]
}"""

        response = self.client.chat.completions.create(
            model=self.deployment,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{before_base64}",
                                "detail": "high"  # Use high detail for medical images
                            }
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{after_base64}",
                                "detail": "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens=800,
            temperature=0.3
        )
        
        import json
        result = json.loads(response.choices[0].message.content)
        return result


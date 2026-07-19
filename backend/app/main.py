import os
from fastapi import FastAPI
from app.routers import skin, mood, voice, analytics, reports, user_engagement
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.auth import routes

app = FastAPI(
    title="Dermora Backend",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",  # Alternative dev port
        "http://localhost:3002",  # Vite fallback port
        "http://localhost:5173",  # Vite default
        "http://localhost:8000",  # Backend itself (for testing)
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3002",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) 
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads", "skin_images")

app.mount(
    "/uploads/skin_images",
    StaticFiles(directory=UPLOADS_DIR),
    name="skin_images"
)
app.include_router(routes.router)
app.include_router(skin.router)
app.include_router(mood.router)
app.include_router(voice.router)
app.include_router(analytics.router)
app.include_router(reports.router)
app.include_router(user_engagement.router)


@app.get("/")
async def home():
    return {"status: ok"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}


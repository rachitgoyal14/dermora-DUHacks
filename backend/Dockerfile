FROM python:3.11-slim

# Install system dependencies
# ffmpeg is required for audio normalization/conversion in the voice mood pipeline
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend files
COPY . .

# Create the uploads directory defensively to prevent any legacy path existence check failure
RUN mkdir -p uploads/skin_images

# Expose backend port
EXPOSE 8000

# Default command for development (hot-reload enabled)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

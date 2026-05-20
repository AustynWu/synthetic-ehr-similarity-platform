# backend/Dockerfile — FastAPI backend
#
# Dependencies are installed at image build time so container startup is fast.
# Source code is mounted as a volume in docker-compose.yml so --reload works
# during development without rebuilding the image.

FROM python:3.12-slim

WORKDIR /app

# Install dependencies first — Docker caches this layer separately from source code.
# If only .py files change, this layer is reused and pip install is skipped.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main_new:app", "--host", "0.0.0.0", "--port", "8000"]

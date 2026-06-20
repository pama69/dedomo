# ── Stage 1: build React frontend ──
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/yarn.lock* frontend/package-lock.json* ./
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    else npm ci; fi
COPY frontend/ ./
RUN if [ -f yarn.lock ]; then yarn build; \
    else npm run build; fi

# ── Stage 2: Python backend + static frontend ──
FROM python:3.12-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libxml2-dev libxslt1-dev gcc g++ && \
    rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ ./
COPY static/ ./static/
COPY --from=frontend /app/frontend/build ./frontend_build

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT}"]

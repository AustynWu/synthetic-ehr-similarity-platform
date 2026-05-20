# frontend/Dockerfile — two-stage build: Vite compile → nginx serve
#
# Stage 1: Node builds the React app into static files (dist/)
# Stage 2: nginx serves those static files on port 80
#
# VITE_* variables must be passed at BUILD time (not runtime) because
# Vite bakes them into the JS bundle during compilation.
# Pass them via docker-compose build args (see docker-compose.yml).

# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Build-time env vars — Vite reads these during npm run build
ARG VITE_USE_REAL_API=true
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_USE_REAL_API=$VITE_USE_REAL_API
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ── Stage 2: serve ────────────────────────────────────────────────────────────
FROM nginx:alpine

# Copy compiled static files from the build stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config — needed for React Router (SPA routing)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

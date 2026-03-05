# Synthetic vs Real EHR Similarity Evaluation Platform (Capstone)

A web platform to evaluate how similar **synthetic health records** are compared to **real health records**.
Users can upload datasets, run similarity tests, and view results in a clear dashboard.

---

## Tech Stack (Planned)
- Backend: Python + FastAPI
- Data/ML: pandas / numpy / scipy / scikit-learn
- Database: PostgreSQL
- Frontend: React (Vite)
- Deployment: Docker Compose (backend + db), CI later

---

## Repo Structure
```
synthetic-ehr-similarity-platform/
  frontend/          # React (Vite)
  backend/           # FastAPI
  docs/              # proposal, meeting notes, report drafts
  infra/             # db scripts (optional)
  docker-compose.yml
  README.md
```

---

## Quick Start (Docker) ✅ Recommended
### Requirements
- Docker Desktop (Windows/Mac)

### Start services
From the repo root:
```bash
docker compose up -d --build
docker ps
```

Backend:
- API: http://localhost:8000
- Swagger docs: http://localhost:8000/docs

View backend logs:
```bash
docker compose logs -f backend
```

Stop:
```bash
docker compose down
```

---

## Run Backend Locally (without Docker)
### Requirements
- Python 3.12+

From `backend/`:
```bash
python -m venv .venv
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install fastapi "uvicorn[standard]"
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Check:
- http://localhost:8000/health
- http://localhost:8000/docs

---

## Run Frontend Locally
### Requirements
- Node.js (LTS)

From `frontend/`:
```bash
npm install
npm run dev
```

Open:
- http://localhost:5173

---

## Team Workflow (Simple)
- `main`: stable demo-ready version
- `dev`: integration branch
- Use `feature/...` branches and open PRs to `dev`

---

## Notes
- Do NOT commit real/sensitive datasets to Git.
- Use anonymized/sample files only if needed.

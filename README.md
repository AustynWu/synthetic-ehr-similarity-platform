# Synthetic vs Real EHR Similarity Evaluation Platform

A web platform to evaluate how similar **synthetic health records** are compared to **real health records**.
Upload two CSV datasets, run statistical similarity metrics, and view results in an interactive dashboard.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12 + FastAPI |
| Data / Stats | pandas, numpy, scipy, scikit-learn |
| Frontend | React 18 + Vite + TypeScript |
| Database | MySQL 8 (default) or PostgreSQL 16 (supervisor backup, one-line switch) |
| Deployment | Docker Compose |

---

## Repo Structure

```
synthetic-ehr-similarity-platform-prototype/
├── backend/
│   ├── main_new.py          # entry point (modular version)
│   ├── schemas.py           # Pydantic request/response models
│   ├── constants.py         # thresholds and shared config
│   ├── state.py             # in-memory state for uploaded CSVs
│   ├── .env                 # local env variables (DB_TYPE, DB_USER etc — not committed)
│   ├── db/
│   │   ├── session.py       # SQLAlchemy engine, DB_AVAILABLE flag
│   │   ├── models.py        # EvaluationRun ORM table
│   │   └── repository.py    # save / list / get_by_id / delete
│   ├── routers/
│   │   ├── upload.py        # POST /datasets/upload
│   │   ├── validation.py    # POST /datasets/validate
│   │   ├── evaluation.py    # POST /evaluations/run
│   │   └── comparisons.py   # GET/POST /comparisons (DB + in-memory fallback)
│   ├── services/
│   │   ├── metrics.py       # statistical metric calculations
│   │   ├── type_inference.py
│   │   ├── detail_views.py  # chart data generation
│   │   └── multivariate.py  # cross-variable analysis
│   ├── uploads/             # temporary CSV storage
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # root component and page state
│   │   ├── pages/           # Upload, Validation, Setup, Results, Saved, RunDetail
│   │   ├── components/      # reusable UI components
│   │   ├── services/        # API client (dataset, evaluation, comparison)
│   │   └── types/contracts.ts
│   ├── Dockerfile           # Node build → nginx serve (two-stage)
│   ├── nginx.conf           # SPA routing config for React Router
│   └── package.json
├── datasets/                # sample data (real + synthetic diabetic dataset)
├── docker-compose.yml
├── .env                     # Docker Compose credentials (not committed)
├── .env.example             # credentials template (safe to commit)
└── README.md
```

---

## User Workflow

```
1. Upload    — upload real CSV and synthetic CSV
2. Validate  — auto-compare column schemas and types
3. Setup     — choose metrics and columns to analyse
4. Results   — view similarity scores, charts, and insights
5. Save      — save the run for later review
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health check |
| POST | `/datasets/upload` | Upload two CSV files |
| POST | `/datasets/validate` | Compare schemas by dataset ID |
| POST | `/evaluations/run` | Run similarity metrics |
| POST | `/comparisons/save` | Save a completed run |
| GET | `/comparisons` | List all saved runs |
| GET | `/comparisons/{run_id}` | Get full result for one run |

Interactive API docs: `http://localhost:8000/docs`

---

## Quick Start (Docker)

### Requirements
- Docker Desktop

### First-time setup

```bash
# 1. Copy the credentials template and edit if needed (default values work out of the box)
cp .env.example .env

# 2. Build images and start all services (MySQL + backend + frontend)
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API docs: http://localhost:8000/docs

The backend image is built from `backend/Dockerfile` and the frontend from `frontend/Dockerfile`.
On first run, Docker installs all Python and Node dependencies inside the images — this takes a few minutes.
Subsequent runs reuse the cached layers and start much faster.

### Useful commands

```bash
# Run in background
docker compose up -d --build

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Rebuild one service after changing its Dockerfile or dependencies
docker compose up --build backend

# Stop and keep DB data
docker compose down

# Stop and wipe DB data (full reset)
docker compose down -v
```

---

## Run Locally (without Docker)

### Backend

Requirements: Python 3.12+

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main_new:app --reload --port 8000
```

Check:
- http://localhost:8000/health
- http://localhost:8000/docs

### Frontend

Requirements: Node.js LTS

```bash
cd frontend
npm install
npm run dev
```

Open: http://localhost:5173

---

## Implemented Metrics

| Metric | Applies To |
|--------|-----------|
| Mean Difference | Numerical |
| KS Test | Numerical |
| Wasserstein Distance | Numerical |
| Chi-square | Categorical |
| Category Proportion Difference | Categorical |
| Correlation Difference | Numerical pairs |

All metrics are normalised to a **0–1 score** (1 = identical distributions).

---

## Team Workflow

- `main`: stable demo-ready version
- `dev`: integration branch
- Use `feature/...` branches and open PRs to `dev`

---

## Database Configuration

Saved comparison runs are stored in a database so they survive server restarts.
The database driver is chosen by a single environment variable — no code changes needed.

### Supported databases

| Database | DB_TYPE value | Port | Notes |
|----------|--------------|------|-------|
| **MySQL** *(default)* | `mysql` | 3306 | Teammate's original setup |
| **PostgreSQL** *(supervisor backup)* | `postgres` | 5432 | Required by course supervisor |
| **None** *(fallback)* | *(leave DB_TYPE empty)* | — | In-memory only — data lost on restart |

Only one database is active at a time. Both drivers (`psycopg2-binary` and `pymysql`)
are installed so switching requires only two line changes.

### How to switch to PostgreSQL

**Local development — edit `backend/.env`:**
```
DB_TYPE=postgres
DB_PORT=5432
```

**Docker Compose — edit `docker-compose.yml`:**
1. Comment out the `db_mysql` service block, uncomment `db_postgres`.
2. In the `backend` service, change `depends_on` to `db_postgres`.
3. Change `DB_TYPE: mysql` → `DB_TYPE: postgres` and `DB_PORT: "3306"` → `DB_PORT: "5432"`.

### Why two databases are supported

The course supervisor requires **PostgreSQL**, but the teammate's original
implementation used **MySQL**. Since SQLAlchemy abstracts the database layer,
both are fully supported with no code duplication — only `DB_TYPE` and `DB_PORT` differ.

---

## Notes

- Uploaded CSV files are temporary — they are lost on server restart and must be
  re-uploaded. This is by design for a prototype; only the evaluation *results* are persisted.
- The `backend/.env` file is not committed to git. Add it to `.gitignore`.

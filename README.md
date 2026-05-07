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
| Database | PostgreSQL 16 (planned — currently in-memory) |
| Deployment | Docker Compose |

---

## Repo Structure

```
synthetic-ehr-similarity-platform-prototype/
├── backend/
│   ├── main_new.py          # entry point (modular version)
│   ├── main.py              # original monolithic version
│   ├── schemas.py           # Pydantic request/response models
│   ├── constants.py         # thresholds and shared config
│   ├── state.py             # in-memory state (datasets, results)
│   ├── routers/
│   │   ├── upload.py        # POST /datasets/upload
│   │   ├── validation.py    # POST /datasets/validate
│   │   ├── evaluation.py    # POST /evaluations/run
│   │   └── comparisons.py   # GET/POST /comparisons
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
│   └── package.json
├── datasets/                # sample data (real + synthetic diabetic dataset)
├── docker-compose.yml
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

### Start services

From the repo root:
```bash
docker compose up -d --build
docker ps
```

- Backend API: http://localhost:8000/docs
- Frontend: http://localhost:5173

View backend logs:
```bash
docker compose logs -f backend
```

Stop:
```bash
docker compose down
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

## Notes

- Do NOT commit real or sensitive datasets to Git.
- Backend state is currently in-memory — data is lost on server restart.
- PostgreSQL integration is planned as the next major milestone.

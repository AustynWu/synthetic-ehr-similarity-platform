# main_new.py — application entry point after modular refactor
#
# Run with:  uvicorn main_new:app --reload
#
# Why modular structure instead of one large main.py?
# Splitting each API group into its own router file means:
#   - A developer working on upload logic does not need to scroll past evaluation code.
#   - Each router can be read and tested in isolation.
#   - The import graph is explicit: each router declares exactly what it needs.
#
# Module layout:
#   routers/upload.py       POST /datasets/upload
#   routers/validation.py   POST /datasets/validate
#   routers/evaluation.py   POST /evaluations/run
#   routers/comparisons.py  POST /comparisons/save
#                           GET  /comparisons
#                           GET  /comparisons/{id}
#
# Shared state:   state.py      (in-memory dicts, imported by all routers)
# Shared config:  constants.py  (thresholds, column lists, metric catalogue)
# Business logic: services/     (type_inference, metrics, detail_views, multivariate)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from routers import upload, validation, evaluation, comparisons
from db.session import create_tables


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once when the server starts — creates DB tables if they don't exist.
    # create_tables() is a no-op when DB_URL is not set (no DB configured).
    create_tables()
    yield


app = FastAPI(title="Synthetic vs Real EHR Similarity API", lifespan=lifespan)

# CORS is required because the frontend (Vite dev server on port 5173) and this
# backend (uvicorn on port 8000) run as separate processes with different origins.
# Without this middleware, the browser blocks all cross-origin API calls.
# allow_origins is intentionally restrictive — only the local dev frontend is allowed.
# In a production deployment this would be replaced with the actual domain name.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://synthetic-ehr-similarity-platform.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# include_router() registers all the route handlers from each module.
# The order here does not affect routing — FastAPI matches by HTTP method + path,
# not by registration order.
app.include_router(upload.router)
app.include_router(validation.router)
app.include_router(evaluation.router)
app.include_router(comparisons.router)


@app.get("/health")
def health():
    # Simple liveness check — the frontend polls this on startup to confirm
    # the backend is running before enabling the upload button.
    return {"status": "ok"}

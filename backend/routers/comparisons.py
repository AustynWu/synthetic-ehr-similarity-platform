# routers/comparisons.py — save and retrieve evaluation runs
#
# After reviewing the Results page, the user can save a run for future reference.
#
# Storage strategy:
#   DB_AVAILABLE = True  → persist to PostgreSQL or MySQL via SQLAlchemy
#   DB_AVAILABLE = False → fall back to in-memory lists (original behaviour)
#
# The in-memory fallback means the app still works during local development
# without a running database.  Data is lost on server restart in fallback mode.
#
# Adapted from teammate's app/router/evaluation/evaluation_run.py.
# Key differences: uses our existing schemas (SavedComparison, EvaluationResult),
# string run IDs instead of integer PKs, and stores dataset names not FK integers.

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from schemas import SaveComparisonRequest, SavedComparison, EvaluationResult
from db.session import DB_AVAILABLE, get_db
from db.repository import (
    save_evaluation_run,
    get_all_evaluation_runs,
    get_evaluation_run_by_id,
)

router = APIRouter()

# ── In-memory fallback storage (used only when DB_AVAILABLE is False) ─────────
# These lists mirror the original state.py behaviour so the app still runs
# without a database configured.
_mem_comparisons: list[SavedComparison] = []
_mem_results: dict[str, EvaluationResult] = {}


# ── Helper: build a SavedComparison from an ORM record ────────────────────────
def _row_to_summary(row) -> SavedComparison:
    """Convert a db EvaluationRun row to the SavedComparison schema the
    frontend expects.  Only lightweight fields — no result_json."""
    return SavedComparison(
        id=row.run_id,
        runName=row.run_name,
        createdAt=row.created_at.isoformat() if row.created_at else "",
        createdAtLabel=row.created_at_label or "",
        realDatasetName=row.real_dataset_name or "",
        syntheticDatasetName=row.synthetic_dataset_name or "",
        overallSimilarityScore=float(row.overall_similarity_score or 0),
        metricsUsed=row.metrics_used or [],
        status=row.status or "completed",
    )


# ── POST /comparisons/save ─────────────────────────────────────────────────────
@router.post("/comparisons/save", response_model=SavedComparison)
def save_comparison(
    req: SaveComparisonRequest,
    db: Annotated[Session, Depends(get_db)] if DB_AVAILABLE else None,
):
    now    = datetime.now(timezone.utc)
    result = req.evaluationResult
    run_id = f"run-{uuid.uuid4().hex[:8]}"

    if DB_AVAILABLE:
        # Persist to database — result is serialised to a plain dict so
        # SQLAlchemy can store it as JSON without any Pydantic objects inside.
        row = save_evaluation_run(
            db=db,
            run_id=run_id,
            run_name=f"Evaluation - {req.syntheticDatasetName}",
            real_dataset_name=req.realDatasetName,
            synthetic_dataset_name=req.syntheticDatasetName,
            overall_score=result.summary.overallSimilarityScore,
            numerical_score=result.summary.numericalSimilarityScore,
            categorical_score=result.summary.categoricalSimilarityScore,
            relationship_score=result.summary.relationshipSimilarityScore,
            metrics_used=[str(m) for m in req.metricsUsed],
            result_dict=result.model_dump(),
        )
        return _row_to_summary(row)

    # Fallback: in-memory (original behaviour)
    new_record = SavedComparison(
        id=run_id,
        runName=f"Evaluation - {req.syntheticDatasetName}",
        createdAt=now.isoformat(),
        createdAtLabel=f"{now.day} {now.strftime('%b %Y')}",
        realDatasetName=req.realDatasetName,
        syntheticDatasetName=req.syntheticDatasetName,
        overallSimilarityScore=result.summary.overallSimilarityScore,
        metricsUsed=req.metricsUsed,
        status="completed",
    )
    _mem_comparisons.insert(0, new_record)
    _mem_results[run_id] = result
    return new_record


# ── GET /comparisons ───────────────────────────────────────────────────────────
@router.get("/comparisons", response_model=list[SavedComparison])
def get_comparisons(
    db: Annotated[Session, Depends(get_db)] if DB_AVAILABLE else None,
):
    if DB_AVAILABLE:
        # Returns lightweight summaries only — result_json is not included
        # so the list response stays small even with many saved runs.
        rows = get_all_evaluation_runs(db)
        return [_row_to_summary(r) for r in rows]

    # Fallback: in-memory list (already newest-first from insert(0, ...))
    return _mem_comparisons


# ── GET /comparisons/{run_id} ─────────────────────────────────────────────────
@router.get("/comparisons/{run_id}", response_model=EvaluationResult)
def get_comparison_detail(
    run_id: str,
    db: Annotated[Session, Depends(get_db)] if DB_AVAILABLE else None,
):
    if DB_AVAILABLE:
        row = get_evaluation_run_by_id(db, run_id)
        if not row:
            raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
        # result_json was stored as a plain dict — parse it back into
        # EvaluationResult so FastAPI can validate and serialise it correctly.
        return EvaluationResult(**row.result_json)

    # Fallback: in-memory dict
    result = _mem_results.get(run_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
    return result

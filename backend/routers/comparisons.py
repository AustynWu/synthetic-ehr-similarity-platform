# routers/comparisons.py — save and retrieve evaluation runs
#
# After reviewing the Results page, the user can save a run for future reference.
# This router stores two things in memory:
#   1. A lightweight SavedComparison (name, score, date) for the list view.
#   2. The full EvaluationResult for the "View Run Details" page.
#
# Keeping them separate avoids sending the large detail payload on every
# GET /comparisons request (which only needs the lightweight summary).

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from schemas import SaveComparisonRequest, SavedComparison, EvaluationResult
import state

router = APIRouter()


@router.post("/comparisons/save", response_model=SavedComparison)
def save_comparison(req: SaveComparisonRequest):
    now    = datetime.now(timezone.utc)
    result = req.evaluationResult
    # Generate a new run_id at save time rather than reusing the evaluation's runId.
    # This allows the user to save the same evaluation result more than once
    # (e.g. with different notes in a future version) without ID collision.
    run_id = f"run-{uuid.uuid4().hex[:8]}"

    new_record = SavedComparison(
        id=run_id,
        runName=f"Evaluation - {req.syntheticDatasetName}",
        createdAt=now.isoformat(),
        # createdAtLabel is a human-readable date shown in the list view UI
        # (e.g. "4 May 2026") without needing the frontend to format a timestamp.
        createdAtLabel=f"{now.day} {now.strftime('%b %Y')}",
        realDatasetName=req.realDatasetName,
        syntheticDatasetName=req.syntheticDatasetName,
        overallSimilarityScore=result.summary.overallSimilarityScore,
        metricsUsed=req.metricsUsed,
        status="completed",
    )

    # insert(0, ...) adds the new record at the front so the list is always newest-first
    # without an extra sort step on every GET /comparisons request.
    state.saved_comparisons.insert(0, new_record)
    # Store the full result separately so GET /comparisons/{id} can return it.
    state.saved_evaluation_results[run_id] = result
    return new_record


@router.get("/comparisons", response_model=list[SavedComparison])
def get_comparisons():
    # Returns lightweight summaries only — no detail_views or metric_matrix.
    # The list is already newest-first because save_comparison uses insert(0, ...).
    return state.saved_comparisons


@router.get("/comparisons/{run_id}", response_model=EvaluationResult)
def get_comparison_detail(run_id: str):
    # Returns the full EvaluationResult for one saved run.
    # Used by the "View Run Details" page to reconstruct the complete dashboard.
    result = state.saved_evaluation_results.get(run_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
    return result

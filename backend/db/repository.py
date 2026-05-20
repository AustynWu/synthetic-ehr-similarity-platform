# db/repository.py — database CRUD operations for evaluation runs
#
# Adapted from teammate's app/repository/evaluation_run_repo.py.
# Function names are kept the same as the original where possible
# so the logic is easy to trace between the two codebases.
#
# All functions receive a SQLAlchemy Session (db) as their first argument.
# The session is created and closed by get_db() in session.py — these
# functions never open or close sessions themselves.

from datetime import datetime
from sqlalchemy.orm import Session

from db.models import EvaluationRun


def save_evaluation_run(
    db: Session,
    run_id: str,
    run_name: str,
    real_dataset_name: str,
    synthetic_dataset_name: str,
    overall_score: float | None,
    numerical_score: float | None,
    categorical_score: float | None,
    relationship_score: float | None,
    metrics_used: list[str],
    result_dict: dict,
) -> EvaluationRun:
    """Insert a new evaluation run record and return it.

    result_dict must be the full EvaluationResult serialised as a plain dict
    (use model.model_dump() before calling this function).
    """
    now = datetime.utcnow()

    # Build the ORM object — mirrors the original save_evaluation_run() logic
    # but uses our column names and data types
    record = EvaluationRun(
        run_id=run_id,
        run_name=run_name,
        created_at=now,
        # created_at_label is the human-readable date shown in the UI list
        created_at_label=f"{now.day} {now.strftime('%b %Y')}",  # e.g. "20 May 2026"
        status="completed",
        real_dataset_name=real_dataset_name,
        synthetic_dataset_name=synthetic_dataset_name,
        overall_similarity_score=overall_score,
        numerical_similarity_score=numerical_score,
        categorical_similarity_score=categorical_score,
        relationship_similarity_score=relationship_score,
        metrics_used=metrics_used,
        result_json=result_dict,
    )

    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_all_evaluation_runs(db: Session) -> list[EvaluationRun]:
    """Return all saved runs ordered newest first.

    Only the lightweight columns are needed for the list view — result_json
    is included in the ORM object but the caller (comparisons.py) will not
    send it in the list response, keeping the payload small.
    """
    return (
        db.query(EvaluationRun)
        .order_by(EvaluationRun.created_at.desc())
        .all()
    )


def get_evaluation_run_by_id(db: Session, run_id: str) -> EvaluationRun | None:
    """Return one run by its run_id, or None if not found.

    Used by GET /comparisons/{run_id} to load result_json for the detail page.
    """
    return (
        db.query(EvaluationRun)
        .filter(EvaluationRun.run_id == run_id)
        .first()
    )


def delete_evaluation_run(db: Session, run_id: str) -> EvaluationRun | None:
    """Delete a run and return the deleted record, or None if not found.

    Kept from the original teammate code for future use (e.g. a delete button
    in the Saved Comparisons page).  Not wired to a router endpoint yet.
    """
    record = (
        db.query(EvaluationRun)
        .filter(EvaluationRun.run_id == run_id)
        .first()
    )
    if record:
        db.delete(record)
        db.commit()
    return record

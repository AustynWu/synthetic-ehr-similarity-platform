# db/models.py — SQLAlchemy ORM table definitions
#
# Adapted from teammate's app/db/schemas/evaluation_run.py.
# Key differences from the original:
#   - No datasets table or foreign keys — dataset names are stored directly
#     as strings because uploaded CSVs are temporary (lost on server restart)
#     and do not need a persistent record.
#   - run_id uses the same "run-{8hex}" format as the existing comparisons.py
#     so IDs are consistent throughout the system.
#   - result_json stores the complete EvaluationResult so RunDetailPage can
#     fully reconstruct every chart, table, and score from a saved run.

from datetime import datetime
from sqlalchemy import Column, String, DateTime, Numeric, JSON
from db.session import Base


class EvaluationRun(Base):
    """One saved evaluation run.

    Lightweight columns (scores, names, date) are used by the Saved
    Comparisons list view.  result_json contains the full detail for
    the Run Detail page — it is only fetched on demand, not on every list call.
    """
    __tablename__ = "evaluation_runs"

    # Primary key — format "run-{8hex}", e.g. "run-a1b2c3d4"
    run_id = Column(String(50), primary_key=True, index=True)

    # Human-readable name shown in the Saved Comparisons table
    run_name = Column(String(255), nullable=False)

    # Timestamps
    created_at       = Column(DateTime, default=datetime.utcnow)
    created_at_label = Column(String(50), nullable=True)   # e.g. "20 May 2026"

    # Run status — always "completed" for now; reserved for future async runs
    status = Column(String(30), default="completed")

    # Dataset names stored as plain strings (no FK — see header note above)
    real_dataset_name       = Column(String(255), nullable=True)
    synthetic_dataset_name  = Column(String(255), nullable=True)

    # Similarity scores (0.0000 – 1.0000, four decimal places)
    # Nullable because some score types may not be computed (e.g. no numerical vars)
    overall_similarity_score      = Column(Numeric(5, 4), nullable=True)
    numerical_similarity_score    = Column(Numeric(5, 4), nullable=True)
    categorical_similarity_score  = Column(Numeric(5, 4), nullable=True)
    relationship_similarity_score = Column(Numeric(5, 4), nullable=True)

    # List of metric keys used in this run, e.g. ["mean_difference", "ks_test"]
    metrics_used = Column(JSON, nullable=True)

    # Full EvaluationResult object as JSON.
    # This is the single source of truth for Run Detail page reconstruction.
    # Includes: variableRanking, detailViews, metricMatrix, multivariateResults,
    #           analysisContext (selectedVariables + selectedMetrics), insights.
    result_json = Column(JSON, nullable=False)

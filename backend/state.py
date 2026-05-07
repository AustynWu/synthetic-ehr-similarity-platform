# state.py — shared in-memory state for all routers
#
# Design: a single module that every router imports from.
#
# Why a dedicated module instead of defining dicts inside each router?
# Python's import system caches modules after the first import, so every
# router that does "import state" receives the SAME module object.
# If each router defined its own dict (e.g. uploaded_files = {}), those would
# be separate objects — data stored by upload.py would be invisible to
# evaluation.py.  Sharing via state.py guarantees one source of truth.
#
# Why in-memory instead of a database?
# This is a prototype.  A real production system would use a database or
# object store so data survives server restarts and works across multiple
# workers.  For now, losing uploads on restart is acceptable.

from pathlib import Path
from schemas import SavedComparison, EvaluationResult

# Maps dataset ID (e.g. "real-a1b2c3d4") → absolute file path on disk.
# Written by upload.py; read by validation.py and evaluation.py.
uploaded_files: dict[str, Path] = {}

# Maps dataset ID → the original filename the user uploaded (e.g. "diabetic_data.csv").
# Stored separately because uploaded_files holds the storage path (real-a1b2c3d4.csv),
# which is not human-readable.  Used in analysis_context and saved comparison names.
uploaded_file_names: dict[str, str] = {}

# List of lightweight run summaries shown on the Saved Comparisons page.
# Stored newest-first: save_comparison() uses insert(0, ...) so the list
# is always sorted without an extra sort call on every GET /comparisons.
saved_comparisons: list[SavedComparison] = []

# Full EvaluationResult objects keyed by run ID.
# Stored separately from saved_comparisons because the list view only needs
# a small summary (score, dataset names, date), while View Run Details needs
# the complete result including detail_views and metric_matrix.
# Keeping them split avoids serialising large objects on every list request.
saved_evaluation_results: dict[str, EvaluationResult] = {}

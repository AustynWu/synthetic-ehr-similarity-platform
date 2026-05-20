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
# Upload state stays in-memory because uploaded CSVs are temporary — they are
# re-uploaded every session.  Saved comparison results are now stored in the
# database (see db/repository.py) so they survive server restarts.

from pathlib import Path

# Maps dataset ID (e.g. "real-a1b2c3d4") → absolute file path on disk.
# Written by upload.py; read by validation.py and evaluation.py.
uploaded_files: dict[str, Path] = {}

# Maps dataset ID → the original filename the user uploaded (e.g. "diabetic_data.csv").
# Stored separately because uploaded_files holds the storage path (real-a1b2c3d4.csv),
# which is not human-readable.  Used in analysis_context and saved comparison names.
uploaded_file_names: dict[str, str] = {}

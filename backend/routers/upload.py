# routers/upload.py — POST /datasets/upload
#
# The user's first action: select two CSV files (real + synthetic).
# This router validates the files, saves them to disk, registers them in
# state.uploaded_files, and returns unique IDs that all later steps use
# to reload the files without asking the user to upload again.

import uuid
import io
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, File, UploadFile, HTTPException

from schemas import (
    DatasetFile, DatasetFileType, DatasetRole, DatasetStatus, UploadedDatasets,
)
from constants import UPLOAD_DIR, NULL_VALUES
import state

router = APIRouter()

MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB


def _require_csv(file: UploadFile, field: str) -> None:
    """Reject the request early if the file extension is not .csv.
    Checking the extension before reading the file avoids wasting memory
    on a large non-CSV upload."""
    name = (file.filename or "").lower()
    if not name.endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail=f"'{field}' must be a CSV file. Received: {file.filename!r}",
        )


def _validate_csv_content(contents: bytes, field: str) -> None:
    """Parse the first 10 rows to confirm the file is valid CSV and meets
    minimum size requirements.  We read only 10 rows (nrows=10) so this check
    is fast even for large files — we don't need to load the whole file here.

    Minimum requirements:
    - At least 1 data row  : an empty file has no information to analyse.
    - At least 2 columns   : similarity metrics require at least two variables.
    - At least 10 data rows: statistical metrics become unreliable with fewer rows.
    """
    try:
        df = pd.read_csv(io.BytesIO(contents), nrows=10, na_values=NULL_VALUES)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"'{field}' could not be parsed as CSV: {e}",
        )
    if len(df) == 0:
        raise HTTPException(
            status_code=400,
            detail=f"'{field}' has no data rows. Please upload a file with at least one row.",
        )
    if len(df.columns) < 2:
        raise HTTPException(
            status_code=400,
            detail=f"'{field}' has only {len(df.columns)} column(s). At least 2 columns are needed.",
        )
    if len(df) < 10:
        raise HTTPException(
            status_code=400,
            detail=f"'{field}' has only {len(df)} data row(s). At least 10 rows are needed.",
        )


@router.post("/datasets/upload", response_model=UploadedDatasets)
async def upload_datasets(
    real_file: UploadFile = File(...),
    synthetic_file: UploadFile = File(...),
):
    # Check extension first — fail fast before reading file bytes.
    _require_csv(real_file, "real_file")
    _require_csv(synthetic_file, "synthetic_file")

    # Reject oversized files before reading into memory.
    # file.size may be None if the client omits Content-Length, so guard with `and`.
    if real_file.size and real_file.size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="real_file exceeds the 50 MB upload limit.")
    if synthetic_file.size and synthetic_file.size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="synthetic_file exceeds the 50 MB upload limit.")

    now = datetime.now(timezone.utc).isoformat()
    # Use short hex IDs (8 chars) with a role prefix so they are readable in logs.
    # uuid4 ensures no collisions even if two users upload simultaneously.
    real_id = f"real-{uuid.uuid4().hex[:8]}"
    syn_id = f"syn-{uuid.uuid4().hex[:8]}"

    real_contents = await real_file.read()
    syn_contents = await synthetic_file.read()

    # Validate content after reading — the bytes are now in memory.
    _validate_csv_content(real_contents, "real_file")
    _validate_csv_content(syn_contents,  "synthetic_file")

    # Write to disk so later endpoints can reload the full file with pd.read_csv().
    # Storing the full file (not just a preview) is needed because the evaluation
    # step processes every row.
    real_path = UPLOAD_DIR / f"{real_id}.csv"
    syn_path = UPLOAD_DIR / f"{syn_id}.csv"
    real_path.write_bytes(real_contents)
    syn_path.write_bytes(syn_contents)

    # Register in shared state so validation and evaluation can look up paths by ID.
    state.uploaded_files[real_id] = real_path
    state.uploaded_files[syn_id]  = syn_path
    # Keep the original filename separately — the storage path uses the ID, not the
    # user-chosen name, so we need this mapping to show friendly names in the UI.
    state.uploaded_file_names[real_id] = real_file.filename or "real.csv"
    state.uploaded_file_names[syn_id]  = synthetic_file.filename or "synthetic.csv"

    return UploadedDatasets(
        realDataset=DatasetFile(
            id=real_id, role=DatasetRole.real,
            fileName=real_file.filename or "real.csv",
            fileType=DatasetFileType.csv,
            sizeBytes=len(real_contents),
            uploadedAt=now, status=DatasetStatus.uploaded,
        ),
        syntheticDataset=DatasetFile(
            id=syn_id, role=DatasetRole.synthetic,
            fileName=synthetic_file.filename or "synthetic.csv",
            fileType=DatasetFileType.csv,
            sizeBytes=len(syn_contents),
            uploadedAt=now, status=DatasetStatus.uploaded,
        ),
    )

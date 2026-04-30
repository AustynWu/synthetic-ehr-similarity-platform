// datasetService.ts — dataset upload and validation service layer
//
// Why a "service layer"?
//   Pages (UploadPage, ValidationPage) should only care about what data they show,
//   not HOW the data is fetched. This file holds all the fetching logic so that
//   pages stay clean and easy to read. If we later switch from mock to real API,
//   we only change this file — the pages need zero changes.
//
// Two modes (controlled by VITE_USE_REAL_API in .env.local):
//   Real API mode: sends files to backend via multipart/form-data; posts dataset IDs for validation.
//   Mock mode:     returns mock data directly; file names are patched with the actual file the user picked.
//
// Mock data is preserved and never deleted — it is always the fallback when the backend is unavailable.

import { mockDatasets } from "../mocks/datasets";
import { mockValidationSummary } from "../mocks/validation";
import type { UploadFilesInput, UploadedDatasets, ValidationSummary } from "../types/contracts";
import { USE_REAL_API, apiUpload, apiPost } from "./apiClient";


// Upload both CSV files to the backend.
//
// Why FormData?
//   Regular JSON cannot carry binary file content. FormData is the browser's way
//   to bundle a file (binary) together with other fields and send them as one HTTP request.
//   The server receives it as multipart/form-data, which FastAPI handles with UploadFile.
//
// Real API: POST /datasets/upload → backend saves the files and returns IDs + metadata.
// Mock:     Returns a copy of mock data but patches in the actual file name and size
//           so the UI shows the real file the user selected, not the hardcoded fake name.
export async function uploadDatasets(files: UploadFilesInput): Promise<UploadedDatasets> {
  if (USE_REAL_API && files.realFile && files.syntheticFile) {
    // Build a FormData package with both files.
    // form.append("real_file", ...) — "real_file" must match the parameter name in the FastAPI endpoint.
    const form = new FormData();
    form.append("real_file", files.realFile);
    form.append("synthetic_file", files.syntheticFile);
    return apiUpload<UploadedDatasets>("/datasets/upload", form);
  }

  // --- mock fallback (original behaviour, unchanged) ---
  const now = new Date().toISOString(); // ISO 8601 timestamp, e.g. "2026-04-08T10:30:00.000Z"
  return Promise.resolve({
    realDataset: mockDatasets.realDataset
      ? {
          // Why spread (...mockDatasets.realDataset)?
          //   We want to keep all the mock fields (id, role, status, etc.) but
          //   override just the file name and size with what the user actually selected.
          //   Spread copies every field first, then the fields below overwrite the ones we care about.
          ...mockDatasets.realDataset,

          // ?? (nullish coalescing): use the user's actual file value if it exists,
          // otherwise fall back to the mock value.
          fileName: files.realFile?.name ?? mockDatasets.realDataset.fileName,
          sizeBytes: files.realFile?.size ?? mockDatasets.realDataset.sizeBytes,
          uploadedAt: now,
        }
      : null,
    syntheticDataset: mockDatasets.syntheticDataset
      ? {
          ...mockDatasets.syntheticDataset,
          fileName: files.syntheticFile?.name ?? mockDatasets.syntheticDataset.fileName,
          sizeBytes: files.syntheticFile?.size ?? mockDatasets.syntheticDataset.sizeBytes,
          uploadedAt: now,
        }
      : null,
  });
}


// Check whether the uploaded dataset pair is ready for analysis.
//
// Why does this function need datasetIds?
//   After uploading, the backend assigns each file a unique ID (e.g. "real-a1b2c3d4").
//   The validate endpoint needs those IDs to find the files it already saved on disk.
//   In mock mode there is no backend, so we skip the IDs and return mock data directly.
//
// Why is datasetIds optional (the ? after the parameter name)?
//   In mock mode, the caller (App.tsx) does not have real IDs to pass.
//   Making it optional means mock-mode callers do not need to change their code.
//   Inside this function we check "if USE_REAL_API AND we have IDs" before using them.
//
// Real API: POST /datasets/validate with { realDatasetId, syntheticDatasetId }.
// Mock:     Returns fixed mock validation result.
export async function getValidationSummary(
  datasetIds?: { realDatasetId: string; syntheticDatasetId: string }
): Promise<ValidationSummary> {
  if (USE_REAL_API && datasetIds) {
    // Send both IDs as a JSON body. The backend looks up the files by these IDs.
    return apiPost<ValidationSummary>("/datasets/validate", datasetIds);
  }
  // Promise.resolve wraps a plain value in a Promise so the return type stays consistent.
  return Promise.resolve(mockValidationSummary);
}

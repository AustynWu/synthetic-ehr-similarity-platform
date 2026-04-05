// datasetService.ts — dataset upload and validation service layer
//
// Service layer concept: data-fetching logic lives here, not in page components.
// Pages just call these functions and receive results — they don't care how data is fetched.
//
// Current state: all mock, returns test data directly.
// Future: replace function bodies with real API calls (fetch/axios); pages need no changes.
//
// async/await:
//   async function — does something that takes time (e.g. a network request)
//   await          — waits for that operation to finish before continuing
//   Promise.resolve(x) — creates an already-resolved Promise returning x (simulates async)

import { mockDatasets } from "../mocks/datasets";
import { mockValidationSummary } from "../mocks/validation";
import type { UploadFilesInput, UploadedDatasets, ValidationSummary } from "../types/contracts";

// Simulates "upload datasets".
// Production: send files to backend via multipart/form-data.
// Current:    Returns mock data, but patches in the user's actual file name and size.
export async function uploadDatasets(files: UploadFilesInput): Promise<UploadedDatasets> {
  const now = new Date().toISOString();

  return Promise.resolve({
    realDataset: mockDatasets.realDataset
      ? {
          ...mockDatasets.realDataset,
          // ?? (nullish coalescing) — use the user's file value if available, fall back to mock
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

// Simulates "get validation summary".
// Production: backend analyses column structure after upload and returns the comparison result.
// Current:    Returns fixed mock data.
export async function getValidationSummary(): Promise<ValidationSummary> {
  return Promise.resolve(mockValidationSummary);
}

// mocks/datasets.ts — pre-seeded dataset upload state
//
// Simulates two datasets that have already been uploaded and validated.
// File names and sizes match the real diabetic_data.csv and V1_syn.csv files.

import type { UploadedDatasets } from "../types/contracts";

export const mockDatasets: UploadedDatasets = {
  // Real patient data (public UCI diabetes dataset)
  realDataset: {
    id: "real-001",
    role: "real",
    fileName: "diabetic_data.csv",
    fileType: "csv",
    sizeBytes: 19159383,   // ~18.3 MB
    uploadedAt: "2026-04-02T09:00:00Z",
    status: "validated",
  },
  // AI-generated synthetic data
  syntheticDataset: {
    id: "syn-001",
    role: "synthetic",
    fileName: "V1_syn.csv",
    fileType: "csv",
    sizeBytes: 18674903,   // ~17.8 MB (slightly smaller than real)
    uploadedAt: "2026-04-02T09:02:00Z",
    status: "validated",
  },
};

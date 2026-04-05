// mocks/validation.ts — pre-computed validation summary
//
// Simulates the schema comparison result the backend would return after analysing both files.
// Numbers are derived from the real diabetic_data.csv and V1_syn.csv.
//
// Missing value definition: empty string, "?", or the string "None" all count as missing.

import type { ValidationSummary } from "../types/contracts";

export const mockValidationSummary: ValidationSummary = {
  // Real dataset statistics
  realDataset: {
    fileId: "real-001",
    fileName: "diabetic_data.csv",
    rowCount: 101766,
    columnCount: 50,
    missingValueCount: 374017, // includes "None" string values
    duplicateRowCount: 0,
    missingColumnCount: 8, // weight/medical_specialty/payer_code/max_glu_serum/A1Cresult/race/diag_2/diag_3
  },
  // Synthetic dataset statistics
  syntheticDataset: {
    fileId: "syn-001",
    fileName: "V1_syn.csv",
    rowCount: 101766,
    columnCount: 50,
    missingValueCount: 372705, // only 0.4% difference from real — missingness pattern was learned
    duplicateRowCount: 0,
    missingColumnCount: 8, // same 8 columns have missing values — pattern fully replicated
  },
  // 49 column names aligned, 1 type mismatch (number_outpatient)
  matchedColumnCount: 49,
  unmatchedColumnCount: 1,

  // Schema comparison rows — sorted by severity then missingness.
  // Backend sorts: type_mismatch first, then high-missingness descending, then clean columns.
  schemaComparison: [
    // Type mismatch (most severe — shown first)
    { id: "number_outpatient", columnName: "number_outpatient", realType: "numerical", syntheticType: "categorical", realMissingRate: 0, syntheticMissingRate: 0, status: "type_mismatch" },

    // High-missingness columns (sorted descending)
    { id: "weight",            columnName: "weight",            realType: "categorical", syntheticType: "categorical", realMissingRate: 96.9, syntheticMissingRate: 96.9, status: "matched" },
    { id: "max_glu_serum",     columnName: "max_glu_serum",     realType: "categorical", syntheticType: "categorical", realMissingRate: 94.7, syntheticMissingRate: 94.6, status: "matched" },
    { id: "A1Cresult",         columnName: "A1Cresult",         realType: "categorical", syntheticType: "categorical", realMissingRate: 83.3, syntheticMissingRate: 82.8, status: "matched" },
    { id: "medical_specialty", columnName: "medical_specialty", realType: "categorical", syntheticType: "categorical", realMissingRate: 49.1, syntheticMissingRate: 48.5, status: "matched" },
    { id: "payer_code",        columnName: "payer_code",        realType: "categorical", syntheticType: "categorical", realMissingRate: 39.6, syntheticMissingRate: 39.4, status: "matched" },
    { id: "race",              columnName: "race",              realType: "categorical", syntheticType: "categorical", realMissingRate: 2.2,  syntheticMissingRate: 2.1,  status: "matched" },
    { id: "diag_3",            columnName: "diag_3",            realType: "categorical", syntheticType: "categorical", realMissingRate: 1.4,  syntheticMissingRate: 1.5,  status: "matched" },
    { id: "diag_2",            columnName: "diag_2",            realType: "categorical", syntheticType: "categorical", realMissingRate: 0.4,  syntheticMissingRate: 0.4,  status: "matched" },

    // Representative clean columns (one from each category: outcome, medication, numerical, demographic)
    { id: "readmitted",       columnName: "readmitted",       realType: "categorical", syntheticType: "categorical", realMissingRate: 0, syntheticMissingRate: 0, status: "matched" },
    { id: "insulin",          columnName: "insulin",          realType: "categorical", syntheticType: "categorical", realMissingRate: 0, syntheticMissingRate: 0, status: "matched" },
    { id: "time_in_hospital", columnName: "time_in_hospital", realType: "numerical",   syntheticType: "numerical",   realMissingRate: 0, syntheticMissingRate: 0, status: "matched" },
    { id: "age",              columnName: "age",              realType: "categorical", syntheticType: "categorical", realMissingRate: 0, syntheticMissingRate: 0, status: "matched" },
  ],

  // Full 50-column list — read from CSV headers during backend profiling.
  // Setup page uses this list to let users choose which columns to evaluate.
  availableColumns: [
    // ID columns (usually excluded from evaluation, but listed so users can decide)
    { columnName: "encounter_id",                  dataType: "numerical"   },
    { columnName: "patient_nbr",                   dataType: "numerical"   },
    // Demographics
    { columnName: "race",                          dataType: "categorical" },
    { columnName: "gender",                        dataType: "categorical" },
    { columnName: "age",                           dataType: "categorical" },
    { columnName: "weight",                        dataType: "categorical" },
    // Admission info
    { columnName: "admission_type_id",             dataType: "numerical"   },
    { columnName: "discharge_disposition_id",      dataType: "numerical"   },
    { columnName: "admission_source_id",           dataType: "numerical"   },
    { columnName: "time_in_hospital",              dataType: "numerical"   },
    { columnName: "payer_code",                    dataType: "categorical" },
    { columnName: "medical_specialty",             dataType: "categorical" },
    // Utilisation
    { columnName: "num_lab_procedures",            dataType: "numerical"   },
    { columnName: "num_procedures",                dataType: "numerical"   },
    { columnName: "num_medications",               dataType: "numerical"   },
    { columnName: "number_outpatient",             dataType: "numerical"   },
    { columnName: "number_emergency",              dataType: "numerical"   },
    { columnName: "number_inpatient",              dataType: "numerical"   },
    { columnName: "number_diagnoses",              dataType: "numerical"   },
    // Diagnoses
    { columnName: "diag_1",                        dataType: "categorical" },
    { columnName: "diag_2",                        dataType: "categorical" },
    { columnName: "diag_3",                        dataType: "categorical" },
    // Blood glucose
    { columnName: "max_glu_serum",                 dataType: "categorical" },
    { columnName: "A1Cresult",                     dataType: "categorical" },
    // Medications
    { columnName: "metformin",                     dataType: "categorical" },
    { columnName: "repaglinide",                   dataType: "categorical" },
    { columnName: "nateglinide",                   dataType: "categorical" },
    { columnName: "chlorpropamide",                dataType: "categorical" },
    { columnName: "glimepiride",                   dataType: "categorical" },
    { columnName: "acetohexamide",                 dataType: "categorical" },
    { columnName: "glipizide",                     dataType: "categorical" },
    { columnName: "glyburide",                     dataType: "categorical" },
    { columnName: "tolbutamide",                   dataType: "categorical" },
    { columnName: "pioglitazone",                  dataType: "categorical" },
    { columnName: "rosiglitazone",                 dataType: "categorical" },
    { columnName: "acarbose",                      dataType: "categorical" },
    { columnName: "miglitol",                      dataType: "categorical" },
    { columnName: "troglitazone",                  dataType: "categorical" },
    { columnName: "tolazamide",                    dataType: "categorical" },
    { columnName: "examide",                       dataType: "categorical" },
    { columnName: "citoglipton",                   dataType: "categorical" },
    { columnName: "insulin",                       dataType: "categorical" },
    { columnName: "glyburide-metformin",           dataType: "categorical" },
    { columnName: "glipizide-metformin",           dataType: "categorical" },
    { columnName: "glimepiride-pioglitazone",      dataType: "categorical" },
    { columnName: "metformin-rosiglitazone",       dataType: "categorical" },
    { columnName: "metformin-pioglitazone",        dataType: "categorical" },
    // Outcome columns
    { columnName: "change",                        dataType: "categorical" },
    { columnName: "diabetesMed",                   dataType: "categorical" },
    { columnName: "readmitted",                    dataType: "categorical" },
  ],

  // Validation issues (auto-generated by backend rules, most severe first)
  issues: [
    {
      level: "warning",
      code: "TYPE_MISMATCH",
      message: "number_outpatient is numerical in the real dataset but categorical in the synthetic dataset. Evaluation metrics for this column may be unreliable.",
    },
    {
      level: "info",
      code: "SCHEMA_PARTIALLY_MATCHED",
      message: "49 of 50 columns are aligned by name and type. 1 type mismatch detected.",
    },
    {
      level: "warning",
      code: "HIGH_MISSINGNESS",
      message: "weight (96.9%), max_glu_serum (94.7%), A1Cresult (83.3%), medical_specialty (49.1%), and payer_code (39.6%) have high missing rates — interpret results for these columns carefully.",
    },
    {
      level: "info",
      code: "MISSINGNESS_PRESERVED",
      message: "The synthetic dataset closely replicates the real missingness pattern — no column differs by more than 1% between the two files.",
    },
  ],

  canProceed: true,
};

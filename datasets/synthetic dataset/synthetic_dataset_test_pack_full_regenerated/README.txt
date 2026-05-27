Synthetic Dataset Test Pack - Full Size

All files are generated at full row count, matching the real diabetic_data.csv row count.

Files:
1. syn_test_01_v1_fixed_close.csv
   - Very close to current V1 synthetic dataset, with schema blanks fixed for A1Cresult and max_glu_serum.
   - Use this as the high-similarity baseline.

2. syn_test_02_moderate_shift.csv
   - Still plausible, but age, readmission, medication, lab procedure and hospital stay patterns are shifted.
   - Good for testing moderate univariate and categorical differences.

3. syn_test_03_univariate_bad.csv
   - Single-variable distributions are intentionally poor.
   - Good for testing histogram, boxplot, KS, Wasserstein, category proportion and chi-square outputs.

4. syn_test_04_relationship_broken.csv
   - Each column distribution is preserved by shuffling values independently, but relationships between variables are broken.
   - Good for testing multivariate metrics such as correlation difference, Cramer's V, joint distribution and group-wise summary.

5. syn_test_05_mode_collapse_low_diversity.csv
   - Many categorical variables collapse to the majority value and numerical variables collapse around medians.
   - Good for testing diversity loss and mode collapse.

6. syn_test_06_schema_invalid_missing.csv
   - Includes invalid categories, blank values and out-of-range numeric values.
   - Good for testing upload validation, missingness summary and invalid category detection.

7. syn_test_07_privacy_risk_copy.csv
   - Almost directly copied from real data, with IDs changed and tiny numeric perturbations.
   - Good for testing privacy/memorisation risk. This should look statistically excellent but should be flagged as risky.

Suggested testing order:
01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 07

# Milestone 1 — Findings and decisions

The implementation now lives in [the audit and EDA notebook](../notebooks/01_dataset_audit_and_eda.ipynb), with tests in [the validation notebook](../notebooks/02_validation_checks.ipynb). During Milestone 2, all Python source files were migrated into notebooks at the user's request. The data findings and decisions below remain valid.

## Dataset findings

The supplied root-level `ai4i2020.csv` was inspected before defining the schema. It contains 10,000 rows and 14 columns. The first header has a UTF-8 byte-order mark, handled by the loader without changing the file. An identical copy is stored at `data/raw/ai4i2020.csv`.

Detailed data types, missing-value counts, cardinalities, unique-value samples, sensor statistics, distributions, duplicate checks, label combinations, and IQR outlier counts are in [the measured audit](dataset_audit.md). The JSON companion retains full numeric precision.

There are no missing values or duplicate full rows. Both identifiers are unique. The target contains 9,661 normal observations and 339 failures (3.39%). Types are L = 6,000, M = 2,997, and H = 1,003. Counts from this supplied CSV take precedence over descriptive counts on external dataset pages.

## ML formulation and leakage prevention

| Role | Columns | Reason |
| --- | --- | --- |
| Primary binary target | Machine failure | Preserve the provided 0/1 observation label. |
| Categorical input | Type | Product quality category available at inference. |
| Numeric inputs | Air temperature [K], Process temperature [K], Rotational speed [rpm], Torque [Nm], Tool wear [min] | Measured process inputs with explicit units. |
| Excluded identifiers | UDI, Product ID | UDI is sequential; Product ID is unique and its prefix duplicates Type. Serial numbers and row position are not defensible sensor features. |
| Excluded failure labels | TWF, HDF, PWF, OSF, RNF | Describe failure states and can disclose the primary target. Retain only for auditing and a later separate prediction task. |

Use the explicit six-column input allowlist in the notebook's configuration cell when preprocessing is implemented. Do not select inputs by dropping only the target. No identifier transformations or failure-derived features are authorized by this formulation.

The primary task estimates failure status from readings at the observation. There is no timestamp, future failure horizon, or reliable repeated-machine identifier in this file. Calling this a validated advance-warning model would overstate what these labels support.

## Failure-type assessment

Observed positives: TWF = 46, HDF = 115, PWF = 95, OSF = 98, RNF = 19. There are 24 rows with multiple active flags, including one row with three flags. A later component therefore needs a multilabel formulation rather than forced multiclass labels. All positive classes are rare; RNF is particularly scarce and, by its documented random construction, may have little predictable sensor signal.

Nine positive primary targets have no active type flags. Eighteen negative primary targets have an active RNF flag. The audit records their UDI values. These discrepancies mean the primary target is not exactly the logical OR of all five flags. Preserve both original targets and flags; investigate and document any later label policy rather than silently correcting them or inventing an unknown class.

Keep binary and failure-type modeling separate. Do not train the latter during this milestone. Its eventual evaluation must report per-label support and account for overlap and the inconsistency of RNF with the primary target.

## Outliers and splitting considerations

IQR fences flag extreme readings for review only. They do not establish physical invalidity. Extreme torque or speed can be informative for failure detection; no clipping, removal, imputation, or normalization is performed here. Validation enforces numeric finite readings, positive temperatures/speed/torque, nonnegative tool wear, whole-number discrete fields, binary labels, and the observed Type categories. Observed minima and maxima are not treated as universal operating limits.

[UCI documentation](https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset) describes random-walk temperature generation and the synthetic failure rules. Along with sequential UDI, this motivates examining ordering dependence in Milestone 2 before finalizing a split. Removing UDI from inputs does not itself eliminate similarity between adjacent observations.

A stratified train/validation/test split with seed 42 is a provisional tabular baseline, not a completed decision. Consider a contiguous holdout sensitivity check if EDA confirms strong order dependence; do not describe row order as verified real timestamps. Final split fractions, partitions, and transformations belong to Milestone 3. Fit preprocessing on training data only; use validation data for model/threshold selection and reserve the test set for final evaluation. The current full-data schema and label audit does not fit a model or optimize a threshold.

Later evaluation should emphasize precision, recall, F1, PR-AUC, ROC-AUC, confusion matrices, and false negatives. No metric, probability, threshold, or model result has been estimated in this milestone.

## Scope and next milestone

Implemented: minimal Python foundation, immutable raw-data copy, centralized column roles and seed, raw-data validation, reproducible audit, and focused tests. Only NumPy and pandas are runtime dependencies; pytest is a development dependency. Dependency ranges are bounded; exact deployment locking is deferred until the full stack is established.

Original verification passed all 18 pytest cases, covering BOM loading, source preservation, invalid schemas and values, label overlap and inconsistencies, duplicate reporting, and outlier retention. These checks are now included in the validation notebook. `python -m pip check` found no broken requirements. The original and canonical CSV copies match SHA-256 `dc6630cd9b1f0f853922fad78a1b6436570d3f1ec863f1dd5c4340ac56bc8a8e`. Repeating the audit produced byte-identical reports in the tested environment, and distribution totals reconcile with 10,000 rows.

Next: Milestone 2 — useful exploratory plots and observations about sensor distributions, target relationships, machine type, correlations, label frequencies, and row-order effects. This milestone stops before EDA, preprocessing, or model training.

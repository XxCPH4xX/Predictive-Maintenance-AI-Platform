# Model card — AI4I machine failure classifier

## Intended use

This model supports a local portfolio demonstration of tabular ML, inference APIs, explanations, and equipment-risk dashboards. Its target is failure at the recorded observation. The data does not establish a future warning interval, remaining useful life, or verified physical machine histories. Model scenarios show changes in model output, not the effect of a real maintenance intervention.

The deployed artifact is `ai4i-f3eb2ed3aaf9`, selected from measured experiments in [Notebook 06](../notebooks/06_model_optimization.ipynb). It is a complete scikit-learn pipeline with a column transformer and XGBoost classifier. Production inference is defined in [backend/inference.py](../backend/inference.py).

## Data and partitions

The supplied AI4I CSV contains 10,000 rows, with 339 failures (3.39%), no missing cells, and no duplicate records. It is synthetic data, distributed under CC BY 4.0 by the [UCI Machine Learning Repository](https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset), [DOI 10.24432/C5HS5C](https://doi.org/10.24432/C5HS5C).

Raw SHA-256: `dc6630cd9b1f0f853922fad78a1b6436570d3f1ec863f1dd5c4340ac56bc8a8e`.

The binary input allowlist contains Type, air temperature, process temperature, rotational speed, torque, and tool wear. UDI and Product ID are excluded identifiers. TWF, HDF, PWF, OSF, and RNF are excluded failure-state labels. Neither the binary classifier nor the secondary classifier receives another target as an input.

| Partition | Rows | Binary failures |
| --- | ---: | ---: |
| Training | 6,000 | 203 |
| Validation | 2,000 | 68 |
| Test | 2,000 | 68 |

Partitions are stratified with seed 42 and persisted against the raw file hash. Numeric StandardScaler parameters are fitted only on training rows. Type uses explicit L/M/H one-hot categories and rejects unknown categories. The six raw inputs become eight transformed features. No outliers were removed, labels rewritten, or synthetic minority examples added.

Full-dataset EDA preceded partitioning, exposing aggregate patterns from later test rows. The test partition was excluded from model fitting, candidate selection, calibration selection, and threshold selection; this is still exploratory internal validation, not an independent external evaluation.

## Candidate comparison

All values below are validation measurements at threshold 0.5; AP means average precision, reported as PR-AUC in the application. These values must not be confused with the selected lower operating threshold or final test results.

| Candidate | Precision | Recall | F1 | ROC-AUC | AP |
| --- | ---: | ---: | ---: | ---: | ---: |
| logistic_regression | 0.7273 | 0.2353 | 0.3556 | 0.8737 | 0.4321 |
| random_forest | 0.8529 | 0.4265 | 0.5686 | 0.9558 | 0.7454 |
| xgboost | 0.8936 | 0.6176 | 0.7304 | 0.9655 | 0.7941 |
| logistic_balanced | 0.1508 | 0.7941 | 0.2535 | 0.8811 | 0.4072 |
| forest_balanced | 0.7805 | 0.4706 | 0.5872 | 0.9591 | 0.6869 |
| xgboost_weighted | 0.4101 | 0.8382 | 0.5507 | 0.9632 | 0.7197 |
| xgboost_depth4 | 0.8393 | 0.6912 | 0.7581 | 0.9726 | 0.8050 |

Source: [model_comparison.json](metrics/model_comparison.json).

The highest validation AP selected `xgboost_depth4`: 400 estimators, maximum depth 4, learning rate 0.05, positive-class weight 3, subsample 0.9, L2 regularization 2, histogram tree method, and random seed 42. The bounded search also considered unweighted baselines, balanced Logistic Regression and Random Forest, and an XGBoost candidate weighted by the training imbalance ratio. Threshold adjustment was used instead of adding SMOTE without supporting evidence.

## Ordering and generalization checks

Three-fold evaluation of the selected candidate used only training rows. Stratified-fold AP was 0.7654, 0.7589, and 0.7306. GroupKFold with groups formed from original 1,000-row CSV blocks produced AP of 0.5861, 0.4906, and 0.5351. These groups are a sensitivity check for ordered operating regimes, not verified machines or time periods. They are not an unbiased nested estimate after candidate selection.

Temperatures have strong adjacent-row correlation. Rows 4,001–5,000 concentrate 134 binary failures and 108 of 115 HDF labels. The weaker block results indicate that a random split can make generalization across operating conditions look better than it is. See [cross_validation.json](metrics/cross_validation.json) and [the EDA notebook](../notebooks/01_dataset_audit_and_eda.ipynb).

## Calibration and decision policy

Sigmoid calibration used training-only cross-validation. Its acceptance rule required at least a 5% validation Brier improvement with at most 0.01 AP loss. Brier worsened from 0.012475 to 0.013991 and AP fell from 0.804986 to 0.782876, so the uncalibrated model was retained. Estimated probabilities should not be assumed to represent calibrated real-world failure frequencies.

The operating threshold is **0.08567804843187332**, chosen to maximize validation precision while attaining at least 90% validation recall. At that threshold, validation precision was 0.4493 and recall 0.9118. The model and threshold were frozen before final test scoring; there was no subsequent training on validation rows or tuning against test results.

Risk bands are demonstration policies stored centrally in model metadata:

| Band | Probability interval |
| --- | --- |
| Healthy | Below 0.04283902421593666 |
| Warning | At least 0.04283902421593666 and below 0.08567804843187332 |
| High risk | At least 0.08567804843187332 and below 0.6342712193727493 |
| Critical | At least 0.6342712193727493 |

Healthy does not mean zero risk. Warning is below the binary positive threshold. These boundaries are not engineering limits or industrial standards, and threshold choice has not been grounded in real maintenance costs.

## Final binary test evaluation

| Measure | Result |
| --- | ---: |
| Precision | 0.4056 |
| Recall | 0.8529 |
| F1 | 0.5498 |
| F2 | 0.6988 |
| ROC-AUC | 0.9806 |
| AP / PR-AUC | 0.7706 |
| Brier score | 0.01344 |
| Failure support | 68 of 2,000 |

| Actual / predicted | Normal | Failure |
| --- | ---: | ---: |
| Normal | 1,847 | 85 |
| Failure | 10 | 58 |

The classifier detected 58 of 68 failures while raising 85 false alarms. Its validation recall goal did not fully transfer to the test set. With only 68 positive observations, these point estimates have limited precision; no external dataset or uncertainty intervals are included. Accuracy is not used to select the candidate.

Sources: [final_evaluation.json](metrics/final_evaluation.json), [threshold_analysis.json](metrics/threshold_analysis.json), and [calibration.json](metrics/calibration.json).

## Explanations

TreeSHAP uses `tree_path_dependent` perturbation and the raw XGBoost margin. Contributions are in **log-odds**, not probability percentage points. The base value plus all contributions matches the classifier's raw margin, verified in the notebook and inference tests. The Type one-hot contributions are summed back to one input-level contribution.

Global importance is mean absolute grouped SHAP over 400 validation observations sampled with seed 42. Individual explanations use the same saved preprocessing and classifier. Correlated features and the tree-path background affect attribution; these values describe model behavior and do not identify physical causes.

See [Notebook 07](../notebooks/07_explainability.ipynb), [feature_importance.json](metrics/feature_importance.json), and [the explanation figure](figures/shap_explanations.png).

## Experimental failure-type component

A separate MultiOutputClassifier wraps balanced Random Forest classifiers with 200 trees and minimum leaf size 2. It uses the same training partition and six sensor/type inputs. Five independent outputs preserve overlapping labels. The threshold is fixed at 0.5; no test-based threshold selection is performed.

There are 24 observations with multiple active flags, nine binary failures with no active flag, and 18 binary-normal observations with RNF. These original inconsistencies are preserved. The table evaluates each secondary output over the entire test partition, before any UI gating; it is not an evaluation of the combined binary-then-secondary display workflow.

| Label | Test positives | Precision | Recall | F1 | AP |
| --- | ---: | ---: | ---: | ---: | ---: |
| TWF | 7 | 0.0000 | 0.0000 | 0.0000 | 0.0498 |
| HDF | 26 | 0.6129 | 0.7308 | 0.6667 | 0.7901 |
| PWF | 15 | 0.5000 | 0.7333 | 0.5946 | 0.5789 |
| OSF | 20 | 0.8125 | 0.6500 | 0.7222 | 0.8347 |
| RNF | 5 | 0.0000 | 0.0000 | 0.0000 | 0.0029 |

TWF and RNF have **zero test recall**. RNF has only 11 training positives and five test positives. These outputs cannot support reliable diagnosis. The application displays experimental estimates when the primary classifier is positive, clearly labels their limitations, and does not alter the primary result using those estimates.

Source: [Notebook 08](../notebooks/08_failure_types.ipynb), [failure_types.json](metrics/failure_types.json), and [split_support.json](metrics/split_support.json).

## Artifacts, checks, and deployment limits

The API verifies SHA-256 values of four trusted local joblib artifacts before loading them. A checksum detects mismatched files; it does not make an untrusted pickle safe or authenticate a maliciously replaced metadata file. Model uploads are not accepted. Artifacts must be regenerated with the notebooks in order and loaded using the locked runtime environment.

Training-range warnings identify inputs outside observed numeric bounds, but are not a comprehensive distribution-shift detector. New categories and invalid numeric inputs are rejected. Historical predictions retain their stored model version; explanations are omitted if that version differs from the loaded model.

SQLite history, simulated telemetry, and transition alerts demonstrate application behavior. There is no real IoT integration, certified alarm workflow, authentication, rate limiting, drift monitoring, or automatic retraining. Real deployment would require timestamped external validation, domain review of costs and thresholds, stronger failure-type evidence, and operational controls.

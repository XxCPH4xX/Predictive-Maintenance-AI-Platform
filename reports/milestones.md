# Milestone completion report

Completed locally on 8 October 2026. The implementation follows the 20-stage roadmap, with the requested notebook workflow for data preparation, model development, visualization, and scoring. Production inference/API code is Python; the application frontend is Next.js/TypeScript.

## Milestone outcomes

| Milestone | Implementation and important decision | Main files / evidence |
| --- | --- | --- |
| 1 — Dataset audit and foundation | Inspected the actual 10,000-row CSV, preserved the raw bytes, identified target leakage and excluded identifiers. | `notebooks/01_dataset_audit_and_eda.ipynb`, `reports/dataset_audit.md`, `reports/milestone_1.md` |
| 2 — EDA | Six useful figures cover imbalance, sensors, relationships, labels, and ordered regimes. Kept rare/outlying failure observations. | Notebook 01, `reports/figures/`, `reports/milestone_2.md` |
| 3 — Preprocessing | Frozen stratified 60/20/20 split, seed 42; training-only scaling and explicit Type encoding in a saved pipeline. | `notebooks/03_preprocessing.ipynb`, `data/processed/split_manifest.json` |
| 4 — Baselines | Trained Logistic Regression and Random Forest with reproducible validation metrics. | `notebooks/04_baseline_models.ipynb`, `reports/metrics/baselines.json` |
| 5 — XGBoost | Added XGBoost and compared validation average precision with earlier candidates. | `notebooks/05_xgboost.ipynb`, `reports/metrics/xgboost.json` |
| 6 — Optimization | Bounded weighting/depth search, stratified and block cross-validation, calibration experiment, threshold selection, then final test evaluation. | `notebooks/06_model_optimization.ipynb`, `reports/metrics/`, `models/metadata.json` |
| 7 — Explainability | Saved TreeSHAP explanations in log-odds and verified additivity. Global importance uses 400 seeded validation rows. | `notebooks/07_explainability.ipynb`, `reports/figures/shap_explanations.png` |
| 8 — Inference | Loaded the exact saved preprocessing/model pipeline; centralized risk policy, metadata, range warnings, and checksum validation. | `backend/inference.py`, `backend/schemas.py`, `tests/test_inference.py` |
| 9 — FastAPI | Health, metadata, prediction, explanation, and actionable request validation; no stack traces in error responses. | `backend/main.py`, `tests/test_api.py` |
| 10 — Database | SQLite history and transactionally stored transition alerts; persistence separated from model inference. | `backend/storage.py`, `tests/test_storage.py` |
| 11 — Frontend foundation | Responsive navigation, shared UI, same-origin API proxy, and loading/error/empty states. | `frontend/app/`, `frontend/components/shell.tsx`, `frontend/lib/api.ts` |
| 12 — Single prediction | Six validated inputs, real inference, risk status, SHAP contributions, and experimental failure-type estimates. | `frontend/components/prediction.tsx` |
| 13 — Fleet | Latest machine state, condition counts, risk distribution, machine detail/history, and deduplicated alerts. | `frontend/components/fleet.tsx`, `frontend/app/machines/[machineId]/page.tsx` |
| 14 — Batch prediction | Raw UTF-8 CSV, 2 MiB / 500-row limits, explicit invalid-row reporting, valid-row persistence, results download. | `backend/batch.py`, `frontend/components/batch.tsx` |
| 15 — What-if analysis | Debounced predictions from the saved model; scenario requests do not enter history and make no causal claim. | `frontend/components/scenario.tsx` |
| 16 — Sensor simulation | Seeded telemetry explicitly labeled simulated, sent through the real prediction API; optional periodic updates and transition alerts. | `backend/simulation.py`, `frontend/components/simulation.tsx`, `tests/test_simulation.py` |
| 17 — Performance dashboard | Actual saved comparison, final metrics, PR/ROC curves, confusion matrix, global SHAP, calibration, grouped checks, and rare-label results. | `frontend/components/performance.tsx` |
| 18 — Testing and cleanup | Notebook, backend, browser, formatting, lint, typing, dependency, artifact-integrity, and source-hygiene checks. | Notebook 02, `tests/`, `frontend/e2e/platform.spec.ts`, lint/test configs and lockfiles |
| 19 — Containers | Built and exercised backend/frontend images, non-root runtime, backend health check, same-origin proxy, persistent database volume. | `backend/Dockerfile`, `frontend/Dockerfile`, `.dockerignore`, `frontend/.dockerignore`, `compose.yaml` |
| 20 — Portfolio documentation | Setup, notebook execution, API examples, architecture diagram, screenshots, model card, limitations, and future work. | `README.md`, `reports/model_card.md`, this report, `reports/screenshots/` |

The secondary failure-type component was completed after the primary model's final evaluation in `notebooks/08_failure_types.ipynb`. Its multilabel formulation preserves overlapping flags. It has a separate artifact and never supplies target-derived features to the binary model. TWF and RNF have zero test recall and remain explicitly experimental.

The earlier milestone 1 and 2 reports record their original scopes. This report and the README describe the completed application.

## Verification performed

| Check | Observed result |
| --- | --- |
| Notebook validation suite | 22 passed, executed from Notebook 02 |
| Notebook structure and outputs | All eight notebooks validate; all nonempty code cells executed; no saved error outputs; nine inline figures across EDA, optimization, and explanation notebooks |
| Raw data integrity | Original upload and canonical CSV byte-identical; SHA-256 matches model metadata |
| Artifact integrity | All four inference artifact hashes match metadata |
| Backend suite | 24 passed; 4 upstream deprecation warnings |
| Ruff lint and format | Passed; 12 Python files conform |
| Installed Python dependencies | `pip check`: no broken requirements |
| Frontend lint and typing | ESLint and TypeScript passed |
| Frontend formatting | Prettier passed |
| Production frontend | Build passed locally and in its container image |
| Browser workflows | Five passed locally and against the container frontend; persisted prediction, batch errors/download, scenario isolation, simulation/fleet/mobile, saved performance/routes |
| Visual review | Reviewed desktop overview, mobile overview, prediction, and performance screenshots from real API responses |
| Backend container | Health endpoint and container health check passed; saved model loaded successfully |
| Frontend container | Built and served the standalone app; `/api/health` reached the backend by container-network hostname |
| Persistent volume | Prediction ID, machine ID, probability, and model version retained after removing and recreating the backend container |
| Source hygiene | No unfinished TODO/FIXME, fake prediction/metric markers, generator attribution, or debugging statements found in application/test source |

The browser suite uses genuine model execution with explicitly submitted example inputs and simulated telemetry. Screenshots are not mockups. Browser checks use a separate database; they are not measurements of model generalization.

Docker CLI and Compose were unavailable on this host. Both Dockerfiles were built in Docker image format and tested using **Podman 5.8.7**. The `docker compose up --build` path is provided for Docker users, but the Compose command itself was not executed here. The images remain available locally as `localhost/sentinel-backend:local` and `localhost/sentinel-frontend:local`. Temporary verification containers, network, and database volume were removed after the checks.

## Reproduce the checks

From the project root, with the documented Python and Node environment:

```bash
source .venv/bin/activate
jupyter execute notebooks/02_validation_checks.ipynb --inplace
python -m pytest -q
ruff check backend tests
ruff format --check backend tests
python -m pip check
```

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm format:check
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Start the backend and frontend first for browser testing, using a separate backend `DATABASE_PATH`. Set `WEB_URL` to test a different running frontend. Browser tests create example predictions in the configured database.

Container builds used:

```bash
podman build --format docker -t localhost/sentinel-backend:local -f backend/Dockerfile .
podman build --format docker -t localhost/sentinel-frontend:local -f frontend/Dockerfile frontend
```

The verification containers shared a private network with backend alias `backend`, exposed only localhost ports 18000 and 18080, and used a dedicated named history volume. Browser tests targeted `WEB_URL=http://127.0.0.1:18080`. Recreating the backend with the same volume preserved the saved prediction exactly.

## Final-stage file changes

Added container definitions and ignore files; the pinned Python runtime lockfile; frontend lint, browser-test, and start-script support; four application screenshots; the model card; and this report.

Updated backend validation and error handling, API/inference/storage tests, frontend formatting and chart rendering, package manifests and lockfile, Python lint settings, notebook validation output, and inline figure display in Notebooks 06 and 07. Updated the README to document the implemented application. Final-stage checks did not retrain or change the selected production model, decision threshold, or raw dataset.

## Remaining limitations and next work

The implemented roadmap is complete for the local demonstration. This is not a validated industrial warning system. The synthetic observations establish neither a future horizon nor external machine performance. Full-data EDA preceded splitting, ordered-block validation is substantially weaker, the binary model misses 10 of 68 test failures and raises 85 false alarms, and rare failure-type predictions are unreliable.

Future work requires new evidence rather than larger claims: obtain timestamped external data, define and evaluate a warning horizon, choose thresholds with maintenance costs, validate the combined failure-type display workflow, and add operational access controls and monitoring before public deployment. The application is intended for local operation; repository publication does not deploy a public web service.

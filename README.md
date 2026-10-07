# Predictive Maintenance & Equipment Failure Early Warning Platform

A staged machine learning engineering project using equipment sensor readings to estimate machine failure status. **Current stage: Milestone 2 — exploratory data analysis.** No model has been trained yet.

## Setup and checks

Python 3.11 or newer is recommended. This milestone was checked with Python 3.14.8, pandas 3.0.6, NumPy 2.5.3, Matplotlib 3.11.2, and pytest 9.1.1. Compatibility with later ML dependencies will be checked when they are introduced.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
```

The current audit and EDA code is in two notebooks:

1. Open [01_dataset_audit_and_eda.ipynb](notebooks/01_dataset_audit_and_eda.ipynb), select the `.venv` Python kernel, and run all cells from a fresh kernel. It contains paths, column roles, validation, audit, analysis, plotting functions, explanations, and measured outputs.
2. Save any notebook edits, then run all cells in [02_validation_checks.ipynb](notebooks/02_validation_checks.ipynb). It loads the analysis definitions and runs 22 pytest checks. Tests are collected in a temporary file that is removed after execution; no Python source modules are maintained separately.

Run the setup commands from the project root and open notebooks from that root or the `notebooks/` directory. The notebooks already contain successful execution outputs. A notebook editor is needed for interactive editing; the dependencies include the kernel and execution tools, without requiring a particular editor.

To execute and save both notebooks from the terminal after activating `.venv`:

```bash
jupyter execute notebooks/01_dataset_audit_and_eda.ipynb --inplace
jupyter execute notebooks/02_validation_checks.ipynb --inplace
```

The audit validates the CSV and writes measured summaries to `reports/dataset_audit.json` and `reports/dataset_audit.md`. It never modifies the raw data. Invalid schema or values raise an actionable validation error; label inconsistencies are reported without rewriting labels.

The analysis also writes `reports/eda_summary.json` and six static figures in `reports/figures/`, displayed inline in the notebook. Matplotlib renders them without a display server. Read the [EDA findings](reports/milestone_2.md) for interpretation, figure descriptions, and evaluation implications. Narrative observations describe the supplied dataset and should be reviewed if the data changes.

## Dataset

The supplied CSV is retained unchanged at `data/raw/ai4i2020.csv`; the original root-level upload is also preserved and ignored by Git. The normalized data location contains an identical copy, including the UTF-8 byte-order mark.

- User-selected source: [Kaggle AI4I 2020](https://www.kaggle.com/datasets/stephanmatzka/predictive-maintenance-dataset-ai4i-2020).
- Dataset citation: AI4I 2020 Predictive Maintenance Dataset (2020), UCI Machine Learning Repository, [DOI: 10.24432/C5HS5C](https://doi.org/10.24432/C5HS5C).
- [UCI dataset documentation](https://archive.ics.uci.edu/dataset/601/ai4i+2020+predictive+maintenance+dataset) identifies the dataset as synthetic and licenses it under CC BY 4.0.

The canonical CSV is eligible for version control: it is approximately 510 KiB, and attribution is provided above. Model artifacts, derived data, environments, and local databases are ignored. No Git repository existed at the start of this milestone; no commit has been made.

## Current formulation

Binary target: `Machine failure` (0 = normal, 1 = failure). Candidate inputs are `Type`, air temperature, process temperature, rotational speed, torque, and tool wear. Failure-state flags are excluded to prevent target leakage; identifiers are excluded to prevent row-order and serial-number shortcuts.

See [dataset measurements](reports/dataset_audit.md) and [feature decisions and limitations](reports/milestone_1.md). The CSV contains 339 failures among 10,000 observations, overlapping failure labels, and inconsistencies between those flags and the primary target.

## Project structure

```text
data/raw/ai4i2020.csv                    Immutable dataset
notebooks/01_dataset_audit_and_eda.ipynb  Complete audit and EDA implementation
notebooks/02_validation_checks.ipynb     Automated validation checks
reports/dataset_audit.*                  Measured audit in Markdown and JSON
reports/milestone_1.md                   Initial feature and label decisions
reports/eda_summary.json                Measured EDA summaries
reports/figures/                         Six focused EDA figures
reports/milestone_2.md                   EDA findings and evaluation implications
```

Data preparation, model training, visualization, and scoring will use Jupyter notebooks. Production inference, API, persistence, and the frontend will use ordinary source files in the appropriate languages when those milestones begin. The current notebooks replace the original audit and EDA Python modules; this repository implements only those first two milestones.

## Limitations and next step

This synthetic dataset demonstrates ML engineering concepts. Predictions will not substitute for real industrial maintenance systems, and performance on this dataset will not guarantee performance on real machines. Labels describe failure at an observation; they do not establish a future prediction horizon or remaining useful life.

EDA found strong dependence between adjacent temperature readings and a concentration of heat-dissipation flags in one part of the CSV. A random split alone will not establish generalization to new operating regimes. Full-data EDA has also exposed aggregate information about records that will later enter the test set; future evaluation must disclose that limitation.

Next: Milestone 3 — reusable preprocessing and documented train/validation/test splitting, with an order-aware robustness protocol. Fit preprocessing only on training data and keep test partitions fixed for final evaluation.

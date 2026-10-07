import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = Path(os.getenv("MODEL_DIR", ROOT / "models"))
METRICS_DIR = ROOT / "reports" / "metrics"
DATABASE_PATH = Path(os.getenv("DATABASE_PATH", ROOT / "data" / "predictions.sqlite3"))
MAX_UPLOAD_BYTES = 2 * 1024 * 1024
MAX_BATCH_ROWS = 500
FIELD_MAP = {
    "machine_type": "Type",
    "air_temperature": "Air temperature [K]",
    "process_temperature": "Process temperature [K]",
    "rotational_speed": "Rotational speed [rpm]",
    "torque": "Torque [Nm]",
    "tool_wear": "Tool wear [min]",
}

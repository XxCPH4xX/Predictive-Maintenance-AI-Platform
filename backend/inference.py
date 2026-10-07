import hashlib
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from backend.config import FIELD_MAP, MODEL_DIR
from backend.schemas import MachineReading


def risk_level(probability: float, thresholds: dict[str, float]) -> str:
    if probability >= thresholds["critical"]:
        return "critical"
    if probability >= thresholds["high_risk"]:
        return "high_risk"
    if probability >= thresholds["warning"]:
        return "warning"
    return "healthy"


class PredictionEngine:
    """Load only the local, versioned artifacts built by the notebooks."""

    def __init__(self, model_dir: Path = MODEL_DIR):
        self.metadata = json.loads((model_dir / "metadata.json").read_text())
        artifacts = {}
        for name in ("production.joblib", "explanation_model.joblib", "explainer.joblib", "failure_types.joblib"):
            path = model_dir / name
            expected = self.metadata["artifact_hashes"][name]
            if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
                raise ValueError(f"Model artifact checksum mismatch: {name}")
            artifacts[name] = joblib.load(path)
        self.pipeline = artifacts["production.joblib"]
        self.explanation_pipeline = artifacts["explanation_model.joblib"]
        self.explainer = artifacts["explainer.joblib"]
        self.failure_pipeline = artifacts["failure_types.joblib"]

    def to_frame(self, readings: list[MachineReading]) -> pd.DataFrame:
        return pd.DataFrame([
            {raw_name: getattr(reading, field) for field, raw_name in FIELD_MAP.items()}
            for reading in readings
        ], columns=self.metadata["features"])

    def predict(self, readings: list[MachineReading]) -> list[dict]:
        if not readings:
            return []
        frame = self.to_frame(readings)
        probabilities = self.pipeline.predict_proba(frame)[:, 1]
        type_probabilities = self.failure_pipeline.predict_proba(frame)
        results = []
        for index, probability in enumerate(probabilities):
            probability = float(probability)
            predicted_class = int(probability >= self.metadata["decision_threshold"])
            warnings = [
                f"{column} is outside the model's observed training range"
                for column, bounds in self.metadata["training_ranges"].items()
                if not bounds["minimum"] <= frame.iloc[index][column] <= bounds["maximum"]
            ]
            flags = [
                {"label": label, "probability": float(type_probabilities[j][index, 1])}
                for j, label in enumerate(self.metadata["failure_type_labels"])
            ] if predicted_class else []
            results.append({
                "failure_probability": probability,
                "prediction": predicted_class,
                "risk_level": risk_level(probability, self.metadata["risk_thresholds"]),
                "model_version": self.metadata["model_version"],
                "failure_types": sorted(flags, key=lambda flag: flag["probability"], reverse=True),
                "failure_type_note": self.metadata["failure_type_limitation"],
                "warnings": warnings,
            })
        return results

    def explain(self, reading: MachineReading) -> dict:
        frame = self.to_frame([reading])
        transformed = self.explanation_pipeline.named_steps["preprocess"].transform(frame)
        explanation = self.explainer(transformed)
        values = np.asarray(explanation.values)[0]
        contributions = [*values[:5], values[5:].sum()]
        names = [*list(FIELD_MAP.values())[1:], "Type"]
        return {
            "base_value": float(np.asarray(explanation.base_values).reshape(-1)[0]),
            "units": self.metadata["explanation_units"],
            "contributions": sorted([
                {"feature": name, "value": float(value)}
                for name, value in zip(names, contributions)
            ], key=lambda item: abs(item["value"]), reverse=True),
            "interpretation": "Contributions to the model score, not causal effects or probability percentage points",
            "model_version": self.metadata["model_version"],
        }

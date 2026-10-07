import json

import numpy as np
import pytest
from pydantic import ValidationError

from backend.config import MODEL_DIR
from backend.inference import PredictionEngine, risk_level
from backend.schemas import MachineReading


@pytest.fixture(scope="session")
def engine():
    return PredictionEngine()


@pytest.fixture
def reading():
    return MachineReading(machine_type="M", air_temperature=298.1, process_temperature=308.6,
                          rotational_speed=1551, torque=42.8, tool_wear=0)


def test_inference_matches_persisted_pipeline(engine, reading):
    result = engine.predict([reading])[0]
    expected = engine.pipeline.predict_proba(engine.to_frame([reading]))[0, 1]
    assert result["failure_probability"] == pytest.approx(expected)
    assert result["prediction"] == int(expected >= engine.metadata["decision_threshold"])


def test_explanation_adds_to_model_score(engine, reading):
    explanation = engine.explain(reading)
    value = explanation["base_value"] + sum(item["value"] for item in explanation["contributions"])
    transformed = engine.explanation_pipeline.named_steps["preprocess"].transform(engine.to_frame([reading]))
    expected = engine.explanation_pipeline.named_steps["classifier"].predict(transformed, output_margin=True)[0]
    assert value == pytest.approx(float(expected), abs=1e-4)
    assert len(explanation["contributions"]) == 6


def test_risk_boundary_values(engine):
    thresholds = engine.metadata["risk_thresholds"]
    assert risk_level(0, thresholds) == "healthy"
    for label, threshold in thresholds.items():
        assert risk_level(threshold, thresholds) == label
    assert risk_level(1, thresholds) == "critical"


@pytest.mark.parametrize(("field", "value"), [("machine_type", "X"), ("torque", -1),
    ("air_temperature", float("inf")), ("tool_wear", True), ("rotational_speed", 1.5)])
def test_invalid_readings(reading, field, value):
    with pytest.raises(ValidationError):
        MachineReading(**{**reading.model_dump(), field: value})


def test_artifact_tampering_rejected(tmp_path):
    (tmp_path / "metadata.json").write_text((MODEL_DIR / "metadata.json").read_text())
    (tmp_path / "production.joblib").write_bytes(b"invalid artifact")
    with pytest.raises(ValueError, match="checksum mismatch"):
        PredictionEngine(tmp_path)

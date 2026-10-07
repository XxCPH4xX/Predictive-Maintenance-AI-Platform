from backend.schemas import PredictionRequest
from backend.simulation import SensorSimulator


def test_simulation_is_reproducible_valid_and_has_no_risk_scores():
    first, second = SensorSimulator(), SensorSimulator()
    for _ in range(10):
        readings = first.readings(5)
        assert readings == second.readings(5)
        for reading in readings:
            validated = PredictionRequest(**reading)
            assert validated.source == "simulated"
            assert "failure_probability" not in reading

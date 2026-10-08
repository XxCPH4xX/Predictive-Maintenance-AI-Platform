import pytest
from fastapi.testclient import TestClient

from backend.main import create_app

READING = {
    "machine_type": "M",
    "air_temperature": 298.1,
    "process_temperature": 308.6,
    "rotational_speed": 1551,
    "torque": 42.8,
    "tool_wear": 0,
    "machine_id": "M-001",
}


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    with TestClient(
        create_app(database_path=tmp_path_factory.mktemp("api") / "history.sqlite3")
    ) as instance:
        yield instance


def test_prediction_contract(client):
    response = client.post("/predict", json=READING)
    assert response.status_code == 200
    result = response.json()
    assert 0 <= result["failure_probability"] <= 1
    assert result["risk_level"] in {"healthy", "warning", "high_risk", "critical"}
    assert len(result["explanation"]["contributions"]) == 6
    assert client.get("/health").json()["model_version"] == result["model_version"]


@pytest.mark.parametrize(
    "change",
    [
        {"machine_type": "X"},
        {"torque": -1},
        {"TWF": 1},
        {"tool_wear": True},
        {"machine_id": "=BAD"},
    ],
)
def test_invalid_requests_return_422(client, change):
    assert client.post("/predict", json={**READING, **change}).status_code == 422


def test_missing_fields_and_malformed_json(client):
    assert client.post("/predict", json={}).status_code == 422
    assert (
        client.post(
            "/predict", content="bad", headers={"Content-Type": "application/json"}
        ).status_code
        == 422
    )


def test_nonfinite_json_reading_returns_validation_error(client):
    import json

    content = json.dumps({**READING, "air_temperature": float("nan")})
    response = client.post(
        "/predict", content=content, headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 422
    assert "finite" in response.text


def test_model_metadata_and_explanation(client):
    metadata = client.get("/model/info").json()
    assert len(metadata["features"]) == 6
    assert metadata["decision_threshold"] == metadata["risk_thresholds"]["high_risk"]
    assert client.post("/explain", json=READING).json()["units"] == "log_odds"


def test_history_and_scenarios(client):
    result = client.post("/predict", json=READING).json()
    assert (
        client.get(f"/predictions/{result['id']}").json()["inputs"]["torque"] == READING["torque"]
    )
    before = client.get("/predictions").json()["total"]
    scenario = client.post("/predict", json={**READING, "source": "scenario"})
    assert scenario.status_code == 200 and "id" not in scenario.json()
    assert client.get("/predictions").json()["total"] == before
    assert client.get("/predictions/999999").status_code == 404
    assert client.get("/predictions?limit=1000").status_code == 422
    assert client.get("/fleet").json()["total_machines"] == 1


def test_batch_preserves_invalid_rows_and_only_saves_valid(client):
    template = client.get("/batch/template").text
    content = template + "BAD-1,X,298,310,1500,40,0\n"
    before = client.get("/predictions").json()["total"]
    result = client.post("/predict/batch", content=content, headers={"Content-Type": "text/csv"})
    assert result.status_code == 200
    assert result.json()["valid_rows"] == 1
    assert result.json()["invalid_rows"][0]["row"] == 3
    assert client.get("/predictions").json()["total"] == before + 1


def test_batch_limits_and_schema(client):
    assert client.post("/predict/batch", content="bad\n1").status_code == 400
    assert client.post("/predict/batch", content=b"x" * (2 * 1024 * 1024 + 1)).status_code == 413
    template = client.get("/batch/template").text.splitlines()
    before = client.get("/predictions").json()["total"]
    assert (
        client.post(
            "/predict/batch", content=template[0] + "\n" + (template[1] + "\n") * 501
        ).status_code
        == 400
    )
    assert client.get("/predictions").json()["total"] == before


def test_saved_performance_and_simulated_prediction(client):
    report = client.get("/model/performance")
    assert report.status_code == 200
    assert report.json()["final"]["metrics"]["support"] == 2000
    readings = client.post("/simulation/readings", json={"machines": 3}).json()["readings"]
    assert len(readings) == 3
    result = client.post("/predict", json=readings[0]).json()
    assert result["source"] == "simulated" and result["machine_id"].startswith("SIM-")
    assert client.post("/simulation/readings", json={"machines": 100}).status_code == 422

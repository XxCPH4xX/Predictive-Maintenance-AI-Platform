from backend.storage import PredictionStore


def test_alerts_only_on_upward_transitions_and_history_survives_restart(tmp_path):
    path = tmp_path / "history.sqlite3"
    store = PredictionStore(path)
    for risk in ("healthy", "warning", "warning", "critical", "critical", "healthy"):
        store.save(
            {"torque": 40},
            {"risk_level": risk, "failure_probability": 0.2, "model_version": "test"},
            "M-1",
            "simulated",
        )
    restored = PredictionStore(path)
    assert restored.history()["total"] == 6
    fleet = restored.fleet()
    assert len(fleet["alerts"]) == 2
    assert fleet["total_machines"] == 1
    assert fleet["risk_distribution"]["healthy"] == 1
    assert restored.history(machine_id="missing")["total"] == 0

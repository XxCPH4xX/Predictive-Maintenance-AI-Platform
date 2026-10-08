import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

RISK_ORDER = {"healthy": 0, "warning": 1, "high_risk": 2, "critical": 3}


class PredictionStore:
    """Keep SQL and transaction boundaries separate from model inference."""

    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connection() as connection:
            connection.executescript("""
                CREATE TABLE IF NOT EXISTS predictions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    machine_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    source TEXT NOT NULL,
                    inputs TEXT NOT NULL,
                    result TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS prediction_machine ON predictions(machine_id, id);
                CREATE TABLE IF NOT EXISTS alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    prediction_id INTEGER NOT NULL REFERENCES predictions(id),
                    machine_id TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    previous_risk TEXT NOT NULL,
                    risk_level TEXT NOT NULL,
                    failure_probability REAL NOT NULL,
                    source TEXT NOT NULL
                );
            """)

    @contextmanager
    def connection(self):
        connection = sqlite3.connect(self.path, timeout=10)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    @staticmethod
    def decode(row) -> dict:
        return {
            "id": row["id"],
            "machine_id": row["machine_id"],
            "timestamp": row["timestamp"],
            "source": row["source"],
            "inputs": json.loads(row["inputs"]),
            **json.loads(row["result"]),
        }

    def save(self, inputs: dict, result: dict, machine_id: str | None, source: str) -> dict:
        machine_id = machine_id or f"OBS-{uuid4().hex[:10]}"
        timestamp = datetime.now(timezone.utc).isoformat()
        with self.connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            previous = connection.execute(
                "SELECT result FROM predictions WHERE machine_id = ? ORDER BY id DESC LIMIT 1",
                (machine_id,),
            ).fetchone()
            old_risk = json.loads(previous["result"])["risk_level"] if previous else "healthy"
            cursor = connection.execute(
                "INSERT INTO predictions(machine_id,timestamp,source,inputs,result) VALUES(?,?,?,?,?)",
                (machine_id, timestamp, source, json.dumps(inputs), json.dumps(result)),
            )
            prediction_id = cursor.lastrowid
            if RISK_ORDER[result["risk_level"]] > RISK_ORDER[old_risk]:
                connection.execute(
                    "INSERT INTO alerts(prediction_id,machine_id,timestamp,previous_risk,risk_level,failure_probability,source) VALUES(?,?,?,?,?,?,?)",
                    (
                        prediction_id,
                        machine_id,
                        timestamp,
                        old_risk,
                        result["risk_level"],
                        result["failure_probability"],
                        source,
                    ),
                )
        return {
            "id": prediction_id,
            "machine_id": machine_id,
            "timestamp": timestamp,
            "source": source,
            "inputs": inputs,
            **result,
        }

    def history(self, limit: int = 50, offset: int = 0, machine_id: str | None = None) -> dict:
        where = "WHERE machine_id = ?" if machine_id else ""
        parameters = (machine_id,) if machine_id else ()
        with self.connection() as connection:
            total = connection.execute(
                f"SELECT COUNT(*) FROM predictions {where}", parameters
            ).fetchone()[0]
            rows = connection.execute(
                f"SELECT * FROM predictions {where} ORDER BY id DESC LIMIT ? OFFSET ?",
                (*parameters, limit, offset),
            ).fetchall()
        return {"total": total, "items": [self.decode(row) for row in rows]}

    def get(self, prediction_id: int) -> dict | None:
        with self.connection() as connection:
            row = connection.execute(
                "SELECT * FROM predictions WHERE id = ?", (prediction_id,)
            ).fetchone()
        return self.decode(row) if row else None

    def fleet(self) -> dict:
        with self.connection() as connection:
            rows = connection.execute(
                "SELECT p.* FROM predictions p JOIN (SELECT machine_id, MAX(id) AS latest FROM predictions GROUP BY machine_id) m ON p.id=m.latest ORDER BY p.id DESC"
            ).fetchall()
            alerts = connection.execute("SELECT * FROM alerts ORDER BY id DESC LIMIT 20").fetchall()
        machines = [self.decode(row) for row in rows]
        distribution = {
            risk: sum(machine["risk_level"] == risk for machine in machines) for risk in RISK_ORDER
        }
        return {
            "machines": machines,
            "total_machines": len(machines),
            "risk_distribution": distribution,
            "average_failure_probability": sum(
                machine["failure_probability"] for machine in machines
            )
            / len(machines)
            if machines
            else None,
            "alerts": [dict(row) for row in alerts],
        }

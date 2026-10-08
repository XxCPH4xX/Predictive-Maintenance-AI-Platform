import csv
import json
import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response

from backend.batch import parse_batch
from backend.config import (
    DATABASE_PATH,
    FIELD_MAP,
    MAX_UPLOAD_BYTES,
    METRICS_DIR,
    MODEL_DIR,
)
from backend.inference import PredictionEngine
from backend.schemas import PredictionRequest, SimulationRequest
from backend.simulation import SensorSimulator
from backend.storage import PredictionStore

logger = logging.getLogger(__name__)


def create_app(model_dir: Path = MODEL_DIR, database_path: Path = DATABASE_PATH) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.engine = PredictionEngine(model_dir)
        app.state.store = PredictionStore(database_path)
        app.state.simulator = SensorSimulator()
        yield

    app = FastAPI(title="Predictive Maintenance Platform", version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=os.getenv(
            "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(","),
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.exception_handler(Exception)
    async def server_error(request: Request, error: Exception):
        logger.exception("Prediction request failed", exc_info=error)
        return JSONResponse(
            status_code=500,
            content={"detail": "Request could not be completed. Check server logs."},
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "detail": [
                    {"loc": item["loc"], "msg": item["msg"], "type": item["type"]}
                    for item in error.errors()
                ]
            },
        )

    @app.get("/health")
    def health(request: Request):
        return {
            "status": "ok",
            "model_version": request.app.state.engine.metadata["model_version"],
        }

    @app.get("/model/info")
    def model_info(request: Request):
        return request.app.state.engine.metadata

    @app.get("/model/performance")
    def model_performance(request: Request):
        files = {
            "comparison": "model_comparison.json",
            "final": "final_evaluation.json",
            "importance": "feature_importance.json",
            "cross_validation": "cross_validation.json",
            "calibration": "calibration.json",
            "thresholds": "threshold_analysis.json",
            "failure_types": "failure_types.json",
        }
        results = {
            name: json.loads((METRICS_DIR / filename).read_text())
            for name, filename in files.items()
        }
        if results["final"]["model_version"] != request.app.state.engine.metadata["model_version"]:
            raise HTTPException(503, "Saved evaluation does not match the loaded model")
        return results

    @app.post("/predict")
    def predict(payload: PredictionRequest, request: Request):
        result = request.app.state.engine.predict([payload])[0]
        if payload.source != "scenario":
            inputs = {field: getattr(payload, field) for field in FIELD_MAP}
            result = request.app.state.store.save(
                inputs, result, payload.machine_id, payload.source
            )
        return {**result, "explanation": request.app.state.engine.explain(payload)}

    @app.post("/explain")
    def explain(payload: PredictionRequest, request: Request):
        return request.app.state.engine.explain(payload)

    @app.get("/batch/template")
    def batch_template():
        content = "machine_id,machine_type,air_temperature,process_temperature,rotational_speed,torque,tool_wear\nEXAMPLE-001,M,298.1,308.6,1551,42.8,0\n"
        return Response(
            content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=machine_readings.csv"},
        )

    @app.post("/predict/batch")
    async def batch_predict(request: Request):
        content = bytearray()
        async for chunk in request.stream():
            if len(content) + len(chunk) > MAX_UPLOAD_BYTES:
                raise HTTPException(413, "CSV exceeds the 2 MiB upload limit")
            content.extend(chunk)
        try:
            valid, invalid, total = parse_batch(bytes(content))
        except (ValueError, csv.Error) as error:
            raise HTTPException(400, str(error)) from error
        results = request.app.state.engine.predict([reading for _, reading in valid])
        saved = []
        for (line, reading), result in zip(valid, results):
            inputs = {field: getattr(reading, field) for field in FIELD_MAP}
            item = request.app.state.store.save(inputs, result, reading.machine_id, "batch")
            saved.append({"row": line, **item})
        return {
            "total_rows": total,
            "valid_rows": len(saved),
            "invalid_rows": invalid,
            "predictions": saved,
            "high_risk_rows": sum(
                item["risk_level"] in {"high_risk", "critical"} for item in saved
            ),
        }

    @app.get("/predictions")
    def predictions(
        request: Request,
        limit: int = Query(50, ge=1, le=100),
        offset: int = Query(0, ge=0),
        machine_id: str | None = None,
    ):
        return request.app.state.store.history(limit, offset, machine_id)

    @app.get("/predictions/{prediction_id}")
    def prediction_detail(prediction_id: int, request: Request):
        result = request.app.state.store.get(prediction_id)
        if result is None:
            raise HTTPException(404, "Prediction not found")
        if result["model_version"] != request.app.state.engine.metadata["model_version"]:
            return {
                **result,
                "explanation": None,
                "warnings": [
                    *result["warnings"],
                    "The original model version is unavailable for explanation",
                ],
            }
        return {
            **result,
            "explanation": request.app.state.engine.explain(PredictionRequest(**result["inputs"])),
        }

    @app.get("/fleet")
    def fleet(request: Request):
        return request.app.state.store.fleet()

    @app.post("/simulation/readings")
    def simulated_readings(payload: SimulationRequest, request: Request):
        return {
            "source": "simulated",
            "readings": request.app.state.simulator.readings(payload.machines),
        }

    return app


app = create_app()

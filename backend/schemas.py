from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MachineReading(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

    machine_type: Literal["L", "M", "H"]
    air_temperature: float = Field(ge=200, le=450)
    process_temperature: float = Field(ge=200, le=550)
    rotational_speed: int = Field(ge=100, le=10000)
    torque: float = Field(gt=0, le=500)
    tool_wear: int = Field(ge=0, le=10000)

    @field_validator("air_temperature", "process_temperature", "rotational_speed", "torque", "tool_wear", mode="before")
    @classmethod
    def reject_boolean_readings(cls, value):
        if isinstance(value, bool):
            raise ValueError("Sensor values must be numeric, not boolean")
        return value


class PredictionRequest(MachineReading):
    machine_id: str | None = Field(default=None, pattern=r"^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$")
    source: Literal["manual", "batch", "simulated", "scenario"] = "manual"


class SimulationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    machines: int = Field(default=5, ge=1, le=20)

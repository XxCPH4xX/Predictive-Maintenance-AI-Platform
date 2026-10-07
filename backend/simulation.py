import math
import random
import threading


class SensorSimulator:
    """Generate labeled demonstration readings, never risk scores."""

    def __init__(self, seed: int = 42):
        self.random = random.Random(seed)
        self.tick = 0
        self.lock = threading.Lock()

    def readings(self, count: int) -> list[dict]:
        with self.lock:
            self.tick += 1
            readings = []
            for index in range(count):
                load = (math.sin(self.tick / 4 + index) + 1) / 2
                torque = round(32 + load * 30 + self.random.uniform(-2, 2), 1)
                air = round(300 + 2 * math.sin(self.tick / 15 + index / 2), 1)
                readings.append({
                    "machine_id": f"SIM-{index + 1:03d}",
                    "machine_type": ("L", "M", "H")[index % 3],
                    "air_temperature": air,
                    "process_temperature": round(air + 8.2 + (1 - load) * 2, 1),
                    "rotational_speed": round(1710 - torque * 6 + self.random.uniform(-25, 25)),
                    "torque": torque,
                    "tool_wear": (index * 41 + self.tick * 3) % 245,
                    "source": "simulated",
                })
            return readings

import csv
import io

from pydantic import ValidationError

from backend.config import FIELD_MAP, MAX_BATCH_ROWS
from backend.schemas import PredictionRequest


def parse_batch(
    content: bytes,
) -> tuple[list[tuple[int, PredictionRequest]], list[dict], int]:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as error:
        raise ValueError("CSV must use UTF-8 encoding") from error
    if "\x00" in text:
        raise ValueError("CSV contains invalid null bytes")
    reader = csv.DictReader(io.StringIO(text), strict=True)
    fields = reader.fieldnames or []
    if len(fields) != len(set(fields)):
        raise ValueError("CSV contains duplicate column names")
    missing = sorted(set(FIELD_MAP) - set(fields))
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")
    extra = sorted(set(fields) - set(FIELD_MAP) - {"machine_id"})
    if extra:
        raise ValueError(
            f"Unsupported columns: {', '.join(extra)}. Use the downloadable input template."
        )
    valid, invalid = [], []
    total = 0
    for total, row in enumerate(reader, start=1):
        if total > MAX_BATCH_ROWS:
            raise ValueError(f"CSV exceeds the {MAX_BATCH_ROWS}-row limit")
        line = reader.line_num
        if None in row or any(value is None for value in row.values()):
            invalid.append({"row": line, "errors": ["Row has the wrong number of fields"]})
            continue
        row["machine_id"] = row.get("machine_id") or None
        try:
            valid.append((line, PredictionRequest(**row, source="batch")))
        except ValidationError as error:
            invalid.append(
                {
                    "row": line,
                    "errors": [
                        f"{'.'.join(map(str, item['loc']))}: {item['msg']}"
                        for item in error.errors()
                    ],
                }
            )
    if total == 0:
        raise ValueError("CSV contains no records")
    return valid, invalid, total

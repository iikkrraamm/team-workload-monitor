from flask import Blueprint, jsonify, request

from database import get_db
from settings import (
    DEFAULT_THRESHOLDS,
    THRESHOLD_KEYS,
    get_thresholds,
    reset_thresholds,
    save_thresholds,
    validate_thresholds,
)

settings_bp = Blueprint("settings", __name__)


def _payload(db):
    values = get_thresholds(db)
    return {
        "values": values,
        "defaults": dict(DEFAULT_THRESHOLDS),
        "is_default": values == DEFAULT_THRESHOLDS,
    }


@settings_bp.get("/api/settings/thresholds")
def get_threshold_settings():
    return jsonify(_payload(get_db()))


@settings_bp.put("/api/settings/thresholds")
def update_threshold_settings():
    """Replace the thresholds. Fields left out keep their current value."""
    data = request.get_json(force=True, silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Body harus berupa objek JSON"}), 400
    db = get_db()
    merged = get_thresholds(db)
    merged.update({key: data[key] for key in THRESHOLD_KEYS if key in data})
    clean, errors = validate_thresholds(merged)
    if errors:
        first = next(iter(errors.values()))
        return jsonify({"error": first, "errors": errors}), 400
    save_thresholds(db, clean)
    return jsonify(_payload(db))


@settings_bp.delete("/api/settings/thresholds")
def reset_threshold_settings():
    db = get_db()
    reset_thresholds(db)
    return jsonify(_payload(db))

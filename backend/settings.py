"""Settings that can be changed while the app is running, kept in the database
(table app_settings) so no code change or restart is needed.

Currently the workload thresholds: the percentages of a member's capacity at
which the status changes. Each status begins where the previous one ends:

    idle      no hours at all
    low       below `low_max`
    normal    from `low_max` up to and including `normal_max`
    padat     above `normal_max`, below `overload_from`
    overload  `overload_from` and above

The same overload boundary is used for burnout: a working day counts as an
overload day exactly when its status would be "overload".
"""

import math
import sqlite3
from datetime import datetime

DEFAULT_THRESHOLDS = {"low_max": 30.0, "normal_max": 80.0, "overload_from": 110.0}
THRESHOLD_KEYS = tuple(DEFAULT_THRESHOLDS)
MAX_PERCENT = 1000.0

FIELD_LABEL = {
    "low_max": "Batas atas Low",
    "normal_max": "Batas atas Normal",
    "overload_from": "Overload mulai dari",
}


def _as_number(value):
    """A real, finite number, or None. Booleans and strings are rejected so a
    stray `true` or "abc" can't be stored as a threshold."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if math.isfinite(value) else None


def validate_thresholds(values):
    """Returns (clean_values, errors). `errors` maps a field to a message in
    Indonesian; clean_values is only meaningful when errors is empty."""
    errors, clean = {}, {}
    for key in THRESHOLD_KEYS:
        number = _as_number(values.get(key))
        if number is None:
            errors[key] = f"{FIELD_LABEL[key]} harus berupa angka."
        elif number <= 0:
            errors[key] = f"{FIELD_LABEL[key]} harus lebih besar dari 0."
        elif number > MAX_PERCENT:
            errors[key] = f"{FIELD_LABEL[key]} maksimal {MAX_PERCENT:g}%."
        else:
            clean[key] = round(number, 2)
    if not errors:
        if not clean["low_max"] < clean["normal_max"]:
            errors["normal_max"] = "Batas atas Normal harus lebih besar dari batas atas Low."
        if not clean["normal_max"] < clean["overload_from"]:
            errors["overload_from"] = "Overload harus mulai di atas batas atas Normal."
    return clean, errors


def get_thresholds(db):
    """The thresholds in effect. Missing, unreadable or inconsistent stored
    values fall back to the defaults, so a bad row can never break the pages."""
    try:
        rows = db.execute(
            "SELECT key, value FROM app_settings WHERE key IN (?, ?, ?)", THRESHOLD_KEYS
        ).fetchall()
    except sqlite3.Error:
        return dict(DEFAULT_THRESHOLDS)
    values = dict(DEFAULT_THRESHOLDS)
    for row in rows:
        try:
            values[row[0]] = float(row[1])
        except (TypeError, ValueError):
            return dict(DEFAULT_THRESHOLDS)
    clean, errors = validate_thresholds(values)
    return dict(DEFAULT_THRESHOLDS) if errors else clean


def save_thresholds(db, clean):
    now = datetime.utcnow().isoformat()
    for key in THRESHOLD_KEYS:
        db.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            (key, repr(clean[key]), now),
        )
    db.commit()


def reset_thresholds(db):
    db.execute("DELETE FROM app_settings WHERE key IN (?, ?, ?)", THRESHOLD_KEYS)
    db.commit()

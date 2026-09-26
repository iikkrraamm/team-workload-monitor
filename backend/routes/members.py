import uuid
from datetime import datetime, date as date_cls

from flask import Blueprint, jsonify, request

from database import get_db
from serializers import activity_row_to_dict, member_row_to_dict


members_bp = Blueprint("members", __name__)


@members_bp.get("/api/members")
def list_members():
    rows = get_db().execute("SELECT * FROM members ORDER BY name").fetchall()
    return jsonify([member_row_to_dict(row) for row in rows])


@members_bp.get("/api/activities")
def list_activities():
    member_id = request.args.get("member_id")
    activity_date = request.args.get("date")
    query = "SELECT * FROM activities WHERE 1=1"
    params = []
    if member_id:
        query += " AND member_id = ?"
        params.append(member_id)
    if activity_date:
        query += " AND date = ?"
        params.append(activity_date)
    rows = get_db().execute(query + " ORDER BY date DESC", params).fetchall()
    return jsonify([activity_row_to_dict(row) for row in rows])


@members_bp.post("/api/activities")
def create_activity():
    data = request.get_json(force=True)
    db = get_db()
    activity_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO activities (id, member_id, title, hours, date, created_at) VALUES (?,?,?,?,?,?)",
        (
            activity_id,
            data.get("member_id"),
            data.get("title", "Non-task activity"),
            float(data.get("hours", 1)),
            data.get("date") or date_cls.today().isoformat(),
            datetime.utcnow().isoformat(),
        ),
    )
    db.commit()
    row = db.execute("SELECT * FROM activities WHERE id = ?", (activity_id,)).fetchone()
    return jsonify(activity_row_to_dict(row)), 201


@members_bp.delete("/api/activities/<activity_id>")
def delete_activity(activity_id):
    db = get_db()
    db.execute("DELETE FROM activities WHERE id = ?", (activity_id,))
    db.commit()
    return jsonify({"ok": True})


@members_bp.post("/api/members")
def create_member():
    data = request.get_json(force=True)
    db = get_db()
    member_id = str(uuid.uuid4())
    db.execute(
        "INSERT INTO members (id, name, role, capacity_hours_per_day, color, created_at) VALUES (?,?,?,?,?,?)",
        (
            member_id,
            data.get("name", "Tanpa Nama"),
            data.get("role", ""),
            float(data.get("capacity_hours_per_day", 8)),
            data.get("color", "#7C6FF0"),
            datetime.utcnow().isoformat(),
        ),
    )
    db.commit()
    row = db.execute("SELECT * FROM members WHERE id = ?", (member_id,)).fetchone()
    return jsonify(member_row_to_dict(row)), 201


@members_bp.put("/api/members/<member_id>")
def update_member(member_id):
    data = request.get_json(force=True)
    db = get_db()
    existing = db.execute("SELECT * FROM members WHERE id = ?", (member_id,)).fetchone()
    if not existing:
        return jsonify({"error": "Member tidak ditemukan"}), 404
    db.execute(
        "UPDATE members SET name=?, role=?, capacity_hours_per_day=?, color=? WHERE id=?",
        (
            data.get("name", existing["name"]),
            data.get("role", existing["role"]),
            float(data.get("capacity_hours_per_day", existing["capacity_hours_per_day"])),
            data.get("color", existing["color"]),
            member_id,
        ),
    )
    db.commit()
    row = db.execute("SELECT * FROM members WHERE id = ?", (member_id,)).fetchone()
    return jsonify(member_row_to_dict(row))


@members_bp.delete("/api/members/<member_id>")
def delete_member(member_id):
    db = get_db()
    db.execute("DELETE FROM members WHERE id = ?", (member_id,))
    db.commit()
    return jsonify({"ok": True})
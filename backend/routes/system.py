from datetime import datetime

from flask import Blueprint, jsonify, request

from chat import parse_and_execute
from database import get_db
from workload import STATUS_LABEL_ID, compute_member_workload


system_bp = Blueprint("system", __name__)


@system_bp.post("/api/ai-chat")
def ai_chat():
    data = request.get_json(force=True)
    result = parse_and_execute(
        get_db(), data.get("message", ""), compute_member_workload, STATUS_LABEL_ID
    )
    return jsonify(result)


@system_bp.get("/api/health")
def health():
    return jsonify({"ok": True, "time": datetime.utcnow().isoformat()})
from datetime import datetime

from flask import Blueprint, jsonify, request

from chat import AIError, chat_with_ai, confirm_pending_action
from database import get_db
from routes.sql import execute_generated_query, validate_generated_query
from workload import STATUS_LABEL_ID, compute_member_workload


system_bp = Blueprint("system", __name__)


@system_bp.post("/api/ai-chat")
def ai_chat():
    data = request.get_json(force=True)
    message = data.get("message", "")
    history = []
    history_items = data.get("history", [])
    if not isinstance(history_items, list):
        history_items = []
    for item in history_items[-10:]:
        if not isinstance(item, dict) or item.get("role") not in {"user", "assistant"}:
            continue
        content = item.get("content")
        if isinstance(content, str) and content.strip():
            history.append({"role": item["role"], "content": content[:4000]})
    if isinstance(message, str) and message.strip():
        history.append({"role": "user", "content": message[:4000]})
    try:
        result = chat_with_ai(
            get_db(), history, compute_member_workload, STATUS_LABEL_ID,
            validate_generated_query, execute_generated_query,
        )
    except AIError as exc:
        return jsonify({"error": str(exc)}), 502
    return jsonify(result)


@system_bp.post("/api/ai-chat/confirm")
def ai_chat_confirm():
    data = request.get_json(force=True, silent=True) or {}
    token = data.get("token")
    if not isinstance(token, str) or not token:
        return jsonify({"error": "Token konfirmasi tidak ditemukan."}), 400
    result = confirm_pending_action(get_db(), token, data.get("confirmed") is True)
    if result.get("error"):
        return jsonify(result), 400
    return jsonify(result)


@system_bp.get("/api/health")
def health():
    return jsonify({"ok": True, "time": datetime.utcnow().isoformat()})
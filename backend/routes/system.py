from datetime import datetime
import hmac
import os

from flask import Blueprint, jsonify, request

from chat import AIError, chat_with_ai, confirm_pending_action
from database import get_db
from routes.sql import execute_generated_query, validate_generated_query
from scheduler import run_schedule
from workload import STATUS_LABEL_ID, compute_member_workload
from whatsapp import (
    WhatsAppError,
    get_whatsapp_groups,
    send_whatsapp_message as send_whatsapp,
    whatsapp_enabled,
)


system_bp = Blueprint("system", __name__)


@system_bp.before_request
def guard_whatsapp_routes():
    if request.path.startswith("/api/whatsapp/") and not whatsapp_enabled():
        return jsonify({"error": "Not found"}), 404


@system_bp.get("/api/features")
def get_features():
    return jsonify({"whatsapp": whatsapp_enabled()})


@system_bp.post("/scheduler/webhook")
def scheduler_webhook():
    """
    Webhook publik yang dipanggil cron-job.org saat jadwal terpicu.

    Tidak pakai @auth_required (cron-job.org bukan user login) — sebagai
    gantinya divalidasi pakai shared secret di header X-Scheduler-Secret,
    supaya endpoint ini tidak bisa dipicu sembarang orang dari luar.

    Body request HANYA berisi {"schedule_id": "..."} — scheduler (cron-job.org)
    tidak pernah tahu apa isi prompt atau business logic yang akan dijalankan.
    """
    secret = request.headers.get("X-Scheduler-Secret", "")
    expected_secret = os.environ.get("SCHEDULER_WEBHOOK_SECRET", "").strip()
    if not expected_secret:
        return jsonify({"error": "SCHEDULER_WEBHOOK_SECRET belum dikonfigurasi."}), 503
    if not hmac.compare_digest(secret, expected_secret):
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Body request tidak valid"}), 400
    schedule_id = data.get("schedule_id")
    if not isinstance(schedule_id, str) or not schedule_id.strip():
        return jsonify({"error": "schedule_id wajib diisi"}), 400

    result = run_schedule(schedule_id)
    status_code = 200 if result.get("success") else result.get("status_code", 422)
    return jsonify(result), status_code

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


@system_bp.get("/api/whatsapp/groups")
def list_whatsapp_groups():
    try:
        return jsonify({"groups": get_whatsapp_groups()})
    except WhatsAppError as exc:
        return jsonify({"error": str(exc)}), exc.status_code


@system_bp.post("/api/whatsapp/send")
def send_whatsapp_message():
    if request.mimetype == "multipart/form-data":
        data = request.form
        uploaded_media = request.files.get("media")
    else:
        data = request.get_json(silent=True)
        uploaded_media = None
    if data is None or not hasattr(data, "get"):
        return jsonify({"error": "Isi pesan tidak valid."}), 400

    recipient = data.get("to", "")
    message_type = data.get("type", "text")
    message = data.get("body", "")
    try:
        result = send_whatsapp(
            recipient,
            body=message,
            message_type=message_type,
            media=uploaded_media,
        )
    except WhatsAppError as exc:
        return jsonify({"error": str(exc)}), exc.status_code
    return jsonify({"ok": True, "result": result})
"""Run scheduled AI prompts and send their replies through WhatsApp."""

from chat import AIError, chat_with_ai
from database import get_db
from routes.sql import execute_generated_query, validate_generated_query
from whatsapp import WhatsAppError, send_whatsapp_message
from workload import STATUS_LABEL_ID, compute_member_workload


def run_schedule(schedule_id):
    """Run one enabled schedule and deliver the AI reply to its recipient."""
    if not isinstance(schedule_id, str) or not schedule_id.strip():
        return {"success": False, "error": "schedule_id wajib diisi", "status_code": 400}

    db = get_db()
    schedule = db.execute(
        "SELECT id, prompt, recipient, enabled FROM schedules WHERE id = ?",
        (schedule_id.strip(),),
    ).fetchone()
    if not schedule:
        return {"success": False, "error": "Schedule tidak ditemukan", "status_code": 404}
    if not schedule["enabled"]:
        return {"success": False, "error": "Schedule sedang dinonaktifkan", "status_code": 409}

    prompt = schedule["prompt"].strip()
    recipient = schedule["recipient"].strip()
    if not prompt or not recipient:
        return {"success": False, "error": "Prompt atau penerima schedule belum diisi", "status_code": 422}

    try:
        result = chat_with_ai(
            db,
            [{"role": "user", "content": prompt}],
            compute_member_workload,
            STATUS_LABEL_ID,
            validate_generated_query,
            execute_generated_query,
        )
        reply = result.get("reply") if isinstance(result, dict) else None
        if not isinstance(reply, str) or not reply.strip():
            return {"success": False, "error": "AI tidak menghasilkan pesan untuk dikirim", "status_code": 502}

        # sent = send_whatsapp_message(recipient, body=reply.strip())
    except AIError as exc:
        return {"success": False, "error": str(exc), "status_code": 502}
    except WhatsAppError as exc:
        return {"success": False, "error": str(exc), "status_code": 502}

    return {
        "success": True,
        "schedule_id": schedule["id"],
        # "message_id": (sent.get("message") or {}).get("id"),
        "reply": reply.strip(),
        "recipient": recipient,
    }
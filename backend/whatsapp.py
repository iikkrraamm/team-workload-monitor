"""Reusable Wasender messaging helpers."""

import os
import re
import mimetypes

import requests


BASE_URL = "https://api.wasender.dev"
MESSAGE_TYPES = {"text", "image", "video", "audio", "voice", "document"}
DISABLED_VALUES = {"0", "false", "no", "off", "disabled"}


def whatsapp_enabled():
    """Read the runtime feature flag; enabled by default for local compatibility."""
    value = os.environ.get("ENABLE_WHATSAPP", "true").strip().lower()
    return value not in DISABLED_VALUES


class WhatsAppError(Exception):
    def __init__(self, message, status_code=502):
        super().__init__(message)
        self.status_code = status_code


def _get_token():
    token = os.environ.get("WASENDER_TOKEN", "").strip()
    if not token:
        raise WhatsAppError("WASENDER_TOKEN belum dikonfigurasi di backend.", 503)
    return token


def _request(method, path, token, failure_message, **kwargs):
    try:
        response = getattr(requests, method)(
            f"{BASE_URL}{path}",
            headers={"Authorization": f"Bearer {token}"},
            timeout=20,
            **kwargs,
        )
    except requests.RequestException as exc:
        raise WhatsAppError("Tidak dapat terhubung ke layanan Wasender.dev.") from exc

    try:
        result = response.json()
    except ValueError:
        result = {}
    if not response.ok:
        error = result.get("error", {}) if isinstance(result, dict) else None
        detail = error.get("message") if isinstance(error, dict) else None
        raise WhatsAppError(detail or failure_message)
    return result


def get_whatsapp_groups():
    """Return available groups as dictionaries containing ``id`` and ``name``."""
    result = _request(
        "get", "/groups", _get_token(), "Wasender.dev gagal mengambil daftar grup."
    )
    groups = result.get("groups", []) if isinstance(result, dict) else []
    return [
        {"id": group["id"], "name": group.get("name") or group["id"]}
        for group in groups
        if isinstance(group, dict) and isinstance(group.get("id"), str)
    ]


def send_whatsapp_message(
    to, body="", message_type="text", media=None, filename=None, mime_type=None
):
    """Send text or media to an international number or WhatsApp group.

    ``media`` may be a file-like object or a Werkzeug ``FileStorage`` instance.
    Returns the provider response and raises ``WhatsAppError`` on failure.
    """
    if not isinstance(to, str):
        raise WhatsAppError("Penerima tidak valid.", 400)

    recipient = to.strip()
    if re.fullmatch(r"[\d-]{5,31}@g\.us", recipient):
        destination = recipient
    else:
        destination = re.sub(r"\D", "", recipient)
        if not re.fullmatch(r"[1-9]\d{7,14}", destination):
            raise WhatsAppError("Gunakan nomor internasional atau ID grup WhatsApp yang valid.", 400)

    if not isinstance(message_type, str) or message_type not in MESSAGE_TYPES:
        raise WhatsAppError("Jenis pesan tidak didukung.", 400)
    if not isinstance(body, str):
        raise WhatsAppError("Isi pesan tidak valid.", 400)
    message = body.strip()
    if message_type == "text" and (not message or len(message) > 4096):
        raise WhatsAppError("Pesan wajib diisi dan maksimal 4096 karakter.", 400)
    if message_type != "text" and media is None:
        raise WhatsAppError("Pilih file media yang akan dikirim.", 400)
    if len(message) > 4096:
        raise WhatsAppError("Caption maksimal 4096 karakter.", 400)

    token = _get_token()
    endpoint = f"/messages/{message_type}"
    if message_type == "text":
        result = _request(
            "post",
            endpoint,
            token,
            "Wasender.dev gagal mengirim pesan.",
            json={"to": destination, "body": message},
        )
    else:
        stream = getattr(media, "stream", media)
        filename = (
            filename
            or getattr(media, "filename", None)
            or os.path.basename(getattr(stream, "name", "attachment"))
        )
        mime_type = (
            mime_type
            or getattr(media, "mimetype", None)
            or mimetypes.guess_type(filename)[0]
            or "application/octet-stream"
        )
        upload_result = _request(
            "post",
            "/media",
            token,
            "Wasender.dev gagal mengunggah file.",
            files={"media": (filename, stream, mime_type)},
        )
        media_id = upload_result.get("id") if isinstance(upload_result, dict) else None
        if not isinstance(media_id, str) or not media_id:
            raise WhatsAppError("Wasender.dev tidak mengembalikan ID file.")

        payload = {"to": destination, "media": media_id}
        if message:
            payload["caption"] = message
        if message_type == "document":
            payload["filename"] = filename
        result = _request(
            "post",
            endpoint,
            token,
            "Wasender.dev gagal mengirim pesan.",
            json=payload,
        )

    if not isinstance(result, dict) or result.get("sent") is not True:
        raise WhatsAppError("Wasender.dev tidak mengonfirmasi penerimaan pesan.")
    return result
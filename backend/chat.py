import re
import uuid
from datetime import datetime, timedelta, date as date_cls


PRIORITY_KEYWORDS = {
    "urgent": "urgent", "mendesak": "urgent", "darurat": "urgent",
    "tinggi": "high", "high": "high", "penting": "high",
    "sedang": "medium", "medium": "medium", "normal": "medium",
    "rendah": "low", "low": "low", "santai": "low",
}

MONTHS_ID = {
    "januari": 1, "februari": 2, "maret": 3, "april": 4, "mei": 5, "juni": 6,
    "juli": 7, "agustus": 8, "september": 9, "oktober": 10, "november": 11, "desember": 12,
}


def find_member_by_name(db, name_fragment):
    name_fragment = name_fragment.strip().lower()
    members = db.execute("SELECT * FROM members").fetchall()
    for member in members:
        if name_fragment in member["name"].lower() or member["name"].lower().split()[0] == name_fragment:
            return member
    return None


def find_task_by_title(db, title_fragment):
    title_fragment = title_fragment.strip().lower()
    tasks = db.execute("SELECT * FROM tasks").fetchall()
    best = None
    for task in tasks:
        if title_fragment in task["title"].lower():
            if best is None or len(task["title"]) < len(best["title"]):
                best = task
    return best


def extract_hours(text):
    match = re.search(r"(\d+(?:[.,]\d+)?)\s*jam", text, re.IGNORECASE)
    if match:
        return float(match.group(1).replace(",", "."))
    return None


def extract_priority(text):
    for keyword, priority in PRIORITY_KEYWORDS.items():
        if re.search(rf"\b{keyword}\b", text, re.IGNORECASE):
            return priority
    return None


def extract_date(text, today):
    text_lower = text.lower()
    if "besok" in text_lower:
        return today + timedelta(days=1)
    if "lusa" in text_lower:
        return today + timedelta(days=2)
    if "minggu depan" in text_lower:
        return today + timedelta(days=7)
    match = re.search(r"(\d{1,2})[\s/-](\d{1,2})[\s/-](\d{4})", text)
    if match:
        day, month, year = map(int, match.groups())
        try:
            return date_cls(year, month, day)
        except ValueError:
            pass
    match = re.search(r"(\d{1,2})\s+([a-zA-Z]+)(?:\s+(\d{4}))?", text_lower)
    if match:
        day = int(match.group(1))
        month = MONTHS_ID.get(match.group(2))
        year = int(match.group(3)) if match.group(3) else today.year
        if month:
            try:
                return date_cls(year, month, day)
            except ValueError:
                pass
    return None


def extract_quoted_or_title(text):
    match = re.search(r"[\"'“](.+?)[\"'”]", text)
    return match.group(1).strip() if match else None


def parse_and_execute(db, message, compute_member_workload, status_label_id):
    text = message.strip()
    lower = text.lower()
    today = date_cls.today()

    if re.search(r"\b(tambah|buat|bikin)\b.*\b(task|tugas)\b", lower) or lower.startswith("task:"):
        title = extract_quoted_or_title(text)
        if not title:
            match = re.search(r"\b(?:task|tugas)\b\s*(.+)", text, re.IGNORECASE)
            title = match.group(1).strip() if match else text
            title = re.split(r"\buntuk\b|\bprioritas\b|\bdue\b|\bdeadline\b", title, flags=re.IGNORECASE)[0].strip()
        title = title or "Tugas baru"

        assignee = None
        match = re.search(r"\b(?:untuk|ke)\s+([A-Za-z][A-Za-z\s]{1,30})", text, re.IGNORECASE)
        if match:
            candidate = match.group(1).strip().split(" prioritas")[0].split(" due")[0].strip()
            assignee = find_member_by_name(db, candidate)

        priority = extract_priority(text) or "medium"
        hours = extract_hours(text) or 4
        due = extract_date(text, today) or (today + timedelta(days=3))
        task_id = str(uuid.uuid4())
        db.execute(
            """INSERT INTO tasks (id, title, description, assignee_id, priority, estimated_hours,
               status, start_date, due_date, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (task_id, title, "", assignee["id"] if assignee else None, priority, hours,
             "todo", today.isoformat(), due.isoformat(), datetime.utcnow().isoformat()),
        )
        db.commit()
        assignee_text = f" untuk {assignee['name']}" if assignee else " (belum ada penanggung jawab)"
        reply = (
            f"Oke, aku buat task \"{title}\"{assignee_text}, prioritas {priority}, "
            f"estimasi {hours} jam, deadline {due.isoformat()}."
        )
        return {"reply": reply, "action": "create_task", "task_id": task_id}

    if re.search(r"\b(selesai|selesaikan|tandai selesai|mark done)\b", lower):
        title = extract_quoted_or_title(text)
        if not title:
            match = re.search(r"(?:task|tugas)?\s*(.+?)\s*(?:selesai|selesaikan)", lower)
            title = match.group(1).strip() if match else None
        task = find_task_by_title(db, title) if title else None
        if not task:
            return {"reply": "Aku tidak menemukan task dengan judul itu. Coba sebutkan judul yang lebih spesifik.", "action": "none"}
        db.execute("UPDATE tasks SET status='done' WHERE id=?", (task["id"],))
        db.commit()
        return {"reply": f"Sip, task \"{task['title']}\" sudah ditandai selesai.", "action": "update_task", "task_id": task["id"]}

    if re.search(r"\b(mulai|kerjakan|in progress)\b", lower):
        title = extract_quoted_or_title(text)
        if not title:
            match = re.search(r"(?:task|tugas)?\s*(.+?)\s*(?:mulai|dikerjakan)", lower)
            title = match.group(1).strip() if match else None
        task = find_task_by_title(db, title) if title else None
        if not task:
            return {"reply": "Task-nya tidak ketemu, coba sebutkan judulnya lebih jelas ya.", "action": "none"}
        db.execute("UPDATE tasks SET status='in_progress' WHERE id=?", (task["id"],))
        db.commit()
        return {"reply": f"Task \"{task['title']}\" sekarang berstatus sedang dikerjakan.", "action": "update_task", "task_id": task["id"]}

    if re.search(r"\b(hapus|delete|batalkan)\b.*\b(task|tugas)\b", lower):
        title = extract_quoted_or_title(text)
        if not title:
            match = re.search(r"\b(?:task|tugas)\b\s*(.+)", text, re.IGNORECASE)
            title = match.group(1).strip() if match else None
        task = find_task_by_title(db, title) if title else None
        if not task:
            return {"reply": "Task yang mau dihapus tidak ditemukan.", "action": "none"}
        db.execute("DELETE FROM tasks WHERE id=?", (task["id"],))
        db.commit()
        return {"reply": f"Task \"{task['title']}\" sudah dihapus.", "action": "delete_task", "task_id": task["id"]}

    if re.search(r"\b(workload|beban kerja|beban)\b", lower):
        period = "week"
        if "hari ini" in lower or "harian" in lower:
            period = "day"
        elif "bulan" in lower:
            period = "month"
        member = None
        for name_guess in re.findall(r"\b([A-Z][a-zA-Z]+)\b", text):
            member = find_member_by_name(db, name_guess)
            if member:
                break
        if member:
            info = compute_member_workload(db, member, period, today)
            reply = (
                f"Workload {member['name']} periode {period}: {info['percent']}% "
                f"({info['total_hours']} dari {info['capacity_hours']} jam kapasitas) — status {status_label_id[info['status']]}."
            )
            return {"reply": reply, "action": "query_workload", "data": info}

        members = db.execute("SELECT * FROM members").fetchall()
        lines = []
        for member in members:
            info = compute_member_workload(db, member, period, today)
            lines.append(f"{member['name']}: {info['percent']}% ({status_label_id[info['status']]})")
        return {"reply": "Ringkasan workload tim periode " + period + ":\n" + "\n".join(lines), "action": "query_workload"}

    return {
        "reply": (
            "Aku bisa bantu: tambah task baru, tandai task selesai/sedang dikerjakan, hapus task, "
            "atau cek workload seseorang. Contoh: \"tambah task 'Desain landing page' untuk Sari prioritas tinggi 5 jam due besok\"."
        ),
        "action": "none",
    }
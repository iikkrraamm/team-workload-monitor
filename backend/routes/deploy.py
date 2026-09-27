import os
import subprocess

from flask import Blueprint, jsonify, request

deploy_bp = Blueprint("deploy", __name__)

# backend/routes/deploy.py -> backend/routes -> backend -> repo root
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


@deploy_bp.post("/api/deploy")
def deploy():
    secret = os.environ.get("DEPLOY_SECRET")
    if not secret or request.headers.get("X-DEPLOY-TOKEN") != secret:
        return "Unauthorized", 403

    result = {}

    try:
        pull = subprocess.run(
            ["git", "pull", "--ff-only"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=60,
        )
        result["git_pull"] = {
            "returncode": pull.returncode,
            "stdout": pull.stdout.strip(),
            "stderr": pull.stderr.strip(),
        }
        if pull.returncode != 0:
            return jsonify(result), 500
    except Exception as e:
        return jsonify({"error": f"git pull gagal: {e}"}), 500

    # Backend code only takes effect after PythonAnywhere reloads the web
    # app's WSGI worker. That requires PythonAnywhere's own API (there is
    # no way for a running process to restart itself). Configure these
    # three env vars (e.g. in the WSGI config file) to enable it; without
    # them, git pull still runs but you'll need to click "Reload" manually.
    pa_token = os.environ.get("PYTHONANYWHERE_API_TOKEN")
    pa_user = os.environ.get("PYTHONANYWHERE_USERNAME")
    pa_domain = os.environ.get("PYTHONANYWHERE_DOMAIN")

    if pa_token and pa_user and pa_domain:
        try:
            import requests

            resp = requests.post(
                f"https://www.pythonanywhere.com/api/v0/user/{pa_user}/webapps/{pa_domain}/reload/",
                headers={"Authorization": f"Token {pa_token}"},
                timeout=30,
            )
            result["reload"] = {"status_code": resp.status_code, "ok": resp.ok}
        except Exception as e:
            result["reload"] = {"error": str(e)}
    else:
        result["reload"] = {
            "skipped": True,
            "reason": (
                "PYTHONANYWHERE_API_TOKEN / PYTHONANYWHERE_USERNAME / "
                "PYTHONANYWHERE_DOMAIN belum diset — reload manual masih diperlukan."
            ),
        }

    return jsonify(result)

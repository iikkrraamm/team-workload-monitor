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
    # app's WSGI worker. reload by deploy.sh
    pa_user = os.environ.get("PYTHONANYWHERE_USERNAME")

    os.system(f'/home/{pa_user}/deploy.sh')
    result["reload"] = {
            "msg": "success",
        }

    return jsonify(result)

"""Flask entry point and API routes for the Team Workload Monitor."""

import os

from flask import Flask, send_from_directory
from flask_cors import CORS

from database import DB_PATH, close_db, init_db
from routes.tasks import tasks_bp
from routes.members import members_bp
from routes.workload import workload_bp
from routes.system import system_bp

FRONTEND_DIST = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")

# static_folder=None disables Flask's automatic static-file route, which
# would otherwise intercept unknown paths and 404 them before our SPA
# fallback (serve_frontend, below) gets a chance to return index.html.
app = Flask(__name__, static_folder=None)
CORS(app)
app.teardown_appcontext(close_db)
app.register_blueprint(tasks_bp)
app.register_blueprint(members_bp)
app.register_blueprint(workload_bp)
app.register_blueprint(system_bp)


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    """Serve the built React app (frontend/dist) for any non-API route.

    Falls back to index.html for unknown paths so client-side navigation
    doesn't 404 on refresh. Only used once `npm run build` has produced
    frontend/dist — in local dev the Vite dev server handles the UI
    instead and this route is simply unused.
    """
    if not os.path.isdir(FRONTEND_DIST):
        return (
            "Frontend belum di-build. Jalankan `npm run build` di folder "
            "frontend/, lalu restart server ini.",
            503,
        )
    target = os.path.join(FRONTEND_DIST, path) if path else None
    if path and os.path.isfile(target):
        return send_from_directory(FRONTEND_DIST, path)
    return send_from_directory(FRONTEND_DIST, "index.html")


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", debug=False, use_reloader=False, threaded=True, port=5000)
else:
    # Ensure DB exists when imported by a WSGI server (e.g. PythonAnywhere)
    if not os.path.exists(DB_PATH):
        init_db()

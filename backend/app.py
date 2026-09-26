"""Flask entry point and API routes for the Team Workload Monitor."""

import os

from flask import Flask
from flask_cors import CORS

from database import DB_PATH, close_db, init_db
from routes.tasks import tasks_bp
from routes.members import members_bp
from routes.workload import workload_bp
from routes.system import system_bp

app = Flask(__name__)
CORS(app)
app.teardown_appcontext(close_db)
app.register_blueprint(tasks_bp)
app.register_blueprint(members_bp)
app.register_blueprint(workload_bp)
app.register_blueprint(system_bp)

if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", debug=False, use_reloader=False, threaded=True, port=5000)
else:
    # Ensure DB exists when imported by a WSGI server (e.g. PythonAnywhere)
    if not os.path.exists(DB_PATH):
        init_db()

#!/usr/bin/env bash
# run-dev.sh — start backend and frontend dev servers concurrently
# Usage: ./run-dev.sh [no-frontend] [no-backend]
set -euo pipefail
ROOT=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT"

NO_FRONTEND=false
NO_BACKEND=false
PIDS=()
for a in "$@"; do
  case "$a" in
    no-frontend) NO_FRONTEND=true ;;
    no-backend) NO_BACKEND=true ;;
    *) echo "Unknown option: $a" >&2; exit 2 ;;
  esac
done

cleanup() {
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

if [ "$NO_BACKEND" = false ]; then
  PYTHON="$ROOT/backend/venv/bin/python"
  PIP_FLAGS=()
  if [ ! -x "$PYTHON" ] || ! "$PYTHON" -m pip --version >/dev/null 2>&1; then
    if [ -d "$ROOT/backend/venv" ]; then
      rm -rf "$ROOT/backend/venv"
    fi
    if python3 -c 'import ensurepip' >/dev/null 2>&1 && python3 -m venv "$ROOT/backend/venv"; then
      PYTHON="$ROOT/backend/venv/bin/python"
    else
      if [ -d "$ROOT/backend/venv" ]; then
        rm -rf "$ROOT/backend/venv"
      fi
      echo "venv/ensurepip unavailable; installing backend dependencies for the current user."
      PYTHON="$(command -v python3)"
      PIP_FLAGS=(--user)
    fi
  fi
  echo "Installing backend dependencies..."
  "$PYTHON" -m pip install "${PIP_FLAGS[@]}" -r "$ROOT/backend/requirements.txt"
fi

if [ "$NO_FRONTEND" = false ]; then
  echo "Installing frontend dependencies..."
  npm install --prefix "$ROOT/frontend"
  echo "Building frontend for Flask..."
  npm run build --prefix "$ROOT/frontend"
fi

if [ "$NO_BACKEND" = false ]; then
  echo "Starting backend (Flask) at http://localhost:5000..."
  (cd "$ROOT/backend" && "$PYTHON" app.py) &
  PIDS+=("$!")
fi

if [ "$NO_FRONTEND" = false ]; then
  echo "Starting frontend (Vite dev; check its output for the selected port)..."
  npm run dev --prefix "$ROOT/frontend" -- --host 0.0.0.0 &
  PIDS+=("$!")
fi

if [ "${#PIDS[@]}" -eq 0 ]; then
  echo "Nothing to start."
  exit 0
fi

wait

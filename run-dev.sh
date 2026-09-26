#!/usr/bin/env bash
# run-dev.sh — start backend and frontend dev servers concurrently
# Usage: ./run-dev.sh [no-frontend] [no-backend]
set -euo pipefail
ROOT=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT"

NO_FRONTEND=false
NO_BACKEND=false
for a in "$@"; do
  case "$a" in
    no-frontend) NO_FRONTEND=true ;; 
    no-backend) NO_BACKEND=true ;; 
  esac
done

if [ "$NO_BACKEND" = false ]; then
  echo "Starting backend (Flask)..."
  (cd backend && python3 app.py) &
  sleep 0.5
fi

if [ "$NO_FRONTEND" = false ]; then
  echo "Starting frontend (Vite dev)..."
  (cd frontend && npm run dev) &
fi

echo "Dev servers started. Frontend: http://localhost:5173  Backend: http://localhost:5000"
wait

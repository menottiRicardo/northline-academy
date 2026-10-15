#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -x backend/.venv/bin/uvicorn ]]; then
  echo "Setup required: run npm run setup or npm install from the repository root first." >&2
  exit 1
fi

set -m
pids=()

cleanup() {
  local pid
  for pid in "${pids[@]}"; do
    kill -- "-${pid}" 2>/dev/null || kill "${pid}" 2>/dev/null || true
  done
}

trap cleanup EXIT INT TERM

backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8741 --app-dir backend &
pids+=("$!")

npm run dev --prefix frontend &
pids+=("$!")

wait -n

#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
node --check "$ROOT/scripts/demo-kit.mjs"
node --check "$ROOT/scripts/adapters/generic.mjs"
node --check "$ROOT/scripts/examples/template.mjs"
node --check "$ROOT/scripts/examples/sample.mjs"
node --check "$ROOT/scripts/examples/before-after.mjs"
node --check "$ROOT/tests/login-cleanup.mjs"
node --check "$ROOT/tests/login-modes.mjs"
node --check "$ROOT/tests/network.mjs"
node --check "$ROOT/tests/lifecycle.mjs"
bash -n "$ROOT/scripts/install.sh"

node "$ROOT/examples/sample-app.mjs" &
APP_PID=$!
trap 'kill "$APP_PID" 2>/dev/null || true' EXIT

READY=0
for _ in {1..30}; do
  if curl -fsS http://127.0.0.1:18474/ >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.2
done
if [ "$READY" != "1" ]; then
  echo "샘플 서비스가 시작되지 않았습니다." >&2
  exit 1
fi

DEMO_DIR="$(bash "$ROOT/scripts/install.sh")"
DRY=1 PACE=0 node "$DEMO_DIR/sample.mjs"
DEMO_DIR="$DEMO_DIR" DRY=1 PACE=0 node "$ROOT/tests/login-cleanup.mjs"
DEMO_DIR="$DEMO_DIR" node "$ROOT/tests/login-modes.mjs"
for mode in missing http ws; do
  DEMO_DIR="$DEMO_DIR" DRY=1 PACE=0 node "$ROOT/tests/network.mjs" "$mode"
done
if DEMO_URL=https://outside.invalid DRY=1 PACE=0 node "$DEMO_DIR/template.mjs" >/dev/null 2>&1; then
  echo "원격 DEMO_URL이 거부되지 않았습니다." >&2
  exit 1
fi
echo "스모크 검사 통과"

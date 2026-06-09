#!/usr/bin/env bash
set -e

# ─── START Xvfb ─────────────────────────────────────────────
# puppeteer-real-browser launches Chrome in headful mode, which
# needs an X display. Xvfb provides a virtual one inside Docker.

export DISPLAY="${DISPLAY:-:99}"
SCREEN="${XVFB_SCREEN:-1280x1024x24}"

echo "[entrypoint] Starting Xvfb on $DISPLAY (screen $SCREEN)..."
Xvfb "$DISPLAY" -screen 0 "$SCREEN" -ac -nolisten tcp &
XVFB_PID=$!

# Wait for Xvfb to be ready before launching the app.
# The lock file /tmp/.X<n>-lock appears once the display is up
# (avoids depending on xdpyinfo / x11-utils being installed).
LOCK="/tmp/.X${DISPLAY#:}-lock"
for i in $(seq 1 20); do
  if [ -f "$LOCK" ]; then
    echo "[entrypoint] Xvfb is ready."
    break
  fi
  echo "[entrypoint] Waiting for Xvfb... ($i)"
  sleep 0.5
done

# Forward termination signals to children for a clean shutdown
shutdown() {
  echo "[entrypoint] Shutting down..."
  kill -TERM "$APP_PID" 2>/dev/null || true
  kill -TERM "$XVFB_PID" 2>/dev/null || true
  wait "$APP_PID" 2>/dev/null || true
}
trap shutdown SIGTERM SIGINT

# ─── RUN THE SERVER ─────────────────────────────────────────
echo "[entrypoint] Launching: $*"
"$@" &
APP_PID=$!
wait "$APP_PID"

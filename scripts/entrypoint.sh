#!/bin/bash

# Exit on error
set -e

# Start X virtual framebuffer in the background
echo "Starting Xvfb on :99..."
Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp &
export DISPLAY=:99

# Wait a moment for Xvfb to start
sleep 1

# Start x11vnc without password (bound to localhost ONLY or allow remote depending on security needs, -nopw means NO PASSWORD)
echo "Starting x11vnc..."
x11vnc -display :99 -nopw -forever -rfbport 5900 -bg

# Start noVNC web proxy (maps 6080 to localhost:5900)
# We use the generic wrapper /usr/share/novnc/utils/launch.sh or /usr/share/novnc/utils/novnc_proxy
# In debian repo it's usually /usr/share/novnc/utils/launch.sh or novnc_proxy
echo "Starting noVNC proxy on port 6080..."
if [ -f "/usr/share/novnc/utils/launch.sh" ]; then
  /usr/share/novnc/utils/launch.sh --listen 6080 --vnc localhost:5900 &
elif [ -f "/usr/share/novnc/utils/novnc_proxy" ]; then
  /usr/share/novnc/utils/novnc_proxy --listen 6080 --vnc localhost:5900 &
else
  # Fallback for some OS distributions:
  websockify --web /usr/share/novnc 6080 localhost:5900 &
fi

# Finally run the application passed via CMD
echo "Starting application..."
exec "$@"

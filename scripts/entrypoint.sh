#!/bin/bash

# Exit on error
set -e

# Start X virtual framebuffer in the background
echo "Starting Xvfb on :99..."
Xvfb :99 -screen 0 1920x1080x24 -ac -nolisten tcp &
export DISPLAY=:99

# Start fluxbox window manager so browser renders correctly and we have a desktop
echo "Starting Fluxbox..."
fluxbox -display :99 &

# Wait for Xvfb and fluxbox to fully start
sleep 2

# Start x11vnc without password (bound to localhost ONLY or allow remote depending on security needs, -nopw means NO PASSWORD)
echo "Starting x11vnc..."
x11vnc -display :99 -nopw -forever -shared -rfbport 5900 -bg

# Wait for x11vnc to be ready
sleep 1

# Start noVNC/websockify proxy (maps 6080 → localhost:5900)
# Using GitHub release of noVNC + websockify installed in /opt/noVNC
echo "Starting noVNC proxy on port 6080..."
/opt/noVNC/utils/novnc_proxy --listen 6080 --vnc localhost:5900 &

echo "VNC ready: http://localhost:6080/vnc.html?autoconnect=true&resize=scale"

# Finally run the application passed via CMD
echo "Starting application..."
exec "$@"

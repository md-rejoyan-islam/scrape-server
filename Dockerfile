# ── Stage 1: Install dependencies ────────────────────────────
FROM node:22-slim AS base
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── Stage 2: Build TypeScript ───────────────────────────────
FROM base AS builder
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

# ── Stage 3: Install Playwright browsers ─────────────────────
FROM base AS playwright
RUN pnpm exec playwright install --with-deps chromium chrome

# ── Stage 4: Production image ────────────────────────────────
FROM node:22-slim AS production
WORKDIR /app

# Install Google Chrome stable + system dependencies
RUN apt-get update \
   && apt-get install -y --no-install-recommends \
   wget gnupg ca-certificates \
   && wget -qO- https://dl.google.com/linux/linux_signing_key.pub \
   | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg \
   && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] \
   http://dl.google.com/linux/chrome/deb/ stable main" \
   > /etc/apt/sources.list.d/google-chrome.list \
   && apt-get update \
   && apt-get install -y --no-install-recommends \
   google-chrome-stable \
   libnss3 \
   libatk-bridge2.0-0 \
   libdrm2 \
   libxcomposite1 \
   libxdamage1 \
   libxrandr2 \
   libgbm1 \
   libasound2 \
   libpangocairo-1.0-0 \
   libgtk-3-0 \
   libxshmfence1 \
   libx11-xcb1 \
   fonts-freefont-ttf \
   curl \
   xvfb \
   x11vnc \
   fluxbox \
   python3-numpy \
   && rm -rf /var/lib/apt/lists/*

# Install noVNC v1.5.0 + websockify from GitHub (Debian package has broken RFB handshake)
RUN wget -qO /tmp/novnc.tar.gz https://github.com/novnc/noVNC/archive/refs/tags/v1.5.0.tar.gz \
   && mkdir -p /opt/noVNC \
   && tar xzf /tmp/novnc.tar.gz --strip-components=1 -C /opt/noVNC \
   && wget -qO /tmp/websockify.tar.gz https://github.com/novnc/websockify/archive/refs/tags/v0.12.0.tar.gz \
   && mkdir -p /opt/noVNC/utils/websockify \
   && tar xzf /tmp/websockify.tar.gz --strip-components=1 -C /opt/noVNC/utils/websockify \
   && rm -f /tmp/novnc.tar.gz /tmp/websockify.tar.gz \
   && ln -sf /opt/noVNC/vnc.html /opt/noVNC/index.html

# Copy node_modules and Playwright browsers from build stages
COPY --from=base /app/node_modules ./node_modules
COPY --from=playwright /root/.cache/ms-playwright /root/.cache/ms-playwright

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# Copy application assets
COPY package.json ./
COPY public ./public
COPY docs ./docs

# Expose ports (3000 for app, 6080 for noVNC)
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000
EXPOSE 6080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
   CMD curl -f http://localhost:3000/api/health || exit 1

# Run compiled JS directly with Node using entrypoint script
COPY scripts/entrypoint.sh /app/scripts/entrypoint.sh
RUN chmod +x /app/scripts/entrypoint.sh

ENTRYPOINT ["/app/scripts/entrypoint.sh"]
CMD ["node", "dist/server.js"]

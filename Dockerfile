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
RUN pnpm exec playwright install --with-deps chromium

# ── Stage 4: Production image ────────────────────────────────
FROM node:22-slim AS production
WORKDIR /app

# Install system dependencies for Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
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
    && rm -rf /var/lib/apt/lists/*

# Copy node_modules and Playwright browsers from build stages
COPY --from=base /app/node_modules ./node_modules
COPY --from=playwright /root/.cache/ms-playwright /root/.cache/ms-playwright

# Copy compiled JS from builder
COPY --from=builder /app/dist ./dist

# Copy application assets
COPY package.json ./
COPY public ./public
COPY docs ./docs

# Expose port
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Run compiled JS directly with Node
CMD ["node", "dist/server.js"]

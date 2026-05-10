FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to install xvfb, xauth, and bun
USER root
RUN apt-get update && apt-get install -y xvfb xauth curl unzip --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL="/root/.bun"
ENV PATH="${BUN_INSTALL}/bin:${PATH}"

# Set working directory
WORKDIR /usr/src/app

# Copy package and install dependencies
COPY package.json bun.lock* ./
RUN bun install

# Copy application files
COPY . .

# Build the TypeScript files
RUN bun run build

# Make the entrypoint script executable (also normalises Windows line endings)
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

# Expose API port
EXPOSE 8090

# Start Xvfb in the entrypoint, then run the server (puppeteer-real-browser needs DISPLAY)
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["bun", "run", "start"]

FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to install xvfb and xauth
USER root
RUN apt-get update && apt-get install -y xvfb xauth --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /usr/src/app

# Copy package and install dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY . .

# Expose API port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]

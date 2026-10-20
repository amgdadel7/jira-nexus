# -------------------------------------------------------------
# Stage 1: Build Frontend (React / Vite)
# -------------------------------------------------------------
FROM node:20-slim AS web-builder
WORKDIR /web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# -------------------------------------------------------------
# Stage 2: Production Container (Masar Unified Node.js Backend)
# -------------------------------------------------------------
FROM node:20-slim
WORKDIR /app

# Install native build tools for sqlite3 / pglite bindings
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install API dependencies
COPY api/package*.json ./
RUN npm install --production=false

# Copy API backend source
COPY api/ ./

# Copy compiled frontend distribution to serve from Express
COPY --from=web-builder /web/dist /web/dist

# Default ports and production environment
EXPOSE 8080
ENV PORT=8080
ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=256 --expose-gc"

CMD ["npm", "start"]

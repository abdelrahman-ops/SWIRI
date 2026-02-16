# ── Stage 1: Install dependencies ────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Stage 2: Production image ───────────────────
FROM node:20-alpine
WORKDIR /app

# Non-root user for security
RUN addgroup -S swiri && adduser -S swiri -G swiri

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Cloud Run injects PORT env var (default 8080)
ENV NODE_ENV=production
ENV PORT=8080

USER swiri
EXPOSE 8080

CMD ["node", "src/server.js"]

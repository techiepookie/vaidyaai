# ──────────────────────────────────────────────────────────────────
# VaidyaAI Backend — Docker image
# Multi-stage build for smallest possible production footprint
# ──────────────────────────────────────────────────────────────────

# ── Stage 1: install production dependencies ───────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only the manifests first to leverage Docker layer cache
COPY package.json package-lock.json* ./

# Install production deps only (no devDependencies, no optional)
RUN npm ci --omit=dev --omit=optional

# ── Stage 2: final runtime image ───────────────────────────────────
FROM node:20-alpine AS runner

# Security: run as non-root user
RUN addgroup --system --gid 1001 vaidyaai \
 && adduser  --system --uid 1001 vaidyaai

WORKDIR /app

# Copy installed modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY app.js server.js ./
COPY middleware/ ./middleware/
COPY routes/     ./routes/

# Change ownership to non-root user
RUN chown -R vaidyaai:vaidyaai /app
USER vaidyaai

# Cloud Run injects PORT automatically
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Health check — Cloud Run uses this before marking the revision healthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "server.js"]

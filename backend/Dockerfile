# ──────────────────────────────────────────────────────────────────
# VaidyaAI — Full-stack Docker image
# Serves BOTH the Node.js API and the static frontend from one URL.
# Build context must be the REPO ROOT (not backend/):
#   docker build -f backend/Dockerfile -t vaidyaai .
# ──────────────────────────────────────────────────────────────────

# ── Stage 1: install production dependencies ───────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY backend/package.json ./

RUN npm install --omit=dev --omit=optional

# ── Stage 2: final runtime image ───────────────────────────────────
FROM node:20-alpine AS runner

RUN addgroup --system --gid 1001 vaidyaai \
 && adduser  --system --uid 1001 vaidyaai

WORKDIR /app

# Copy installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy backend source files
COPY backend/app.js    ./app.js
COPY backend/server.js ./server.js
COPY backend/middleware/ ./middleware/
COPY backend/routes/     ./routes/

# Copy frontend into public/ — Express serves this statically
COPY landing.html  ./public/landing.html
COPY index.html    ./public/index.html
COPY patient.html  ./public/patient.html
COPY doctor.html   ./public/doctor.html
COPY css/          ./public/css/
COPY js/           ./public/js/

RUN chown -R vaidyaai:vaidyaai /app
USER vaidyaai

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "server.js"]

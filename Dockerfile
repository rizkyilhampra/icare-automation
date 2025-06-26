# =============================================================================
# BASE STAGE
# =============================================================================
FROM node:22-alpine AS base
ARG PORT=3000
ENV PORT=$PORT
ENV TZ=Asia/Makassar
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apk add --no-cache curl && \
    corepack enable pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# =============================================================================
# BUILDER STAGE
# =============================================================================
FROM base AS builder
COPY . .
RUN pnpm run build

# =============================================================================
# PRODUCTION STAGE
# =============================================================================
FROM node:22-bookworm-slim AS production
ARG PORT=3000
ENV NODE_ENV=production
ENV PORT=$PORT
ENV TZ=Asia/Makassar
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean \
    && corepack enable pnpm

WORKDIR /app
RUN mkdir -p /app/data /app/logs

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-prod,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile \
    && pnpm store prune

RUN npx -y playwright install --with-deps chromium

COPY --from=builder /app/dist ./dist
COPY public ./public

EXPOSE $PORT

CMD ["node", "dist/index.js"]

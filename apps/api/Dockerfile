# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.32.0 --activate

WORKDIR /workspace

FROM base AS production-dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts --filter @droproom/api...

FROM node:24-alpine AS runner

ENV NODE_ENV=production
ENV DROPROOM_API_PORT=43117

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /workspace ./
COPY --chown=node:node tsconfig.base.json ./tsconfig.base.json
COPY --chown=node:node apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY --chown=node:node apps/api/src ./apps/api/src
RUN mkdir -p /app/storage && chown node:node /app/storage

WORKDIR /app/apps/api

USER node

EXPOSE 43117

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:43117/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["./node_modules/.bin/tsx", "src/index.ts"]

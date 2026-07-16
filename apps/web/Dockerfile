# syntax=docker/dockerfile:1.7

FROM node:24-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.32.0 --activate

WORKDIR /workspace

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --filter @droproom/web...

FROM dependencies AS build

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY tsconfig.json tsconfig.base.json ./
COPY apps/api apps/api
COPY apps/web apps/web

RUN pnpm --filter @droproom/web build

FROM nginx:1.29-alpine AS runner

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1

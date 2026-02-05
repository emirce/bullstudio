FROM node:24-alpine AS base
RUN apk update
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable pnpm
WORKDIR /app

# BUILDER STAGE
FROM base AS builder
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter bullstudio build

# RUNNER STAGE
FROM base AS runner
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 bullstudio
USER bullstudio

ENV NODE_ENV=production
ENV HOST=0.0.0.0

COPY --from=builder --chown=bullstudio:nodejs /app/apps/cli/dist/ ./apps/cli/dist/

ARG PORT=4000

EXPOSE ${PORT}
ENV PORT=${PORT}

CMD ["node", "./apps/cli/dist/server/production.js"]

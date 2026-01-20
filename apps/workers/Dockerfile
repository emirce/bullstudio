# Base image with Node.js
FROM node:20-alpine AS base

# Builder stage - prune worker workspace
FROM base AS builder
WORKDIR /app
RUN npm install -g turbo
COPY . .
RUN turbo prune workers --docker --out-dir=out/workers

# Installer stage
FROM base AS installer
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

# Copy package.json files from worker pruned workspace
COPY --from=builder /app/out/workers/json/ .

# Copy lockfile
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy full source from worker pruned workspace
COPY --from=builder /app/out/workers/full/ .

# Generate Prisma client
RUN pnpm --filter @bullstudio/prisma prisma generate

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

# Copy necessary files from installer
COPY --from=installer /app ./

# Set the worker directory as working directory
WORKDIR /app/apps/workers
ENV NODE_ENV=production

CMD ["pnpm", "start"]

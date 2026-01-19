# Install
pnpm install --frozen-lockfile
# Prisma
pnpm prisma:deploy -F @bullstudio/prisma
pnpm prisma:generate -F @bullstudio/prisma

# Build
pnpm build -F web

# @bullstudio/nestjs

## 2.5.2

### Patch Changes

- @bullstudio/express@2.5.2
- @bullstudio/fastify@2.5.2

## 2.5.1

### Patch Changes

- 1fbc680: Refresh runtime, build, and development dependencies across the workspace, migrate documentation search to Fumadocs' current static client, and patch vulnerable transitive dependencies.
- Updated dependencies [1fbc680]
  - @bullstudio/fastify@2.5.1
  - @bullstudio/express@2.5.1

## 2.5.0

### Patch Changes

- @bullstudio/express@2.5.0
- @bullstudio/fastify@2.5.0

## 2.4.0

### Patch Changes

- @bullstudio/express@2.4.0
- @bullstudio/fastify@2.4.0

## 2.3.1

### Patch Changes

- @bullstudio/express@2.3.1
- @bullstudio/fastify@2.3.1

## 2.3.0

### Minor Changes

- 0765b1e: Add queue filtering by name and prefix to the dashboard overview and sidebar.

  Also harden transitive dependency versions for known security advisories and move CLI asset copying into a Node script so the build works consistently across shells.

### Patch Changes

- Updated dependencies [0765b1e]
  - @bullstudio/express@2.3.0
  - @bullstudio/fastify@2.3.0

## 2.2.0

### Patch Changes

- @bullstudio/express@2.2.0
- @bullstudio/fastify@2.2.0

## 2.1.0

### Patch Changes

- @bullstudio/express@2.1.0
- @bullstudio/fastify@2.1.0

## 2.0.1

### Patch Changes

- @bullstudio/express@2.0.1
- @bullstudio/fastify@2.0.1

## 2.0.0

### Major Changes

- Initial release of Bullstudio embedded mode.

  Mount Bullstudio inside your own application with a framework adapter — `@bullstudio/express`, `@bullstudio/fastify`, `@bullstudio/hono`, `@bullstudio/next`, or `@bullstudio/nestjs` — supply your Bull or BullMQ queues via `@bullstudio/bullmq-adapter` or `@bullstudio/bull-adapter`, and the dashboard exposes only those queues with server-side capability enforcement. `@bullstudio/embedded-core` provides the framework-neutral runtime and `@bullstudio/connect-types` the shared adapter contracts.

  These packages are versioned at 2.0.0 to align with the unified Bullstudio release line.

### Patch Changes

- Updated dependencies
  - @bullstudio/express@2.0.0
  - @bullstudio/fastify@2.0.0

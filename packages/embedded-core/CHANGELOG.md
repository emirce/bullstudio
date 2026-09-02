# @bullstudio/embedded-core

## 2.5.2

### Patch Changes

- @bullstudio/connect-types@2.5.2

## 2.5.1

### Patch Changes

- @bullstudio/connect-types@2.5.1

## 2.5.0

### Patch Changes

- @bullstudio/connect-types@2.5.0

## 2.4.0

### Patch Changes

- @bullstudio/connect-types@2.4.0

## 2.3.1

### Patch Changes

- @bullstudio/connect-types@2.3.1

## 2.3.0

### Minor Changes

- 0765b1e: Add queue filtering by name and prefix to the dashboard overview and sidebar.

  Also harden transitive dependency versions for known security advisories and move CLI asset copying into a Node script so the build works consistently across shells.

### Patch Changes

- Updated dependencies [0765b1e]
  - @bullstudio/connect-types@2.3.0

## 2.2.0

### Patch Changes

- @bullstudio/connect-types@2.2.0

## 2.1.0

### Minor Changes

- Add queue dashboard job management and fix Redis prefix handling
  - Add jobs directly from the queue dashboard
  - Retry all failed jobs in a queue at once
  - Support Redis prefixes that contain colons
  - Split the private router barrel into per-domain routers (connection, flows, jobs, overview, queues, schedulers, workers)

### Patch Changes

- @bullstudio/connect-types@2.1.0

## 2.0.1

### Patch Changes

- @bullstudio/connect-types@2.0.1

## 2.0.0

### Major Changes

- Initial release of Bullstudio embedded mode.

  Mount Bullstudio inside your own application with a framework adapter — `@bullstudio/express`, `@bullstudio/fastify`, `@bullstudio/hono`, `@bullstudio/next`, or `@bullstudio/nestjs` — supply your Bull or BullMQ queues via `@bullstudio/bullmq-adapter` or `@bullstudio/bull-adapter`, and the dashboard exposes only those queues with server-side capability enforcement. `@bullstudio/embedded-core` provides the framework-neutral runtime and `@bullstudio/connect-types` the shared adapter contracts.

  These packages are versioned at 2.0.0 to align with the unified Bullstudio release line.

### Patch Changes

- Updated dependencies
  - @bullstudio/connect-types@2.0.0

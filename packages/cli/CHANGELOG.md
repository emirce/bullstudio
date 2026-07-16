# bullstudio

## 2.4.0

### Minor Changes

- 185ab50: Standalone mode now supports Redis Cluster. Cluster mode is detected automatically from the target Redis (`INFO cluster`), the connection is established with a cluster client seeded from `REDIS_URL`, and prefix/queue discovery SCANs fan out across every master node — each node only returns keys for its own slots, so hash-tag prefixes like `{myapp}` are now discovered across the whole keyspace. Fixes the empty dashboard when pointing Bullstudio at a Redis Cluster (#8).

## 2.3.1

### Patch Changes

- c305b8c: Fix standalone tRPC streaming batch responses behind nginx by removing stale transfer framing after buffering the response body.

## 2.3.0

### Minor Changes

- 0765b1e: Add queue filtering by name and prefix to the dashboard overview and sidebar.

  Also harden transitive dependency versions for known security advisories and move CLI asset copying into a Node script so the build works consistently across shells.

## 2.2.0

### Minor Changes

- c06b555: Add a global dashboard overview page that aggregates job state, throughput, and the slowest jobs across every configured queue, with per-queue status cards.

  To support this across varied Redis deployments, `REDIS_PREFIX` now also accepts a `*` wildcard for full auto-discovery and glob patterns (e.g. `local:{*}`) that resolve to the concrete prefixes present in Redis, including Redis Cluster hash-tag and multi-segment tenant prefixes. Discovered prefixes are re-evaluated on every Redis connect/reconnect so the dashboard picks up new queues without a restart.

### Patch Changes

- c06b555: Fix dashboard UI fallout from recent dependency upgrades:
  - Inline the two sidebar brand icons that lucide-react 1.x dropped
  - Update the chart tooltip/legend prop types for recharts v3's reworked `Tooltip`/`Legend` shapes

- c06b555: Fix the queue page so its content can scroll horizontally. The page-level scroll area only mounted a vertical scrollbar, which locked `overflow-x` to hidden and could clip the expanded job detail view on narrower screens.

## 2.1.0

## 2.0.1

### Patch Changes

- ef18129: Fix the dashboard sidebar so the queue list scrolls internally instead of the whole page. The sidebar is now pinned to the viewport height, so it fills the height when there are few queues (footer stays at the bottom) and keeps the header/footer fixed while the queue list scrolls when there are many.

## 2.0.0

### Major Changes

- Bullstudio 2.0 introduces embedded mode alongside the existing standalone dashboard, and moves every published Bullstudio package onto a single, lockstep version.

  The standalone dashboard adds scheduler management for repeatable/scheduled jobs, a worker overview screen, flow tree and delay details in job detail, native queue metrics (throughput rendered as a line plot), prefix-qualified queue routing with per-prefix navigation (plus queue items and a drain action in the sidebar), configurable polling via operator config and a settings dialog, optional session-based authentication (`--username` / `--password`, `BULLSTUDIO_USERNAME`), and more graceful handling of Redis connection losses.

  The `npx bullstudio` standalone workflow is unchanged.

## 1.5.0

### Minor Changes

- b37f179: Streamline CLI npm publishing and Docker image publishing through the shared release workflow.

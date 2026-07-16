---
"bullstudio": minor
---

Standalone mode now supports Redis Cluster. Cluster mode is detected automatically from the target Redis (`INFO cluster`), the connection is established with a cluster client seeded from `REDIS_URL`, and prefix/queue discovery SCANs fan out across every master node — each node only returns keys for its own slots, so hash-tag prefixes like `{myapp}` are now discovered across the whole keyspace. Fixes the empty dashboard when pointing Bullstudio at a Redis Cluster (#8).

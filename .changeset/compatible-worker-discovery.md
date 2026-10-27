---
"@bullstudio/bullmq-adapter": patch
"bullstudio": patch
---

Discover BullMQ workers registered with plain queue names, including Python BullMQ workers, so worker listings and job retries work across implementations. Preserve worker discovery on Redis Cluster nodes that require `CLIENT LIST` through the generic client command.

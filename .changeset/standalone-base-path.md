---
"bullstudio": minor
---

Standalone mode can now serve the dashboard under a path prefix via `BULLSTUDIO_BASE_PATH` (or `--base-path`), for deployments behind path-routing proxies where subdomains are not available (e.g. `example.com/queues`). The UI, assets, login flow, and private dashboard API all mount under the prefix, HTML/CSS asset URLs are rewritten the same way embedded mode does it, and `/health` / `/healthz` remain at the root for container probes (and are also served under the prefix). Root serving is unchanged when no base path is configured.

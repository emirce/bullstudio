---
"bullstudio": patch
---

Fix standalone tRPC streaming batch responses behind nginx by removing stale transfer framing after buffering the response body.

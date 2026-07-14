import { mkdir, writeFile } from "node:fs/promises";
import { once } from "node:events";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("./connection");
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("standalone dashboard parity", () => {
  it("serves buffered streaming tRPC batches with valid HTTP framing", async () => {
    vi.doMock("./connection", () => ({
      disconnectProvider: async () => {},
      getQueueProvider: async () => ({
        getCapabilities: () => ({
          providerType: "bullmq",
          supportsFlows: true,
          supportedJobStates: [],
        }),
        getPrefixes: async () => ["bull"],
        getQueues: async () => [],
        isConnected: () => true,
      }),
    }));

    const { createStandaloneApp } = await import("../server/standalone");
    const app = createStandaloneApp({
      clientDir: tmpdir(),
      env: {},
    });
    const server = serve({
      fetch: app.fetch,
      hostname: "127.0.0.1",
      port: 0,
    });

    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Expected the standalone test server to use a TCP port.");
    }

    try {
      const responseHeaders = await new Promise<string>((resolve, reject) => {
        const socket = createConnection({
          host: "127.0.0.1",
          port: address.port,
        });
        let response = "";

        socket.setEncoding("utf8");
        socket.on("connect", () => {
          socket.write(
            "GET /api/trpc/connection.info,queues.list?batch=1 HTTP/1.1\r\n" +
              `Host: 127.0.0.1:${address.port.toString()}\r\n` +
              "trpc-accept: application/jsonl\r\n" +
              "Connection: close\r\n\r\n",
          );
        });
        socket.on("data", (chunk) => {
          response += chunk;
          const headersEnd = response.indexOf("\r\n\r\n");

          if (headersEnd !== -1) {
            socket.destroy();
            resolve(response.slice(0, headersEnd));
          }
        });
        socket.on("error", reject);
      });
      const normalizedHeaders = responseHeaders.toLowerCase();

      expect(responseHeaders).toMatch(/^HTTP\/1\.1 200/);
      expect(
        normalizedHeaders.includes("\r\ncontent-length:") &&
          normalizedHeaders.includes("\r\ntransfer-encoding:"),
      ).toBe(false);
    } finally {
      server.close();
      await once(server, "close");
    }
  });

  it("serves root assets, health checks, private API, and production session auth behavior", async () => {
    const { createStandaloneApp } = await import("../server/standalone");
    const clientDir = join(
      tmpdir(),
      "bullstudio",
      `standalone-${Date.now().toString()}`,
    );
    await mkdir(join(clientDir, "assets"), { recursive: true });
    await writeFile(join(clientDir, "index.html"), "<html>Bullstudio</html>");
    await writeFile(join(clientDir, "assets", "app.js"), "console.log('app')");

    const app = createStandaloneApp({
      clientDir,
      env: {
        BULLSTUDIO_PASSWORD: "secret",
        BULLSTUDIO_USERNAME: "operator",
        REDIS_URL: "redis://localhost:6379",
      },
      trpcHandler: async () =>
        new Response(JSON.stringify({ result: { data: "ok" } }), {
          headers: {
            "Content-Type": "application/json",
          },
        }),
    });

    const health = await app.request("/health");
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({
      status: "ok",
      redis: "configured",
    });

    const unauthorizedAsset = await app.request("/");
    expect(unauthorizedAsset.status).toBe(302);
    expect(unauthorizedAsset.headers.get("location")).toBe("/login");

    const loginScreen = await app.request("/login");
    expect(loginScreen.status).toBe(200);

    const invalidLogin = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "operator", password: "wrong" }),
    });
    expect(invalidLogin.status).toBe(401);

    const login = await app.request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username: "operator", password: "secret" }),
    });
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie");
    expect(cookie).toContain("bullstudio_session=");

    const session = await app.request("/api/auth/session", {
      headers: {
        Cookie: cookie ?? "",
      },
    });
    await expect(session.json()).resolves.toMatchObject({
      authEnabled: true,
      authenticated: true,
      username: "operator",
    });

    const authorizedAsset = await app.request("/", {
      headers: {
        Cookie: cookie ?? "",
      },
    });
    expect(authorizedAsset.status).toBe(200);
    expect(authorizedAsset.headers.get("content-type")).toContain("text/html");
    await expect(authorizedAsset.text()).resolves.toContain("Bullstudio");

    const authorizedStaticAsset = await app.request("/assets/app.js", {
      headers: {
        Cookie: cookie ?? "",
      },
    });
    expect(authorizedStaticAsset.status).toBe(200);
    expect(authorizedStaticAsset.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );

    const unauthorizedApi = await app.request("/api/trpc/queues.list");
    expect(unauthorizedApi.status).toBe(401);

    const authorizedApi = await app.request("/api/trpc/queues.list", {
      headers: {
        Cookie: cookie ?? "",
      },
    });
    expect(authorizedApi.status).toBe(200);
    await expect(authorizedApi.json()).resolves.toEqual({
      result: {
        data: "ok",
      },
    });
  });

  it("keeps private tRPC queue access backed by Redis-discovered queues", async () => {
    vi.doMock("./connection", () => ({
      disconnectProvider: async () => {},
      getQueueProvider: async () => ({
        getCapabilities: () => ({
          providerType: "bullmq",
          displayName: "BullMQ",
          supportsFlows: true,
          supportedJobStates: [
            "waiting",
            "active",
            "completed",
            "failed",
            "delayed",
            "paused",
            "waiting-children",
          ],
        }),
        getQueues: async () => [
          {
            name: "email",
            prefix: "bull",
            isPaused: false,
            jobCounts: {
              active: 0,
              completed: 0,
              delayed: 0,
              failed: 0,
              paused: 0,
              prioritized: 0,
              waiting: 1,
              waitingChildren: 0,
            },
          },
        ],
      }),
    }));

    const { createStandaloneApp } = await import("../server/standalone");
    const clientDir = join(
      tmpdir(),
      "bullstudio",
      `standalone-${Date.now().toString()}`,
    );
    await mkdir(clientDir, { recursive: true });
    await writeFile(join(clientDir, "index.html"), "<html>Bullstudio</html>");

    const app = createStandaloneApp({
      clientDir,
      env: {},
    });

    const response = await app.request("/api/trpc/queues.list");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: {
        data: {
          json: [
            {
              name: "email",
              prefix: "bull",
            },
          ],
        },
      },
    });
  });

  it("injects polling config from env vars into served HTML", async () => {
    const { createStandaloneApp } = await import("../server/standalone");
    const clientDir = join(
      tmpdir(),
      "bullstudio",
      `standalone-${Date.now().toString()}-poll`,
    );
    await mkdir(clientDir, { recursive: true });
    await writeFile(
      join(clientDir, "index.html"),
      "<html><head></head><body>Bullstudio</body></html>",
    );

    const app = createStandaloneApp({
      clientDir,
      env: {
        BULLSTUDIO_POLL_ENABLED: "false",
        BULLSTUDIO_POLL_INTERVAL: "5000",
      },
    });

    const response = await app.request("/");
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("window.__BULLSTUDIO__");
    expect(body).toContain('"polling":{"enabled":false,"interval":5000}');
  });

  it("does not inject runtime config when no polling env vars are set", async () => {
    const { createStandaloneApp } = await import("../server/standalone");
    const clientDir = join(
      tmpdir(),
      "bullstudio",
      `standalone-${Date.now().toString()}-nopoll`,
    );
    await mkdir(clientDir, { recursive: true });
    await writeFile(
      join(clientDir, "index.html"),
      "<html><head></head><body>Bullstudio</body></html>",
    );

    const app = createStandaloneApp({ clientDir, env: {} });

    const response = await app.request("/");
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.not.toContain(
      "window.__BULLSTUDIO__",
    );
  });

  it("reports standalone Redis connection information as a mode-aware queue source", async () => {
    vi.stubEnv("REDIS_URL", "redis://:secret@cache.internal:6380/2");
    vi.doMock("./connection", async (importOriginal) => {
      const actual = await importOriginal<typeof import("./connection")>();

      return {
        ...actual,
        getQueueProvider: async () => ({
          getCapabilities: () => ({
            providerType: "bullmq",
            displayName: "BullMQ",
            supportsFlows: true,
            supportedJobStates: [
              "waiting",
              "active",
              "completed",
              "failed",
              "delayed",
              "paused",
              "waiting-children",
            ],
          }),
          getPrefixes: async () => ["bull", "mail"],
          isConnected: () => true,
        }),
      };
    });

    const { createStandaloneApp } = await import("../server/standalone");
    const clientDir = join(
      tmpdir(),
      "bullstudio",
      `standalone-${Date.now().toString()}`,
    );
    await mkdir(clientDir, { recursive: true });
    await writeFile(join(clientDir, "index.html"), "<html>Bullstudio</html>");

    const app = createStandaloneApp({
      clientDir,
      env: {},
    });

    const response = await app.request("/api/trpc/connection.info");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      result: {
        data: {
          json: {
            mode: "standalone",
            displayUrl: "cache.internal:6380",
            providerType: "bullmq",
            prefixes: ["bull", "mail"],
            queueSource: {
              mode: "standalone",
              source: "redis",
              status: "healthy",
              connection: {
                host: "cache.internal",
                port: "6380",
                database: "2",
                hasPassword: true,
                displayUrl: "cache.internal:6380",
              },
              providers: ["bullmq"],
              prefixes: ["bull", "mail"],
              capabilities: {
                flows: true,
              },
            },
          },
        },
      },
    });
  });
});

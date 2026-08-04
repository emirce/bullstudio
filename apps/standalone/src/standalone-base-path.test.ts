import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.doUnmock("./connection");
  vi.unstubAllEnvs();
  vi.resetModules();
});

const INDEX_HTML =
  "<!doctype html><html><head>" +
  '<link rel="icon" href="/logo.svg">' +
  '<link rel="stylesheet" href="/assets/app.css">' +
  '<script src="/assets/app.js"></script>' +
  "</head><body></body></html>";

async function createClientDir(): Promise<string> {
  const clientDir = await mkdtemp(join(tmpdir(), "bullstudio-base-path-"));
  await mkdir(join(clientDir, "assets"), { recursive: true });
  await writeFile(join(clientDir, "index.html"), INDEX_HTML);
  await writeFile(join(clientDir, "assets", "app.js"), "console.log(1);");
  await writeFile(
    join(clientDir, "assets", "app.css"),
    "body{background:url(/assets/bg.png)}",
  );
  return clientDir;
}

async function createApp(env: NodeJS.ProcessEnv): Promise<Hono> {
  vi.doMock("./connection", () => ({
    disconnectProvider: async () => {},
    getQueueProvider: async () => ({
      cluster: false,
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
  return createStandaloneApp({ clientDir: await createClientDir(), env });
}

describe("standalone base path", () => {
  it("serves the dashboard at the base path with rewritten asset URLs", async () => {
    const app = await createApp({ BULLSTUDIO_BASE_PATH: "/queues" });

    const response = await app.request("/queues");
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('src="/queues/assets/app.js"');
    expect(html).toContain('href="/queues/assets/app.css"');
    expect(html).toContain('href="/queues/logo.svg"');
    expect(html).toContain('"basePath":"/queues"');
  });

  it("normalizes a base path without a leading slash or with a trailing slash", async () => {
    const app = await createApp({ BULLSTUDIO_BASE_PATH: "queues/" });

    const response = await app.request("/queues");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('"basePath":"/queues"');
  });

  it("serves static assets under the base path", async () => {
    const app = await createApp({ BULLSTUDIO_BASE_PATH: "/queues" });

    const response = await app.request("/queues/assets/app.js");
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("console.log(1);");
  });

  it("rewrites CSS url() references against the base path", async () => {
    const app = await createApp({ BULLSTUDIO_BASE_PATH: "/queues" });

    const response = await app.request("/queues/assets/app.css");
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("url(/queues/assets/bg.png)");
  });

  it("keeps health at the root for probes and serves it under the base path", async () => {
    const app = await createApp({ BULLSTUDIO_BASE_PATH: "/queues" });

    expect((await app.request("/health")).status).toBe(200);
    expect((await app.request("/queues/health")).status).toBe(200);
  });

  it("mounts the private dashboard API under the base path", async () => {
    const app = await createApp({ BULLSTUDIO_BASE_PATH: "/queues" });

    const response = await app.request(
      "/queues/api/trpc/connection.info,queues.list?batch=1",
      { headers: { "trpc-accept": "application/jsonl" } },
    );
    expect(response.status).toBe(200);
  });

  it("returns 404 outside the base path", async () => {
    const app = await createApp({ BULLSTUDIO_BASE_PATH: "/queues" });

    expect((await app.request("/")).status).toBe(404);
    expect((await app.request("/assets/app.js")).status).toBe(404);
  });

  it("keeps root serving unchanged when no base path is configured", async () => {
    const app = await createApp({});

    const response = await app.request("/");
    expect(response.status).toBe(200);

    const html = await response.text();
    expect(html).toContain('src="/assets/app.js"');
    expect(html).not.toContain("__BULLSTUDIO__");
  });
});

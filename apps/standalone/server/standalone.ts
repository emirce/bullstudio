import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, relative } from "node:path";
import {
  createStandaloneDashboard,
  type DashboardProtection,
  type FrameworkResponse,
  getAuthenticatedSession,
  type PollingConfig,
} from "@bullstudio/embedded-core";
import {
  createPrivateDashboardRouter,
  type PrivateDashboardContext,
} from "@bullstudio/private-router";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { Context } from "hono";
import { Hono } from "hono";
import { createStandaloneQueueSource } from "../src/standalone-source";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".wasm": "application/wasm",
};

export interface StandaloneAppOptions {
  clientDir: string;
  env?: NodeJS.ProcessEnv;
  trpcHandler?: (request: Request) => Promise<Response> | Response;
}

export function createStandaloneApp(options: StandaloneAppOptions): Hono {
  const env = options.env ?? process.env;
  const app = new Hono();
  const protection = getStandaloneProtection(env);
  const polling = getStandalonePolling(env);
  const trpcRouter = createPrivateDashboardRouter(
    createStandaloneQueueSource(),
  );
  const dashboard = createStandaloneDashboard({
    protection,
    handleDashboardAsset: (request) =>
      handleDashboardAsset(request, options.clientDir, polling),
    mountPrivateDashboardApi: () => ({
      handle: async (request) => {
        if (!getAuthenticatedSession(protection, request).authenticated) {
          return {
            status: 401,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
            },
            body: JSON.stringify({
              error: {
                message: "Authentication required.",
                code: -32001,
                data: { code: "UNAUTHORIZED", httpStatus: 401 },
              },
            }),
          };
        }

        return toFrameworkResponse(
          await (options.trpcHandler?.(toFetchRequest(request)) ??
            fetchRequestHandler({
              endpoint: "/api/trpc",
              req: toFetchRequest(request),
              router: trpcRouter,
              createContext: (): PrivateDashboardContext =>
                getAuthenticatedSession(protection, request),
            })),
        );
      },
    }),
  });
  const privateDashboardApi = dashboard.mountPrivateDashboardApi();

  app.get("/health", (c) => healthResponse(c, env));
  app.get("/healthz", (c) => healthResponse(c, env));

  app.all("/api/auth/*", async (c) =>
    toHonoResponse(
      await dashboard.handle({
        method: c.req.method,
        url: c.req.url,
        headers: c.req.raw.headers,
        body: await c.req.text(),
        basePath: "/",
      }),
    ),
  );

  app.all("/api/trpc/*", async (c) =>
    toHonoResponse(
      await privateDashboardApi.handle({
        method: c.req.method,
        url: c.req.url,
        headers: c.req.raw.headers,
        body: c.req.raw.body,
        basePath: "/",
      }),
    ),
  );

  app.on(["GET", "HEAD"], "*", async (c) =>
    toHonoResponse(
      await dashboard.handle({
        method: c.req.method,
        url: c.req.url,
        headers: c.req.raw.headers,
        basePath: "/",
      }),
    ),
  );

  app.notFound((c) => c.text("Not Found", 404));

  return app;
}

function getStandaloneProtection(
  env: StandaloneAppOptions["env"],
): DashboardProtection {
  if (!env?.BULLSTUDIO_PASSWORD) {
    return {
      type: "disabled",
    };
  }

  return {
    type: "session",
    username: env.BULLSTUDIO_USERNAME || "bullstudio",
    password: env.BULLSTUDIO_PASSWORD,
  };
}

// Standalone serves a pre-built `index.html` that has no operator config baked
// in, so polling defaults come from env vars and are injected at serve time
// (see injectRuntimeConfig). Unset vars are left undefined so the frontend
// falls back to its own defaults.
function getStandalonePolling(
  env: StandaloneAppOptions["env"],
): PollingConfig | undefined {
  const enabled = parseBooleanEnv(env?.BULLSTUDIO_POLL_ENABLED);
  const interval = parseNumberEnv(env?.BULLSTUDIO_POLL_INTERVAL);
  const minInterval = parseNumberEnv(env?.BULLSTUDIO_POLL_MIN_INTERVAL);
  const allowUserOverride = parseBooleanEnv(
    env?.BULLSTUDIO_POLL_ALLOW_OVERRIDE,
  );

  if (
    enabled === undefined &&
    interval === undefined &&
    minInterval === undefined &&
    allowUserOverride === undefined
  ) {
    return undefined;
  }

  return { enabled, interval, minInterval, allowUserOverride };
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  return value === "true" || value === "1";
}

function parseNumberEnv(value: string | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function healthResponse(c: Context, env: StandaloneAppOptions["env"]) {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    redis: env?.REDIS_URL ? "configured" : "not configured",
  });
}

async function handleDashboardAsset(
  request: { method: string; url: string },
  clientDir: string,
  polling: PollingConfig | undefined,
): Promise<FrameworkResponse> {
  const pathname = new URL(request.url).pathname;
  const staticFilePath = getStaticFilePath(pathname, clientDir);

  if (staticFilePath && existsSync(staticFilePath)) {
    const fileStat = await stat(staticFilePath);

    if (fileStat.isFile()) {
      const cacheControl = pathname.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600";

      return getFileResponse(
        request.method,
        staticFilePath,
        cacheControl,
        polling,
      );
    }
  }

  return getFileResponse(
    request.method,
    join(clientDir, "index.html"),
    "no-cache",
    polling,
  );
}

function getStaticFilePath(pathname: string, clientDir: string): string | null {
  let decodedPathname: string;

  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relativePath =
    decodedPathname === "/" ? "index.html" : decodedPathname.slice(1);
  const filePath = normalize(join(clientDir, relativePath));
  const relativeToClient = relative(clientDir, filePath);

  if (
    relativeToClient === "" ||
    relativeToClient.startsWith("..") ||
    relativeToClient.startsWith("/") ||
    relativeToClient.startsWith("\\")
  ) {
    return null;
  }

  return filePath;
}

async function getFileResponse(
  method: string,
  filePath: string,
  cacheControl: string,
  polling: PollingConfig | undefined,
): Promise<FrameworkResponse> {
  const ext = extname(filePath);
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  // HTML is the only asset that carries runtime config, so it's served as a
  // (possibly rewritten) string. Everything else is streamed as-is.
  if (ext === ".html") {
    const html = injectRuntimeConfig(await readFile(filePath, "utf8"), polling);
    const headers = {
      "Cache-Control": cacheControl,
      "Content-Length": Buffer.byteLength(html).toString(),
      "Content-Type": contentType,
    };

    return {
      status: 200,
      headers,
      body: method === "HEAD" ? undefined : html,
    };
  }

  const fileStat = await stat(filePath);
  const headers = {
    "Cache-Control": cacheControl,
    "Content-Length": fileStat.size.toString(),
    "Content-Type": contentType,
  };

  if (method === "HEAD") {
    return {
      status: 200,
      headers,
    };
  }

  return {
    status: 200,
    headers,
    body: new Uint8Array(await readFile(filePath)),
  };
}

// Merge env-derived polling config into `window.__BULLSTUDIO__` without
// clobbering anything the build may have set. Mirrors embedded-core's
// escapeScriptJson so the `<` escape keeps the inline script safe.
function injectRuntimeConfig(
  html: string,
  polling: PollingConfig | undefined,
): string {
  if (!polling) {
    return html;
  }

  const runtimeConfig = JSON.stringify({ polling }).replace(/</g, "\\u003c");
  const script = `<script>window.__BULLSTUDIO__=Object.assign({},window.__BULLSTUDIO__,${runtimeConfig});</script>`;

  if (html.includes("</head>")) {
    return html.replace("</head>", `${script}</head>`);
  }

  return `${script}${html}`;
}

function toFetchRequest(request: {
  body?: unknown;
  headers?: Headers | Record<string, string | string[] | undefined>;
  method: string;
  url: string;
}): Request {
  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : (request.body as BodyInit | null | undefined);

  return new Request(request.url, {
    method: request.method,
    headers: toFetchHeaders(request.headers),
    body,
    // `duplex: "half"` is required by undici whenever a (possibly streaming)
    // body is sent; without it `new Request` throws "duplex option is required
    // when sending a body" for the tRPC handler's ReadableStream body.
    ...(body != null ? { duplex: "half" } : {}),
  } as RequestInit);
}

function toFetchHeaders(
  headers: Headers | Record<string, string | string[] | undefined> | undefined,
): HeadersInit | undefined {
  if (!headers || headers instanceof Headers) {
    return headers;
  }

  const fetchHeaders = new Headers();

  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        fetchHeaders.append(name, item);
      }
      continue;
    }

    if (value !== undefined) {
      fetchHeaders.set(name, value);
    }
  }

  return fetchHeaders;
}

async function toFrameworkResponse(
  response: Response,
): Promise<FrameworkResponse> {
  const headers = new Headers(response.headers);
  // The body is buffered below, so the upstream stream framing is stale.
  headers.delete("transfer-encoding");

  return {
    status: response.status,
    headers: Object.fromEntries(headers.entries()),
    body: await response.text(),
  };
}

function toHonoResponse(response: FrameworkResponse): Response {
  return new Response(toResponseBody(response.body), {
    status: response.status,
    headers: response.headers,
  });
}

function toResponseBody(body: FrameworkResponse["body"]): BodyInit | null {
  if (body === undefined || body === null) {
    return null;
  }

  if (typeof body === "string") {
    return body;
  }

  if (body instanceof Uint8Array) {
    return body.slice().buffer;
  }

  return JSON.stringify(body);
}

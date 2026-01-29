import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
// After bundling, this file is at dist/server/production.js
// So __dirname is dist/server, and we need dist/client and dist/server/server.js
const clientDir = join(__dirname, "..", "client");
const serverFile = join(__dirname, "server.js");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".wasm": "application/wasm",
};

const port = parseInt(process.env.PORT || "4000", 10);
const host = process.env.HOST || "localhost";

interface ServerModule {
  fetch: (request: Request) => Promise<Response>;
}

// Load the TanStack Start server handler dynamically
let serverModule: ServerModule | null = null;

async function getServerModule(): Promise<ServerModule> {
  if (!serverModule) {
    const module = await import(pathToFileURL(serverFile).href);
    serverModule = module.default || module;
  }
  return serverModule;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  const pathname = url.pathname;

  // Try to serve static files first
  // Handle assets, favicon, logo, and fonts
  if (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/fonts/") ||
    pathname === "/favicon.ico" ||
    pathname === "/logo.svg" ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".ttf") ||
    pathname.endsWith(".woff") ||
    pathname.endsWith(".woff2")
  ) {
    const filePath = join(clientDir, pathname);

    if (existsSync(filePath)) {
      const stat = statSync(filePath);
      if (stat.isFile()) {
        const ext = extname(filePath);
        const contentType = MIME_TYPES[ext] || "application/octet-stream";

        // Use shorter cache for non-hashed assets
        const cacheControl = pathname.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "public, max-age=3600";

        res.writeHead(200, {
          "Content-Type": contentType,
          "Content-Length": stat.size,
          "Cache-Control": cacheControl,
        });

        createReadStream(filePath).pipe(res);
        return;
      }
    }
  }

  // Handle SSR for all other routes
  try {
    const handler = await getServerModule();

    // Create a Request object from the incoming request
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        if (Array.isArray(value)) {
          value.forEach((v) => headers.append(key, v));
        } else {
          headers.set(key, value);
        }
      }
    }

    const body =
      req.method !== "GET" && req.method !== "HEAD"
        ? await new Promise<Buffer>((resolve) => {
            const chunks: Buffer[] = [];
            req.on("data", (chunk) => chunks.push(chunk));
            req.on("end", () => resolve(Buffer.concat(chunks)));
          })
        : undefined;

    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body,
    });

    // Call the TanStack Start fetch handler
    const response = await handler.fetch(request);

    // Send response
    res.writeHead(response.status, Object.fromEntries(response.headers));

    if (response.body) {
      const reader = response.body.getReader();
      const pump = async () => {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          return;
        }
        res.write(value);
        await pump();
      };
      await pump();
    } else {
      res.end();
    }
  } catch (error) {
    console.error("SSR Error:", error);
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}`);
});

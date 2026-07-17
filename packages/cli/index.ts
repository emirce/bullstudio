#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = findPackageDir(__dirname);

const { values, positionals } = parseArgs({
  options: {
    redis: {
      type: "string",
      short: "r",
      description: "Redis connection URL",
    },
    port: {
      type: "string",
      short: "p",
      default: "4000",
      description: "Port to run the server on",
    },
    username: {
      type: "string",
      description: "Username for HTTP Basic Auth (default: bullstudio)",
      default: "bullstudio",
    },
    password: {
      type: "string",
      description: "Password for HTTP Basic Auth (username: bullstudio)",
    },
    help: {
      type: "boolean",
      short: "h",
      description: "Show help",
    },
    prefix: {
      type: "string",
      description:
        "Redis key prefix(es), comma-separated (default: auto-discover)",
    },
    "base-path": {
      type: "string",
      description: "Base path to serve the dashboard under (e.g. /queues)",
    },
    "no-open": {
      type: "boolean",
      description: "Do not open browser automatically",
    },
    dev: {
      type: "boolean",
      description: "Run in development mode",
    },
  },
  allowPositionals: true,
});

if (values.help) {
  console.log(`
bullstudio CLI - A lightweight queue management dashboard for BullMQ

Usage:
  bullstudio [options]
  npx bullstudio [options]

Options:
  -r, --redis <url>      Redis connection URL (default: redis://localhost:6379)
  -p, --port <port>      Port to run the server on (default: 4000)
  --prefix <prefixes>    Comma-separated key prefixes (default: auto-discover all)
  --base-path <path>     Serve the dashboard under a path prefix (e.g. /queues)
  --username <user>      Username for HTTP Basic Auth (default: bullstudio)
  --password <pass>      Password for HTTP Basic Auth
  --no-open              Do not open browser automatically
  --dev                  Run in development mode (requires source files)
  -h, --help             Show this help message

Examples:
  bullstudio
  bullstudio -r redis://localhost:6379
  bullstudio -r redis://:password@myhost.com:6379
  bullstudio -p 5000 -r redis://localhost:6379
  bullstudio --prefix stage,stage2
  bullstudio --password secret123
  bullstudio --username admin --password secret123
`);
  process.exit(0);
}

const redisUrl = values.redis || positionals[0] || "redis://localhost:6379";
const port = values.port || "4000";
const shouldOpen = !values["no-open"];
const isDev = values.dev;
const username = values.username;
const password = values.password;
const prefixArg = values.prefix;
const basePathArg = values["base-path"];

// Validate Redis URL
try {
  new URL(redisUrl);
} catch {
  console.error(`Invalid Redis URL: ${redisUrl}`);
  console.error(
    "Please provide a valid Redis URL (e.g., redis://localhost:6379)",
  );
  process.exit(1);
}

console.log(`
┌─────────────────────────────────────────────┐
│                                             │
│   bullstudio CLI                            │
│   Queue Management Dashboard for BullMQ     │
│                                             │
└─────────────────────────────────────────────┘

Redis:    ${redisUrl}
Port:     ${port}
Prefix:   ${prefixArg || "auto-discover"}
Mode:     ${isDev ? "development" : "production"}
Auth:     ${password ? `enabled (username: ${username})` : "disabled"}
`);

async function openBrowser(url: string) {
  try {
    const open = await import("open");
    await open.default(url);
  } catch {
    console.log(`Open ${url} in your browser to view the dashboard.`);
  }
}

const distDir = resolve(packageDir, "dist");
const frontendDir = resolve(packageDir, "../../apps/frontend");
const clientDir = isDev ? frontendDir : resolve(distDir, "client");
const productionServerFile = resolve(distDir, "server", "production.js");

// Check if we should run in production mode
const hasBuiltServer = existsSync(productionServerFile);

if (!isDev && !hasBuiltServer) {
  console.error("Production server not found. Please run 'pnpm build' first.");
  console.error("Or use --dev flag to run in development mode.");
  process.exit(1);
}

let child: ReturnType<typeof spawn>;

if (isDev) {
  if (!existsSync(frontendDir)) {
    console.error(
      "Frontend source app not found. The --dev flag requires a source checkout.",
    );
    process.exit(1);
  }

  // Development mode: use vite dev
  console.log("Starting development server...\n");
  child = spawn("npx", ["vite", "dev", "--port", port], {
    cwd: frontendDir,
    env: {
      ...process.env,
      REDIS_URL: redisUrl,
      PORT: port,
      BULLSTUDIO_CLIENT_DIR: clientDir,
      ...(prefixArg ? { REDIS_PREFIX: prefixArg } : {}),
      ...(basePathArg ? { BULLSTUDIO_BASE_PATH: basePathArg } : {}),
    },
    stdio: "pipe",
    shell: true,
  });
} else {
  // Production mode: run the built production server
  console.log("Starting production server...\n");
  child = spawn("node", [productionServerFile], {
    cwd: packageDir,
    env: {
      ...process.env,
      REDIS_URL: redisUrl,
      PORT: port,
      HOST: "localhost",
      BULLSTUDIO_CLIENT_DIR: clientDir,
      BULLSTUDIO_USERNAME: username,
      BULLSTUDIO_PASSWORD: password,
      ...(prefixArg ? { REDIS_PREFIX: prefixArg } : {}),
      ...(basePathArg ? { BULLSTUDIO_BASE_PATH: basePathArg } : {}),
    },
    stdio: "pipe",
  });
}

let serverStarted = false;

child.stdout?.on("data", (data: Buffer) => {
  const output = data.toString();
  process.stdout.write(output);

  // Detect when server is ready
  if (
    !serverStarted &&
    (output.includes("ready in") ||
      output.includes(`localhost:${port}`) ||
      output.includes("Listening on") ||
      output.includes(`port ${port}`))
  ) {
    serverStarted = true;
    const url = `http://localhost:${port}`;

    if (shouldOpen) {
      console.log("\nOpening browser...\n");
      openBrowser(url);
    } else {
      console.log(`\nOpen ${url} in your browser to view the dashboard.\n`);
    }
  }
});

child.stderr?.on("data", (data: Buffer) => {
  process.stderr.write(data.toString());
});

child.on("error", (error) => {
  console.error("Failed to start server:", error.message);
  process.exit(1);
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  child.kill("SIGINT");
});

process.on("SIGTERM", () => {
  child.kill("SIGTERM");
});

function findPackageDir(startDir: string): string {
  const candidates = [resolve(startDir, ".."), resolve(startDir, "../..")];

  return (
    candidates.find((candidate) =>
      existsSync(resolve(candidate, "package.json")),
    ) ?? startDir
  );
}

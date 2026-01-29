#!/usr/bin/env node

import { parseArgs } from "node:util";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    help: {
      type: "boolean",
      short: "h",
      description: "Show help",
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
  bullstudio-cli [options]
  npx bullstudio-cli [options]

Options:
  -r, --redis <url>    Redis connection URL (default: redis://localhost:6379)
  -p, --port <port>    Port to run the server on (default: 4000)
  --no-open            Do not open browser automatically
  --dev                Run in development mode (requires source files)
  -h, --help           Show this help message

Examples:
  bullstudio-cli
  bullstudio-cli -r redis://localhost:6379
  bullstudio-cli -r redis://:password@myhost.com:6379
  bullstudio-cli -p 5000 -r redis://localhost:6379
`);
  process.exit(0);
}

const redisUrl = values.redis || positionals[0] || "redis://localhost:6379";
const port = values.port || "4000";
const shouldOpen = !values["no-open"];
const isDev = values.dev;

// Validate Redis URL
try {
  new URL(redisUrl);
} catch {
  console.error(`Invalid Redis URL: ${redisUrl}`);
  console.error(
    "Please provide a valid Redis URL (e.g., redis://localhost:6379)"
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

Redis: ${redisUrl}
Port:  ${port}
Mode:  ${isDev ? "development" : "production"}
`);

async function openBrowser(url: string) {
  try {
    const open = await import("open");
    await open.default(url);
  } catch {
    console.log(`Open ${url} in your browser to view the dashboard.`);
  }
}

// Get the CLI app directory
// When bundled, __dirname is dist/bin, so appDir should be dist (parent)
// The production server is at dist/server/production.js
const appDir = resolve(__dirname, "..");
const productionServerFile = resolve(appDir, "server", "production.js");

// Check if we should run in production mode
const hasBuiltServer = existsSync(productionServerFile);

if (!isDev && !hasBuiltServer) {
  console.error("Production server not found. Please run 'pnpm build' first.");
  console.error("Or use --dev flag to run in development mode.");
  process.exit(1);
}

let child: ReturnType<typeof spawn>;

if (isDev) {
  // Development mode: use vite dev
  console.log("Starting development server...\n");
  child = spawn("npx", ["vite", "dev", "--port", port], {
    cwd: appDir,
    env: {
      ...process.env,
      REDIS_URL: redisUrl,
      PORT: port,
    },
    stdio: "pipe",
    shell: true,
  });
} else {
  // Production mode: run the built production server
  console.log("Starting production server...\n");
  child = spawn("node", [productionServerFile], {
    cwd: appDir,
    env: {
      ...process.env,
      REDIS_URL: redisUrl,
      PORT: port,
      HOST: "localhost",
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

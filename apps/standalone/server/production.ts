import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { serve } from "@hono/node-server";
import { disconnectProvider } from "../src/connection";
import { createStandaloneApp, getStandaloneBasePath } from "./standalone";

export interface StandaloneServerOptions {
  clientDir: string;
  env?: NodeJS.ProcessEnv;
  host?: string;
  port?: number;
}

export function startStandaloneServer(options: StandaloneServerOptions) {
  const env = options.env ?? process.env;
  const port = options.port ?? Number.parseInt(env.PORT || "4000", 10);
  const host = options.host ?? env.HOST ?? "localhost";

  const app = createStandaloneApp({
    clientDir: options.clientDir,
    env,
  });

  const basePath = getStandaloneBasePath(env);

  const server = serve(
    {
      fetch: app.fetch,
      hostname: host,
      port,
    },
    () => {
      console.log(`Server running at http://${host}:${port}${basePath}`);
    },
  );

  const shutdown = (signal: string) => {
    console.log(
      `Process received ${signal}, attempting to shut down gracefully`,
    );

    server.close(async () => {
      await disconnectProvider();
      console.log("Server stopped successfully");
      process.exit(0);
    });

    setTimeout(() => {
      console.error("Server stop timeout occurred, forcing shutdown");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  return server;
}

const __dirname = fileURLToPath(new URL(".", import.meta.url));

function getDefaultClientDir(env: NodeJS.ProcessEnv): string {
  if (env.BULLSTUDIO_CLIENT_DIR) {
    return env.BULLSTUDIO_CLIENT_DIR;
  }

  // After bundling, this file is at dist/server/production.js,
  // so __dirname is dist/server and the SPA is usually in dist/client.
  return join(__dirname, "..", "client");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  startStandaloneServer({
    clientDir: getDefaultClientDir(process.env),
  });
}

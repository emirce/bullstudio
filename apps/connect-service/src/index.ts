import { ConnectionManager } from "./services";
import { createAuthMiddleware } from "./middleware";
import { Router, jsonResponse } from "./lib";
import {
  createConnectionsRoutes,
  createHealthRoutes,
  createQueuesRoutes,
  createJobsRoutes,
  createWorkersRoutes,
} from "./routes";

const PORT = parseInt(process.env.PORT ?? "3001", 10);
const API_KEY = process.env.CONNECT_SERVICE_API_KEY;

if (!API_KEY) {
  console.error(
    "[Error] CONNECT_SERVICE_API_KEY environment variable is required"
  );
  process.exit(1);
}

const connectionManager = new ConnectionManager();
const authenticate = createAuthMiddleware({ apiKey: API_KEY });

const router = new Router();
router.register(createHealthRoutes());
router.register(createConnectionsRoutes(connectionManager));
router.register(createQueuesRoutes(connectionManager));
router.register(createJobsRoutes(connectionManager));
router.register(createWorkersRoutes(connectionManager));

console.log(`[Connect Service] Initialized with dynamic connection management`);

const server = Bun.serve({
  port: PORT,
  fetch: async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    if (url.pathname !== "/health") {
      const authError = authenticate(request);
      if (authError) {
        return authError;
      }
    }

    const response = await router.handle(request);
    if (response) {
      return response;
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
});

console.log(`[Connect Service] Server running on port ${PORT}`);

process.on("SIGINT", async () => {
  console.log("\n[Connect Service] Shutting down...");
  await connectionManager.disconnectAll();
  server.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n[Connect Service] Shutting down...");
  await connectionManager.disconnectAll();
  server.stop();
  process.exit(0);
});

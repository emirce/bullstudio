import type { ConnectionManager } from "../services/connection.service";
import type { Route } from "../lib/router";
import { jsonResponse, errorResponse } from "../lib/response";

export function createWorkersRoutes(connectionManager: ConnectionManager): Route[] {
  return [
    {
      method: "GET",
      path: "/api/connections/:connectionId/queues/:queueName/workers/count",
      handler: async (_request, params) => {
        try {
          const service = connectionManager.getQueueService(params.connectionId!);
          if (!service) {
            return jsonResponse({ error: "Connection not found or not connected" }, 404);
          }
          const workerCount = await service.getWorkerCount(
            params.queueName!
          );
          return jsonResponse(workerCount);
        } catch (error) {
          return errorResponse("Failed to fetch worker count", error);
        }
      },
    },
  ];
}

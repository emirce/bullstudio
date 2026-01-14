import type { ConnectionManager } from "../services/connection.service";
import type { Route } from "../lib/router";
import { jsonResponse, errorResponse } from "../lib/response";

export function createQueuesRoutes(connectionManager: ConnectionManager): Route[] {
  return [
    {
      method: "GET",
      path: "/api/connections/:connectionId/queues",
      handler: async (_request, params) => {
        try {
          const service = connectionManager.getQueueService(params.connectionId!);
          if (!service) {
            return jsonResponse({ error: "Connection not found or not connected" }, 404);
          }
          const queues = await service.getQueues();
          return jsonResponse({ queues });
        } catch (error) {
          return errorResponse("Failed to fetch queues", error);
        }
      },
    },
    {
      method: "GET",
      path: "/api/connections/:connectionId/queues/:queueName",
      handler: async (_request, params) => {
        try {
          const service = connectionManager.getQueueService(params.connectionId!);
          if (!service) {
            return jsonResponse({ error: "Connection not found or not connected" }, 404);
          }
          const queue = await service.getQueue(params.queueName!);

          if (!queue) {
            return jsonResponse({ error: "Queue not found" }, 404);
          }

          return jsonResponse({ queue });
        } catch (error) {
          return errorResponse("Failed to fetch queue", error);
        }
      },
    },
    {
      method: "POST",
      path: "/api/connections/:connectionId/queues/:queueName/pause",
      handler: async (_request, params) => {
        try {
          const service = connectionManager.getQueueService(params.connectionId!);
          if (!service) {
            return jsonResponse({ error: "Connection not found or not connected" }, 404);
          }
          await service.pauseQueue(params.queueName!);
          return jsonResponse({
            success: true,
            message: `Queue ${params.queueName} paused`,
          });
        } catch (error) {
          return errorResponse("Failed to pause queue", error);
        }
      },
    },
    {
      method: "POST",
      path: "/api/connections/:connectionId/queues/:queueName/resume",
      handler: async (_request, params) => {
        try {
          const service = connectionManager.getQueueService(params.connectionId!);
          if (!service) {
            return jsonResponse({ error: "Connection not found or not connected" }, 404);
          }
          await service.resumeQueue(params.queueName!);
          return jsonResponse({
            success: true,
            message: `Queue ${params.queueName} resumed`,
          });
        } catch (error) {
          return errorResponse("Failed to resume queue", error);
        }
      },
    },
  ];
}

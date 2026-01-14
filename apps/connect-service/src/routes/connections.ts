import type { ConnectionManager } from "../services/connection.service";
import type { Route } from "../lib/router";
import { jsonResponse, errorResponse } from "../lib/response";
import type { IConnectionConfig } from "../interfaces";

export function createConnectionsRoutes(
  connectionManager: ConnectionManager
): Route[] {
  return [
    {
      method: "GET",
      path: "/api/connections",
      handler: async () => {
        try {
          const connections = connectionManager.getAllConnections();
          return jsonResponse({ connections });
        } catch (error) {
          return errorResponse("Failed to fetch connections", error);
        }
      },
    },
    {
      method: "GET",
      path: "/api/connections/:connectionId",
      handler: async (_request, params) => {
        try {
          const connection = connectionManager.getConnection(
            params.connectionId!
          );
          if (!connection) {
            return jsonResponse({ error: "Connection not found" }, 404);
          }
          return jsonResponse({ connection });
        } catch (error) {
          return errorResponse("Failed to fetch connection", error);
        }
      },
    },
    {
      method: "POST",
      path: "/api/connections",
      handler: async (request) => {
        try {
          const body = (await request.json()) as IConnectionConfig;

          if (!body.id || !body.host || !body.port) {
            return jsonResponse(
              { error: "Missing required fields: id, host, port" },
              400
            );
          }

          const connection = await connectionManager.addConnection(body);
          return jsonResponse({ connection }, 201);
        } catch (error) {
          return errorResponse("Failed to create connection", error);
        }
      },
    },
    {
      method: "PUT",
      path: "/api/connections/:connectionId",
      handler: async (request, params) => {
        try {
          const body = (await request.json()) as Omit<IConnectionConfig, "id">;
          const config: IConnectionConfig = {
            ...body,
            id: params.connectionId!,
          };

          if (!config.host || !config.port) {
            return jsonResponse(
              { error: "Missing required fields: host, port" },
              400
            );
          }

          const connection = await connectionManager.updateConnection(config);
          return jsonResponse({ connection });
        } catch (error) {
          return errorResponse("Failed to update connection", error);
        }
      },
    },
    {
      method: "DELETE",
      path: "/api/connections/:connectionId",
      handler: async (_request, params) => {
        try {
          await connectionManager.removeConnection(params.connectionId!);
          return jsonResponse({
            success: true,
            message: `Connection ${params.connectionId} removed`,
          });
        } catch (error) {
          return errorResponse("Failed to remove connection", error);
        }
      },
    },
    {
      method: "POST",
      path: "/api/connections/test",
      handler: async (request) => {
        try {
          const body = (await request.json()) as IConnectionConfig;

          if (!body.host || !body.port) {
            return jsonResponse(
              { error: "Missing required fields: host, port" },
              400
            );
          }

          const result = await connectionManager.testConnection(body);
          return jsonResponse(result);
        } catch (error) {
          return errorResponse("Failed to test connection", error);
        }
      },
    },
    {
      method: "POST",
      path: "/api/connections/:connectionId/test",
      handler: async (_request, params) => {
        try {
          const connection = connectionManager.getConnection(
            params.connectionId!
          );
          if (!connection) {
            return jsonResponse({ error: "Connection not found" }, 404);
          }

          // Test using the existing connection's config
          const existing = connectionManager.getConnection(params.connectionId!);
          if (!existing) {
            return jsonResponse({ error: "Connection not found" }, 404);
          }

          // For existing connections, just check if it's connected
          return jsonResponse({
            success: existing.status === "connected",
            error: existing.error,
          });
        } catch (error) {
          return errorResponse("Failed to test connection", error);
        }
      },
    },
  ];
}

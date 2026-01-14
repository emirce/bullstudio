import type { ConnectionManager } from "../services/connection.service";
import type { IJobQueryOptions, JobStatus } from "../interfaces";
import type { Route } from "../lib/router";
import { jsonResponse, errorResponse } from "../lib/response";

export function createJobsRoutes(connectionManager: ConnectionManager): Route[] {
  return [
    {
      method: "GET",
      path: "/api/connections/:connectionId/queues/:queueName/jobs",
      handler: async (request, params) => {
        try {
          const service = connectionManager.getQueueService(params.connectionId!);
          if (!service) {
            return jsonResponse({ error: "Connection not found or not connected" }, 404);
          }
          const url = new URL(request.url);
          const options = parseJobQueryOptions(url.searchParams);
          const jobs = await service.getJobs(params.queueName!, options);
          return jsonResponse({ jobs, total: jobs.length });
        } catch (error) {
          return errorResponse("Failed to fetch jobs", error);
        }
      },
    },
    {
      method: "GET",
      path: "/api/connections/:connectionId/queues/:queueName/jobs/:jobId",
      handler: async (_request, params) => {
        try {
          const service = connectionManager.getQueueService(params.connectionId!);
          if (!service) {
            return jsonResponse({ error: "Connection not found or not connected" }, 404);
          }
          const job = await service.getJob(
            params.queueName!,
            params.jobId!
          );

          if (!job) {
            return jsonResponse({ error: "Job not found" }, 404);
          }

          return jsonResponse({ job });
        } catch (error) {
          return errorResponse("Failed to fetch job", error);
        }
      },
    },
    {
      method: "POST",
      path: "/api/connections/:connectionId/queues/:queueName/jobs/:jobId/retry",
      handler: async (_request, params) => {
        try {
          const service = connectionManager.getQueueService(params.connectionId!);
          if (!service) {
            return jsonResponse({ error: "Connection not found or not connected" }, 404);
          }
          await service.retryJob(params.queueName!, params.jobId!);
          return jsonResponse({
            success: true,
            message: `Job ${params.jobId} retried`,
          });
        } catch (error) {
          return errorResponse("Failed to retry job", error);
        }
      },
    },
    {
      method: "DELETE",
      path: "/api/connections/:connectionId/queues/:queueName/jobs/:jobId",
      handler: async (_request, params) => {
        try {
          const service = connectionManager.getQueueService(params.connectionId!);
          if (!service) {
            return jsonResponse({ error: "Connection not found or not connected" }, 404);
          }
          await service.removeJob(params.queueName!, params.jobId!);
          return jsonResponse({
            success: true,
            message: `Job ${params.jobId} removed`,
          });
        } catch (error) {
          return errorResponse("Failed to remove job", error);
        }
      },
    },
  ];
}

function parseJobQueryOptions(params: URLSearchParams): IJobQueryOptions {
  const options: IJobQueryOptions = {};

  const status = params.get("status");
  if (status) {
    const statuses = status.split(",") as JobStatus[];
    options.filter = {
      ...options.filter,
      status: statuses.length === 1 ? statuses[0] : statuses,
    };
  }

  const name = params.get("name");
  if (name) {
    options.filter = {
      ...options.filter,
      name,
    };
  }

  const sortField = params.get("sortBy");
  const sortOrder = params.get("sortOrder");
  if (
    sortField &&
    ["timestamp", "processedOn", "finishedOn", "progress"].includes(sortField)
  ) {
    options.sort = {
      field: sortField as "timestamp" | "processedOn" | "finishedOn" | "progress",
      order: sortOrder === "asc" ? "asc" : "desc",
    };
  }

  const limit = params.get("limit");
  if (limit) {
    const parsed = parseInt(limit, 10);
    if (!isNaN(parsed) && parsed > 0) {
      options.limit = Math.min(parsed, 1000);
    }
  }

  const offset = params.get("offset");
  if (offset) {
    const parsed = parseInt(offset, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      options.offset = parsed;
    }
  }

  return options;
}

import type {
  Job,
  JobQueryOptions,
  JobStatus,
  Queue,
  WorkerCount,
  HealthResponse,
  QueuesResponse,
  QueueResponse,
  JobsResponse,
  JobResponse,
  WorkerCountResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
} from "@bullstudio/connect-types";

export interface ConnectClientConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
}

export class ConnectClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: string
  ) {
    super(message);
    this.name = "ConnectClientError";
  }
}

export class ConnectClient {
  private config: ConnectClientConfig;

  constructor(config: ConnectClientConfig) {
    this.config = {
      timeout: 30000,
      ...config,
    };
  }

  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("GET", "/health", { skipAuth: true });
  }

  readonly queues = {
    list: async (): Promise<Queue[]> => {
      const response = await this.request<QueuesResponse>("GET", "/api/queues");
      return response.queues;
    },

    get: async (queueName: string): Promise<Queue> => {
      const response = await this.request<QueueResponse>(
        "GET",
        `/api/queues/${encodeURIComponent(queueName)}`
      );
      return response.queue;
    },

    pause: async (queueName: string): Promise<void> => {
      await this.request<ApiSuccessResponse>(
        "POST",
        `/api/queues/${encodeURIComponent(queueName)}/pause`
      );
    },

    resume: async (queueName: string): Promise<void> => {
      await this.request<ApiSuccessResponse>(
        "POST",
        `/api/queues/${encodeURIComponent(queueName)}/resume`
      );
    },
  };

  readonly jobs = {
    list: async (
      queueName: string,
      options?: JobQueryOptions
    ): Promise<{ jobs: Job[]; total: number }> => {
      const params = this.buildJobQueryParams(options);
      const query = params.toString();
      const path = `/api/queues/${encodeURIComponent(queueName)}/jobs${query ? `?${query}` : ""}`;
      return this.request<JobsResponse>("GET", path);
    },

    get: async (queueName: string, jobId: string): Promise<Job> => {
      const response = await this.request<JobResponse>(
        "GET",
        `/api/queues/${encodeURIComponent(queueName)}/jobs/${encodeURIComponent(jobId)}`
      );
      return response.job;
    },

    retry: async (queueName: string, jobId: string): Promise<void> => {
      await this.request<ApiSuccessResponse>(
        "POST",
        `/api/queues/${encodeURIComponent(queueName)}/jobs/${encodeURIComponent(jobId)}/retry`
      );
    },

    remove: async (queueName: string, jobId: string): Promise<void> => {
      await this.request<ApiSuccessResponse>(
        "DELETE",
        `/api/queues/${encodeURIComponent(queueName)}/jobs/${encodeURIComponent(jobId)}`
      );
    },
  };

  readonly workers = {
    count: async (queueName: string): Promise<WorkerCount> => {
      return this.request<WorkerCountResponse>(
        "GET",
        `/api/queues/${encodeURIComponent(queueName)}/workers/count`
      );
    },
  };

  private async request<T>(
    method: string,
    path: string,
    options?: { skipAuth?: boolean }
  ): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (!options?.skipAuth) {
      headers["x-api-key"] = this.config.apiKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as ApiErrorResponse;
        throw new ConnectClientError(
          errorData.error || "Request failed",
          response.status,
          errorData.details
        );
      }

      return data as T;
    } catch (error) {
      if (error instanceof ConnectClientError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new ConnectClientError("Request timeout", 408);
        }
        throw new ConnectClientError(error.message, 500);
      }

      throw new ConnectClientError("Unknown error", 500);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private buildJobQueryParams(options?: JobQueryOptions): URLSearchParams {
    const params = new URLSearchParams();

    if (!options) {
      return params;
    }

    if (options.filter?.status) {
      const statuses = Array.isArray(options.filter.status)
        ? options.filter.status
        : [options.filter.status];
      params.set("status", statuses.join(","));
    }

    if (options.filter?.name) {
      params.set("name", options.filter.name);
    }

    if (options.sort) {
      params.set("sortBy", options.sort.field);
      params.set("sortOrder", options.sort.order);
    }

    if (options.limit !== undefined) {
      params.set("limit", options.limit.toString());
    }

    if (options.offset !== undefined) {
      params.set("offset", options.offset.toString());
    }

    return params;
  }
}

export function createConnectClient(
  config: ConnectClientConfig
): ConnectClient {
  return new ConnectClient(config);
}

export type {
  Job,
  JobQueryOptions,
  JobStatus,
  JobFilter,
  JobSort,
  Queue,
  JobCounts,
  Worker,
  WorkerCount,
} from "@bullstudio/connect-types";

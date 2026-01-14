/**
 * Client for communicating with the Connect Service
 */

const CONNECT_SERVICE_URL = process.env.CONNECT_SERVICE_URL ?? "http://localhost:3001";
const CONNECT_SERVICE_API_KEY = process.env.CONNECT_SERVICE_API_KEY;

interface ConnectionConfig {
  id: string;
  host: string;
  port: number;
  database: number;
  username?: string;
  password?: string;
  tls: boolean;
  tlsCert?: string;
}

interface Connection {
  id: string;
  status: "connected" | "disconnected" | "error";
  host: string;
  port: number;
  database: number;
  tls: boolean;
  error?: string;
}

interface TestResult {
  success: boolean;
  latency?: number;
  error?: string;
}

async function makeRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!CONNECT_SERVICE_API_KEY) {
    throw new Error("CONNECT_SERVICE_API_KEY is not configured");
  }

  const response = await fetch(`${CONNECT_SERVICE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CONNECT_SERVICE_API_KEY,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export const connectServiceClient = {
  /**
   * Add a new connection to the connect service
   */
  async addConnection(config: ConnectionConfig): Promise<Connection> {
    const result = await makeRequest<{ connection: Connection }>(
      "/api/connections",
      {
        method: "POST",
        body: JSON.stringify(config),
      }
    );
    return result.connection;
  },

  /**
   * Update an existing connection
   */
  async updateConnection(config: ConnectionConfig): Promise<Connection> {
    const result = await makeRequest<{ connection: Connection }>(
      `/api/connections/${config.id}`,
      {
        method: "PUT",
        body: JSON.stringify(config),
      }
    );
    return result.connection;
  },

  /**
   * Remove a connection from the connect service
   */
  async removeConnection(connectionId: string): Promise<void> {
    await makeRequest(`/api/connections/${connectionId}`, {
      method: "DELETE",
    });
  },

  /**
   * Get connection status from the connect service
   */
  async getConnection(connectionId: string): Promise<Connection | null> {
    try {
      const result = await makeRequest<{ connection: Connection }>(
        `/api/connections/${connectionId}`
      );
      return result.connection;
    } catch {
      return null;
    }
  },

  /**
   * Get all connections from the connect service
   */
  async getAllConnections(): Promise<Connection[]> {
    const result = await makeRequest<{ connections: Connection[] }>(
      "/api/connections"
    );
    return result.connections;
  },

  /**
   * Test a connection configuration (without saving)
   */
  async testConnection(config: Omit<ConnectionConfig, "id">): Promise<TestResult> {
    return makeRequest<TestResult>("/api/connections/test", {
      method: "POST",
      body: JSON.stringify({ ...config, id: "test" }),
    });
  },
};

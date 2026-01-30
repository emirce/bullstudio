
/**
 * Configuration for establishing a Redis connection.
 * Contains decrypted credentials ready for use.
 */
export interface ConnectionConfig {
  id: string;
  workspaceId: string;
  host: string;
  port: number;
  database: number;
  username?: string;
  password?: string;
  tls: boolean;
  tlsCert?: string;
  prefix?: string;
}

/**
 * Connection state representation.
 */
export type ConnectionState =
  | "connecting"
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "error";

/**
 * Detailed connection status with metadata.
 */
export interface ConnectionStatus {
  id: string;
  workspaceId: string;
  state: ConnectionState;
  error?: string;
  lastConnectedAt?: Date;
  lastHealthCheckAt?: Date;
  reconnectAttempts: number;
  nextReconnectAt?: Date;
}

/**
 * Result of a connection test.
 */
export interface ConnectionTestResult {
  success: boolean;
  latency?: number;
  error?: string;
}

/**
 * Event types emitted by the connection manager.
 */
export type ConnectionEvent =
  | { type: "connected"; connectionId: string }
  | { type: "disconnected"; connectionId: string; reason?: string }
  | { type: "error"; connectionId: string; error: Error }
  | { type: "reconnecting"; connectionId: string; attempt: number }
  | { type: "state_changed"; connectionId: string; state: ConnectionState };

export type ConnectionEventListener = (event: ConnectionEvent) => void;

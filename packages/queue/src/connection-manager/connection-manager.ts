
import { EventEmitter } from "events";
import type {
  QueueService,
  QueueServiceEventCallbacks,
  ConnectionConfig,
  ConnectionStatus,
  ConnectionTestResult,
  ConnectionEvent,
  ConnectionEventListener,
  ConnectionState,
} from "../types";
import { ManagedConnection } from "./managed-connection";
import { RetryStrategy } from "./retry-strategy";
import { buildRedisUrl } from "../utils/redis-url-builder";
import { BullMqProvider } from "../providers/bullmq";
import { ConnectionNotFoundError } from "../errors";

export interface ConnectionManagerConfig {
  maxReconnectAttempts?: number;
  baseReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

export class ConnectionManager {
  private readonly connections = new Map<string, ManagedConnection>();
  private readonly eventEmitter = new EventEmitter();
  private readonly retryStrategy: RetryStrategy;

  constructor(config: ConnectionManagerConfig) {
    this.retryStrategy = new RetryStrategy({
      maxAttempts: config.maxReconnectAttempts ?? 10,
      baseDelayMs: config.baseReconnectDelayMs ?? 1000,
      maxDelayMs: config.maxReconnectDelayMs ?? 60000,
    });
  }



  /**
   * Handle connection state changes - update DB accordingly.
   */
  private async handleStateChange(
    connectionId: string,
    state: ConnectionState
  ): Promise<void> {
    console.log(
      `[ConnectionManager] Connection ${connectionId} changed state to ${state}`
    );
    const managed = this.connections.get(connectionId);



    this.emit({ type: "state_changed", connectionId, state });

    if (state === "connected") {
      this.emit({ type: "connected", connectionId });
    } else if (state === "disconnected") {
      this.emit({ type: "disconnected", connectionId });
    } else if (state === "reconnecting") {
      this.emit({
        type: "reconnecting",
        connectionId,
        attempt: managed?.toStatus().reconnectAttempts ?? 0,
      });
    }
  }


  /**
   * Handle connection errors.
   */
  private handleError(connectionId: string, error: Error): void {
    this.emit({ type: "error", connectionId, error });
  }

  /**
   * Get or lazily load a connection by ID.
   */
  async getConnection(connectionId: string): Promise<QueueService | null> {
    const managed = this.connections.get(connectionId);
    if (!managed) {
      return null;
    }
    return managed.queueService;
  }



  /**
   * Add a new connection (called after DB insert).
   */
  async addConnection(config: ConnectionConfig): Promise<ConnectionStatus> {
    if (this.connections.has(config.id)) {
      throw new Error(`Connection ${config.id} already exists`);
    }

    const managed = new ManagedConnection({
      config,
      providerFactory: (eventCallbacks: QueueServiceEventCallbacks) =>
        new BullMqProvider({
          redisUrl: buildRedisUrl(config),
          prefix: config.prefix,
          eventCallbacks,
        }),
      onStateChange: (state) => this.handleStateChange(config.id, state),
      onError: (error) => this.handleError(config.id, error),
      retryStrategy: this.retryStrategy,
    });

    this.connections.set(config.id, managed);


    await managed.connect();

    return this.getStatus(config.id)!;
  }

  /**
   * Update an existing connection configuration.
   */
  async updateConnection(config: ConnectionConfig): Promise<ConnectionStatus> {
    const existing = this.connections.get(config.id);
    if (existing) {
      await existing.disconnect();
      this.connections.delete(config.id);
    }

    return this.addConnection(config);
  }

  /**
   * Remove a connection (called before/after DB delete).
   */
  async removeConnection(connectionId: string): Promise<void> {
    const managed = this.connections.get(connectionId);
    if (managed) {
      await managed.disconnect();
      this.connections.delete(connectionId);
    }
  }

  /**
   * Test a connection without persisting it.
   */
  async testConnection(
    config: Omit<ConnectionConfig, "id" | "workspaceId">
  ): Promise<ConnectionTestResult> {
    const provider = new BullMqProvider({
      redisUrl: buildRedisUrl({ ...config, id: "test", workspaceId: "test" }),
      prefix: config.prefix,
    });

    const startTime = Date.now();

    try {
      await provider.connect();
      const latency = Date.now() - startTime;
      await provider.disconnect();
      return { success: true, latency };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  /**
   * Force reconnect a specific connection.
   */
  async reconnect(connectionId: string): Promise<ConnectionStatus> {
    const managed = this.connections.get(connectionId);
    if (!managed) {
      throw new ConnectionNotFoundError(connectionId);
    }

    await managed.reconnect();
    return this.getStatus(connectionId)!;
  }

  /**
   * Get current status of a connection.
   */
  getStatus(connectionId: string): ConnectionStatus | null {
    const managed = this.connections.get(connectionId);
    if (!managed) {
      return null;
    }

    return managed.toStatus();
  }

  /**
   * Subscribe to connection events.
   */
  on(listener: ConnectionEventListener): () => void {
    this.eventEmitter.on("event", listener);
    return () => this.eventEmitter.off("event", listener);
  }

  private emit(event: ConnectionEvent): void {
    this.eventEmitter.emit("event", event);
  }

  /**
   * Gracefully shutdown all connections.
   */
  async shutdown(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.values()).map(
      (managed) => managed.disconnect()
    );

    await Promise.all(disconnectPromises);
    this.connections.clear();
  }
}

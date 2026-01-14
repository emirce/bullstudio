import Redis, { RedisOptions } from "ioredis";
import { BullMqService } from "./bullmq.service";
import type {
  IConnectionConfig,
  IConnection,
  IConnectionManager,
  IQueueService,
} from "../interfaces";

interface ManagedConnection {
  config: IConnectionConfig;
  service: BullMqService;
  status: "connected" | "disconnected" | "error";
  error?: string;
}

export class ConnectionManager implements IConnectionManager {
  private connections = new Map<string, ManagedConnection>();

  private buildRedisUrl(config: IConnectionConfig): string {
    const protocol = config.tls ? "rediss" : "redis";
    let auth = "";
    if (config.username && config.password) {
      auth = `${encodeURIComponent(config.username)}:${encodeURIComponent(config.password)}@`;
    } else if (config.password) {
      auth = `:${encodeURIComponent(config.password)}@`;
    }
    return `${protocol}://${auth}${config.host}:${config.port}/${config.database}`;
  }

  async addConnection(config: IConnectionConfig): Promise<IConnection> {
    if (this.connections.has(config.id)) {
      throw new Error(`Connection ${config.id} already exists`);
    }

    const redisUrl = this.buildRedisUrl(config);
    const service = new BullMqService({ redisUrl });

    const managed: ManagedConnection = {
      config,
      service,
      status: "disconnected",
    };

    try {
      await service.connect();
      managed.status = "connected";
      console.log(`[ConnectionManager] Connection ${config.id} established`);
    } catch (error) {
      managed.status = "error";
      managed.error = error instanceof Error ? error.message : "Unknown error";
      console.error(
        `[ConnectionManager] Connection ${config.id} failed: ${managed.error}`
      );
    }

    this.connections.set(config.id, managed);
    return this.toConnection(managed);
  }

  async updateConnection(config: IConnectionConfig): Promise<IConnection> {
    const existing = this.connections.get(config.id);
    if (existing) {
      await this.removeConnection(config.id);
    }
    return this.addConnection(config);
  }

  async removeConnection(connectionId: string): Promise<void> {
    const managed = this.connections.get(connectionId);
    if (!managed) {
      return;
    }

    try {
      await managed.service.disconnect();
      console.log(`[ConnectionManager] Connection ${connectionId} disconnected`);
    } catch (error) {
      console.error(
        `[ConnectionManager] Error disconnecting ${connectionId}:`,
        error
      );
    }

    this.connections.delete(connectionId);
  }

  getConnection(connectionId: string): IConnection | null {
    const managed = this.connections.get(connectionId);
    return managed ? this.toConnection(managed) : null;
  }

  getAllConnections(): IConnection[] {
    return Array.from(this.connections.values()).map((m) => this.toConnection(m));
  }

  getQueueService(connectionId: string): IQueueService | null {
    const managed = this.connections.get(connectionId);
    if (!managed || managed.status !== "connected") {
      return null;
    }
    return managed.service;
  }

  async testConnection(
    config: IConnectionConfig
  ): Promise<{ success: boolean; latency?: number; error?: string }> {
    const startTime = Date.now();
    let redis: Redis | null = null;

    try {
      const options: RedisOptions = {
        host: config.host,
        port: config.port,
        db: config.database,
        username: config.username,
        password: config.password,
        connectTimeout: 5000,
        commandTimeout: 5000,
        lazyConnect: true,
      };

      if (config.tls) {
        options.tls = config.tlsCert ? { ca: config.tlsCert } : {};
      }

      redis = new Redis(options);
      await redis.connect();
      await redis.ping();

      const latency = Date.now() - startTime;
      return { success: true, latency };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    } finally {
      if (redis) {
        try {
          await redis.quit();
        } catch {
          redis.disconnect();
        }
      }
    }
  }

  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.keys()).map((id) =>
      this.removeConnection(id)
    );
    await Promise.all(disconnectPromises);
  }

  private toConnection(managed: ManagedConnection): IConnection {
    return {
      id: managed.config.id,
      status: managed.status,
      host: managed.config.host,
      port: managed.config.port,
      database: managed.config.database,
      tls: managed.config.tls,
      error: managed.error,
    };
  }
}

export const connectionManager = new ConnectionManager();

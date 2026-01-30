import type {
  QueueService,
  QueueServiceEventCallbacks,
  ConnectionConfig,
  ConnectionStatus,
  ConnectionState,
} from "../types";
import type { RetryStrategy } from "./retry-strategy";

export interface ManagedConnectionConfig {
  config: ConnectionConfig;
  providerFactory: (eventCallbacks: QueueServiceEventCallbacks) => QueueService;
  onStateChange: (state: ConnectionState) => Promise<void>;
  onError: (error: Error) => void;
  retryStrategy: RetryStrategy;
}

export class ManagedConnection {
  readonly config: ConnectionConfig;
  private provider: QueueService | null = null;
  private _state: ConnectionState = "disconnected";
  private _lastError?: string;
  private _lastConnectedAt?: Date;
  private _reconnectAttempts = 0;
  private _nextReconnectAt?: Date;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private _isIntentionalDisconnect = false;

  private readonly providerFactory: (
    eventCallbacks: QueueServiceEventCallbacks
  ) => QueueService;
  private readonly onStateChange: (state: ConnectionState) => Promise<void>;
  private readonly onError: (error: Error) => void;
  private readonly retryStrategy: RetryStrategy;

  constructor(options: ManagedConnectionConfig) {
    this.config = options.config;
    this.providerFactory = options.providerFactory;
    this.onStateChange = options.onStateChange;
    this.onError = options.onError;
    this.retryStrategy = options.retryStrategy;
  }

  get state(): ConnectionState {
    return this._state;
  }

  get lastError(): string | undefined {
    return this._lastError;
  }

  get queueService(): QueueService | null {
    return this.provider;
  }

  async connect(): Promise<void> {
    if (this._state === "connected" || this._state === "connecting") {
      return;
    }

    this._isIntentionalDisconnect = false;
    await this.setState("connecting");

    try {
      // Create provider with event callbacks for connection monitoring
      this.provider = this.providerFactory({
        onDisconnect: (reason) => this.handleProviderDisconnect(reason),
        onError: (error) => this.handleProviderError(error),
        onReconnecting: () => this.handleProviderReconnecting(),
        onReconnected: () => this.handleProviderReconnected(),
      });

      await this.provider.connect();

      this._lastConnectedAt = new Date();
      this._reconnectAttempts = 0;
      this._lastError = undefined;
      await this.setState("connected");
    } catch (error) {
      this._lastError =
        error instanceof Error ? error.message : "Connection failed";
      await this.setState("error");
      this.onError(error instanceof Error ? error : new Error(String(error)));
      this.scheduleReconnect();
    }
  }

  async disconnect(): Promise<void> {
    this._isIntentionalDisconnect = true;
    this.clearReconnectTimer();

    if (this.provider) {
      try {
        await this.provider.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.provider = null;
    }

    await this.setState("disconnected");
  }

  async reconnect(): Promise<void> {
    await this.disconnect();
    this._reconnectAttempts = 0;
    await this.connect();
  }

  /**
   * Handle disconnect event from the provider (Redis connection lost)
   */
  private handleProviderDisconnect(reason?: string): void {
    if (this._isIntentionalDisconnect) {
      return; // Don't trigger reconnect for intentional disconnects
    }

    console.log(
      `[ManagedConnection] Provider disconnected: ${reason ?? "unknown reason"}`
    );
    this._lastError = reason ?? "Connection lost";

    // Clear provider reference as it's no longer valid
    this.provider = null;

    // Trigger reconnection
    this.setState("error").then(() => {
      this.scheduleReconnect();
    });
  }

  /**
   * Handle error event from the provider
   */
  private handleProviderError(error: Error): void {
    if (this._isIntentionalDisconnect) {
      return;
    }

    console.error(`[ManagedConnection] Provider error:`, error.message);
    this._lastError = error.message;
    this.onError(error);

    // Clear provider reference as it may no longer be valid
    this.provider = null;

    // Trigger reconnection
    this.setState("error").then(() => {
      this.scheduleReconnect();
    });
  }

  /**
   * Handle reconnecting event from the provider (ioredis internal reconnect)
   */
  private handleProviderReconnecting(): void {
    console.log("[ManagedConnection] Provider reconnecting...");
    this.setState("reconnecting");
  }

  /**
   * Handle reconnected event from the provider
   */
  private handleProviderReconnected(): void {
    console.log("[ManagedConnection] Provider reconnected");
    this._lastConnectedAt = new Date();
    this._reconnectAttempts = 0;
    this._lastError = undefined;
    this.setState("connected");
  }

  private async setState(state: ConnectionState): Promise<void> {
    if (this._state !== state) {
      this._state = state;
      await this.onStateChange(state);
    }
  }

  private scheduleReconnect(): void {
    if (this._isIntentionalDisconnect) {
      return;
    }

    if (!this.retryStrategy.shouldRetry(this._reconnectAttempts)) {
      console.log(
        `[ManagedConnection] Max reconnect attempts (${this._reconnectAttempts}) reached`
      );
      return;
    }

    this._reconnectAttempts++;
    const delay = this.retryStrategy.getDelay(this._reconnectAttempts);
    this._nextReconnectAt = new Date(Date.now() + delay);

    console.log(
      `[ManagedConnection] Scheduling reconnect attempt ${this._reconnectAttempts} in ${delay}ms`
    );

    this.setState("reconnecting");

    this.reconnectTimer = setTimeout(async () => {
      console.log(
        `[ManagedConnection] Attempting reconnect (attempt ${this._reconnectAttempts})`
      );
      await this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
      this._nextReconnectAt = undefined;
    }
  }

  toStatus(): ConnectionStatus {
    return {
      id: this.config.id,
      workspaceId: this.config.workspaceId,
      state: this._state,
      error: this._lastError,
      lastConnectedAt: this._lastConnectedAt,
      lastHealthCheckAt: new Date(),
      reconnectAttempts: this._reconnectAttempts,
      nextReconnectAt: this._nextReconnectAt,
    };
  }


}

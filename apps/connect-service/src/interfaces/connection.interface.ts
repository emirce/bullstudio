export interface IConnectionConfig {
  id: string;
  host: string;
  port: number;
  database: number;
  username?: string;
  password?: string;
  tls: boolean;
  tlsCert?: string;
}

export interface IConnection {
  id: string;
  status: "connected" | "disconnected" | "error";
  host: string;
  port: number;
  database: number;
  tls: boolean;
  error?: string;
}

export interface IConnectionManager {
  addConnection(config: IConnectionConfig): Promise<IConnection>;
  updateConnection(config: IConnectionConfig): Promise<IConnection>;
  removeConnection(connectionId: string): Promise<void>;
  getConnection(connectionId: string): IConnection | null;
  getAllConnections(): IConnection[];
  testConnection(config: IConnectionConfig): Promise<{ success: boolean; latency?: number; error?: string }>;
}

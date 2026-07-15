import Redis, { Cluster } from "ioredis";

/** A standalone-mode Redis client: single-node or cluster. */
export type RedisConnection = Redis | Cluster;

/** Options shared by single-node and cluster clients built by the factory. */
export interface RedisConnectionOptions {
  /** Connect with a cluster client seeded from the Redis URL. */
  cluster?: boolean;
  lazyConnect?: boolean;
  enableReadyCheck?: boolean;
  commandTimeout?: number;
  /**
   * Reconnect backoff, or `() => null` to fail fast. Applied as
   * `retryStrategy` on single-node clients and `clusterRetryStrategy` on
   * cluster clients.
   */
  retryStrategy?: (attempt: number) => number | null;
}

/** Cluster seed-node fields parsed from a redis:// or rediss:// URL. */
export interface ParsedRedisUrl {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls: boolean;
}

/**
 * Detect whether the Redis behind `redis` runs in cluster mode by reading
 * `INFO cluster` (`cluster_enabled:1`). INFO is key-less, so it is safe to
 * issue from a single-node client connected to a cluster node.
 */
export async function isClusterEnabled(
  redis: RedisConnection,
): Promise<boolean> {
  try {
    const info = await redis.info("cluster");
    return info.includes("cluster_enabled:1");
  } catch {
    return false;
  }
}

/**
 * Parse a redis:// / rediss:// URL into cluster seed-node fields. The URL's
 * database segment is ignored: Redis Cluster only supports database 0.
 */
export function parseRedisUrl(redisUrl: string): ParsedRedisUrl {
  const url = new URL(redisUrl);
  return {
    host: url.hostname || "localhost",
    port: url.port ? Number(url.port) : 6379,
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    tls: url.protocol === "rediss:",
  };
}

/**
 * Create the standalone connection for `redisUrl`: a `Cluster` client seeded
 * from the URL when `cluster` is set, a single-node client otherwise. The
 * cluster client discovers the remaining nodes from the seed.
 */
export function createRedisConnection(
  redisUrl: string,
  options: RedisConnectionOptions = {},
): RedisConnection {
  const { cluster, retryStrategy, lazyConnect, enableReadyCheck } = options;
  const { commandTimeout } = options;

  if (!cluster) {
    return new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect,
      enableReadyCheck,
      commandTimeout,
      retryStrategy,
    });
  }

  const seed = parseRedisUrl(redisUrl);
  return new Cluster([{ host: seed.host, port: seed.port }], {
    lazyConnect,
    clusterRetryStrategy: retryStrategy,
    redisOptions: {
      maxRetriesPerRequest: null,
      username: seed.username,
      password: seed.password,
      tls: seed.tls ? {} : undefined,
      enableReadyCheck,
      commandTimeout,
    },
  });
}

/**
 * The clients to SCAN: every master node for a cluster, the client itself
 * otherwise. Each cluster node only returns keys for its own slots, so
 * discovery must visit all masters to see the whole keyspace.
 */
export function scanTargets(connection: RedisConnection): Redis[] {
  return connection instanceof Cluster
    ? connection.nodes("master")
    : [connection];
}

const MAX_SCAN_ITERATIONS = 10_000;

/**
 * SCAN the whole keyspace behind `connection` for keys matching `pattern`,
 * invoking `onKey` for each match. Fans out across every master node on a
 * cluster. Each node's cursor is bounded by MAX_SCAN_ITERATIONS as a runaway
 * guard.
 */
export async function scanMatching(
  connection: RedisConnection,
  pattern: string,
  onKey: (key: string) => void,
): Promise<void> {
  for (const node of scanTargets(connection)) {
    let cursor = "0";
    let iterations = 0;
    do {
      const [next, keys] = await node.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        200,
      );
      cursor = next;
      for (const key of keys) {
        onKey(key);
      }
      iterations++;
      if (iterations >= MAX_SCAN_ITERATIONS) {
        console.warn(
          `[RedisConnection] Stopped SCAN after ` +
            `${MAX_SCAN_ITERATIONS} iterations`,
        );
        break;
      }
    } while (cursor !== "0");
  }
}

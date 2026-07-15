import type Redis from "ioredis";
import { Cluster } from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createTestRedis,
  ensureRedisAvailable,
  flushTestDb,
  TEST_REDIS_URL,
} from "../test-utils/redis";
import {
  createRedisConnection,
  isClusterEnabled,
  parseRedisUrl,
  scanMatching,
  scanTargets,
} from "./redis-connection";

describe("parseRedisUrl", () => {
  it("parses host and port", () => {
    expect(parseRedisUrl("redis://redis.example.com:6380")).toMatchObject({
      host: "redis.example.com",
      port: 6380,
      tls: false,
    });
  });

  it("defaults the port to 6379", () => {
    expect(parseRedisUrl("redis://redis.example.com").port).toBe(6379);
  });

  it("parses credentials", () => {
    expect(parseRedisUrl("redis://user:secret@localhost:6379")).toMatchObject({
      username: "user",
      password: "secret",
    });
  });

  it("marks rediss:// URLs as TLS", () => {
    expect(parseRedisUrl("rediss://localhost:6380").tls).toBe(true);
  });

  it("ignores the database segment (clusters only support db 0)", () => {
    expect(parseRedisUrl("redis://localhost:6379/15")).toMatchObject({
      host: "localhost",
      port: 6379,
    });
  });
});

describe("createRedisConnection", () => {
  it("creates a single-node client by default", () => {
    const connection = createRedisConnection(TEST_REDIS_URL, {
      lazyConnect: true,
    });
    expect(connection).not.toBeInstanceOf(Cluster);
    connection.disconnect();
  });

  it("creates a cluster client when cluster is set", () => {
    const connection = createRedisConnection(TEST_REDIS_URL, {
      cluster: true,
      lazyConnect: true,
    });
    expect(connection).toBeInstanceOf(Cluster);
    connection.disconnect();
  });
});

describe("scanTargets / scanMatching / isClusterEnabled (single node)", () => {
  let redis: Redis;

  beforeAll(async () => {
    await ensureRedisAvailable();
    redis = createTestRedis();
  });

  afterAll(async () => {
    if (!redis) return;
    await redis.quit().catch(() => {});
  });

  beforeEach(async () => {
    await flushTestDb(redis);
  });

  it("scans the client itself on a single-node connection", () => {
    expect(scanTargets(redis)).toEqual([redis]);
  });

  it("collects every key matching the pattern", async () => {
    await redis.set("stage:q1:meta", "1");
    await redis.set("stage:q2:meta", "1");
    await redis.set("other:q3:id", "1");

    const keys: string[] = [];
    await scanMatching(redis, "stage:*:meta", (key) => keys.push(key));

    expect(keys.sort()).toEqual(["stage:q1:meta", "stage:q2:meta"]);
  });

  it("reports a single-node Redis as not cluster-enabled", async () => {
    expect(await isClusterEnabled(redis)).toBe(false);
  });
});

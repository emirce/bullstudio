import { Queue } from "bullmq";
import Redis, { Cluster } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createQueueProvider } from "./providers/provider-factory";
import { uniquePrefix } from "./test-utils/redis";
import { isClusterEnabled, parseRedisUrl } from "./utils";

/**
 * Integration tests against a real Redis Cluster. Skipped unless
 * TEST_REDIS_CLUSTER_URL points at a cluster node, e.g.:
 *
 *   docker run --rm -d -p 7000-7005:7000-7005 -e "IP=0.0.0.0" \
 *     grokzen/redis-cluster:7.0.10
 *   TEST_REDIS_CLUSTER_URL=redis://127.0.0.1:7000 pnpm test
 *
 * Queues are seeded under hash-tag prefixes (`{tag}`) so each prefix's keys
 * land on one slot, mirroring how BullMQ is deployed on a cluster.
 */
const CLUSTER_URL = process.env.TEST_REDIS_CLUSTER_URL;

describe.skipIf(!CLUSTER_URL)("standalone against a Redis Cluster", () => {
  const url = CLUSTER_URL as string;
  const tag = uniquePrefix("bstest");
  const prefixA = `{${tag}-a}`;
  const prefixB = `{${tag}-b}`;
  let cluster: Cluster;
  let queues: Queue[] = [];

  beforeAll(async () => {
    const seed = parseRedisUrl(url);
    cluster = new Cluster([{ host: seed.host, port: seed.port }], {
      redisOptions: { maxRetriesPerRequest: null },
    });
    queues = [
      new Queue("orders", { connection: cluster, prefix: prefixA }),
      new Queue("emails", { connection: cluster, prefix: prefixB }),
    ];
    await queues[0]?.add("job-a", { i: 0 });
    await queues[1]?.add("job-b", { i: 1 });
  });

  afterAll(async () => {
    for (const queue of queues) {
      await queue.obliterate({ force: true }).catch(() => {});
      await queue.close().catch(() => {});
    }
    await cluster?.quit().catch(() => {});
  });

  it("detects cluster mode from a single-node probe", async () => {
    const probe = new Redis(url, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      retryStrategy: () => null,
    });
    probe.on("error", () => {});
    await probe.connect();
    try {
      expect(await isClusterEnabled(probe)).toBe(true);
    } finally {
      await probe.quit().catch(() => {});
    }
  });

  it("discovers hash-tag prefixes across all masters via a glob", async () => {
    const provider = await createQueueProvider({
      redisUrl: url,
      prefixes: [`{${tag}-*}`],
    });
    await provider.connect();
    try {
      expect(await provider.getPrefixes()).toEqual([prefixA, prefixB]);

      const discovered = await provider.getQueues();
      expect(discovered.map((q) => q.name).sort()).toEqual([
        "emails",
        "orders",
      ]);

      const counts = await provider.getJobCounts("orders", prefixA);
      expect(counts).toMatchObject({ waiting: 1 });
    } finally {
      await provider.disconnect().catch(() => {});
    }
  });

  it("discovers the seeded prefixes with full auto-discovery", async () => {
    const provider = await createQueueProvider({
      redisUrl: url,
      prefixes: ["*"],
    });
    await provider.connect();
    try {
      const prefixes = await provider.getPrefixes();
      expect(prefixes).toEqual(expect.arrayContaining([prefixA, prefixB]));
    } finally {
      await provider.disconnect().catch(() => {});
    }
  });
});

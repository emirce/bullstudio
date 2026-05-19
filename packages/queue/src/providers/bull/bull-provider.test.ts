import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type Bull from "bull";
import type Redis from "ioredis";
import {
  createTestRedis,
  ensureRedisAvailable,
  flushTestDb,
  TEST_REDIS_URL,
} from "../../../test-utils/redis";
import {
  seedBullQueue,
  type SeededBullQueue,
} from "../../../test-utils/seed-bull";
import { withBullProvider } from "../../../test-utils/provider-fixture";

describe("BullProvider (multi-prefix)", () => {
  let redis: Redis;
  const seeded: SeededBullQueue[] = [];

  beforeAll(async () => {
    await ensureRedisAvailable();
    redis = createTestRedis();
  });

  afterAll(async () => {
    await redis.quit().catch(() => {});
  });

  beforeEach(async () => {
    while (seeded.length > 0) {
      const s = seeded.pop();
      if (s) await s.close().catch(() => {});
    }
    await flushTestDb(redis);
  });

  it("defaults to the 'bull' prefix when no prefixes are configured", async () => {
    seeded.push(
      await seedBullQueue({ prefix: "bull", name: "default-q" }),
    );

    await withBullProvider({ redisUrl: TEST_REDIS_URL }, async (provider) => {
      expect(await provider.getPrefixes()).toEqual(["bull"]);
      const queues = await provider.getQueues();
      expect(queues).toHaveLength(1);
      expect(queues[0]).toMatchObject({ name: "default-q", prefix: "bull" });
    });
  });

  it("returns queues across multiple explicit prefixes", async () => {
    seeded.push(
      await seedBullQueue({ prefix: "a", name: "q1" }),
      await seedBullQueue({ prefix: "b", name: "q1" }),
    );

    await withBullProvider(
      { prefixes: ["a", "b"] },
      async (provider) => {
        const queues = await provider.getQueues();
        expect(queues).toHaveLength(2);
        const keys = queues.map((q) => `${q.prefix}/${q.name}`).sort();
        expect(keys).toEqual(["a/q1", "b/q1"]);
      },
    );
  });

  it("discovers queues when the configured prefix contains colons", async () => {
    seeded.push(
      await seedBullQueue({ prefix: "tenant:bull", name: "email" }),
    );

    await withBullProvider(
      { prefixes: ["tenant:bull"] },
      async (provider) => {
        const queues = await provider.getQueues();
        expect(queues).toHaveLength(1);
        expect(queues[0]).toMatchObject({ name: "email", prefix: "tenant:bull" });
      },
    );
  });

  it("auto-discovers prefixes from Bull :id marker keys", async () => {
    seeded.push(
      await seedBullQueue({ prefix: "stage", name: "q-s" }),
      await seedBullQueue({ prefix: "prod", name: "q-p" }),
    );

    await withBullProvider({ prefixes: ["*"] }, async (provider) => {
      expect(await provider.getPrefixes()).toEqual(["prod", "stage"]);
    });
  });

  it("caches Bull.Queue instances per (prefix, name) composite key", async () => {
    seeded.push(
      await seedBullQueue({ prefix: "a", name: "email" }),
      await seedBullQueue({ prefix: "b", name: "email" }),
    );

    await withBullProvider(
      { prefixes: ["a", "b"] },
      async (provider) => {
        await provider.getJobCounts("email", "a");
        await provider.getJobCounts("email", "b");

        const internalQueues = (
          provider as unknown as { queues: Map<string, Bull.Queue> }
        ).queues;
        expect(internalQueues.has("a\0email")).toBe(true);
        expect(internalQueues.has("b\0email")).toBe(true);
        expect(internalQueues.get("a\0email")).not.toBe(
          internalQueues.get("b\0email"),
        );
      },
    );
  });

  it("scopes getJobs to the given prefix", async () => {
    seeded.push(
      await seedBullQueue({
        prefix: "a",
        name: "q",
        jobs: [{ name: "x" }, { name: "x" }, { name: "x" }],
      }),
      await seedBullQueue({
        prefix: "b",
        name: "q",
        jobs: [{ name: "y" }],
      }),
    );

    await withBullProvider(
      { prefixes: ["a", "b"] },
      async (provider) => {
        const jobsA = await provider.getJobs("q", undefined, "a");
        const jobsB = await provider.getJobs("q", undefined, "b");
        expect(jobsA).toHaveLength(3);
        expect(jobsB).toHaveLength(1);
        expect(jobsB[0]?.name).toBe("y");
      },
    );
  });
});

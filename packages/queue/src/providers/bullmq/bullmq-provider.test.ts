import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Queue } from "bullmq";
import type Redis from "ioredis";
import { BullMqProvider } from "./bullmq-provider";
import {
  createTestRedis,
  ensureRedisAvailable,
  flushTestDb,
  TEST_REDIS_URL,
} from "../../../test-utils/redis";
import {
  seedBullMqProcessed,
  seedBullMqQueue,
  type SeededQueue,
} from "../../../test-utils/seed-bullmq";
import { withBullMqProvider } from "../../../test-utils/provider-fixture";

describe("BullMqProvider (multi-prefix)", () => {
  let redis: Redis;
  const seeded: SeededQueue[] = [];

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

  async function track(s: SeededQueue): Promise<SeededQueue> {
    seeded.push(s);
    return s;
  }

  it("defaults to the 'bull' prefix when no prefixes are configured", async () => {
    await track(
      await seedBullMqQueue({ prefix: "bull", name: "default-q" }),
    );

    await withBullMqProvider({ redisUrl: TEST_REDIS_URL }, async (provider) => {
      expect(await provider.getPrefixes()).toEqual(["bull"]);
      const queues = await provider.getQueues();
      expect(queues).toHaveLength(1);
      expect(queues[0]).toMatchObject({ name: "default-q", prefix: "bull" });
    });
  });

  it("returns only queues in the configured prefix", async () => {
    await track(await seedBullMqQueue({ prefix: "stage", name: "email" }));
    await track(await seedBullMqQueue({ prefix: "other", name: "ignored" }));

    await withBullMqProvider(
      { prefixes: ["stage"] },
      async (provider) => {
        const queues = await provider.getQueues();
        expect(queues).toHaveLength(1);
        expect(queues[0]).toMatchObject({ name: "email", prefix: "stage" });
      },
    );
  });

  it("discovers queues when the configured prefix contains colons", async () => {
    await track(
      await seedBullMqQueue({ prefix: "tenant:bull", name: "email" }),
    );

    await withBullMqProvider(
      { prefixes: ["tenant:bull"] },
      async (provider) => {
        const queues = await provider.getQueues();
        expect(queues).toHaveLength(1);
        expect(queues[0]).toMatchObject({ name: "email", prefix: "tenant:bull" });

        const counts = await provider.getJobCounts("email", "tenant:bull");
        expect(counts.waiting).toBe(3);
      },
    );
  });

  it("returns queues across multiple explicit prefixes with correct prefix fields", async () => {
    await track(await seedBullMqQueue({ prefix: "a", name: "q1" }));
    await track(await seedBullMqQueue({ prefix: "b", name: "q1" }));
    await track(await seedBullMqQueue({ prefix: "b", name: "q2" }));
    await track(await seedBullMqQueue({ prefix: "c", name: "decoy" }));

    await withBullMqProvider(
      { prefixes: ["a", "b"] },
      async (provider) => {
        const queues = await provider.getQueues();
        expect(queues).toHaveLength(3);
        const keys = queues
          .map((q) => `${q.prefix}/${q.name}`)
          .sort();
        expect(keys).toEqual(["a/q1", "b/q1", "b/q2"]);
        expect(queues.some((q) => q.name === "decoy")).toBe(false);
      },
    );
  });

  it("treats the same queue name under different prefixes as distinct", async () => {
    await track(
      await seedBullMqQueue({
        prefix: "a",
        name: "email",
        jobs: [{ name: "j1" }, { name: "j2" }],
      }),
    );
    await track(
      await seedBullMqQueue({
        prefix: "b",
        name: "email",
        jobs: [{ name: "j1" }, { name: "j2" }, { name: "j3" }],
      }),
    );

    await withBullMqProvider(
      { prefixes: ["a", "b"] },
      async (provider) => {
        const qa = await provider.getQueue("email", "a");
        const qb = await provider.getQueue("email", "b");
        expect(qa?.prefix).toBe("a");
        expect(qb?.prefix).toBe("b");
        expect(qa?.jobCounts.waiting).toBe(2);
        expect(qb?.jobCounts.waiting).toBe(3);
      },
    );
  });

  it("caches Queue instances per (prefix, name) composite key", async () => {
    await track(await seedBullMqQueue({ prefix: "a", name: "email" }));
    await track(await seedBullMqQueue({ prefix: "b", name: "email" }));

    await withBullMqProvider(
      { prefixes: ["a", "b"] },
      async (provider) => {
        await provider.getJobCounts("email", "a");
        await provider.getJobCounts("email", "b");

        const internalQueues = (
          provider as unknown as { queues: Map<string, Queue> }
        ).queues;
        expect(internalQueues.has("a\0email")).toBe(true);
        expect(internalQueues.has("b\0email")).toBe(true);
        expect(internalQueues.get("a\0email")).not.toBe(
          internalQueues.get("b\0email"),
        );
      },
    );
  });

  it("auto-discovers prefixes when configured with ['*']", async () => {
    await track(await seedBullMqQueue({ prefix: "stage", name: "q1" }));
    await track(await seedBullMqQueue({ prefix: "prod", name: "q2" }));

    await withBullMqProvider({ prefixes: ["*"] }, async (provider) => {
      expect(await provider.getPrefixes()).toEqual(["prod", "stage"]);
      const queues = await provider.getQueues();
      const keys = queues.map((q) => `${q.prefix}/${q.name}`).sort();
      expect(keys).toEqual(["prod/q2", "stage/q1"]);
    });
  });

  it("falls back to default prefix when auto-discovery finds no keys", async () => {
    await withBullMqProvider({ prefixes: ["*"] }, async (provider) => {
      expect(await provider.getPrefixes()).toEqual(["bull"]);
    });
  });

  it("falls back to the provided config.prefix when ['*'] discovery is empty", async () => {
    await withBullMqProvider(
      { prefixes: ["*"], prefix: "legacy" },
      async (provider) => {
        expect(await provider.getPrefixes()).toEqual(["legacy"]);
      },
    );
  });

  it("scopes getJobs to the given prefix", async () => {
    await track(
      await seedBullMqQueue({
        prefix: "a",
        name: "q",
        jobs: [{ name: "x" }, { name: "x" }, { name: "x" }],
      }),
    );
    await track(
      await seedBullMqQueue({
        prefix: "b",
        name: "q",
        jobs: [{ name: "y" }],
      }),
    );

    await withBullMqProvider(
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

  it("returns null from getJob when the id only exists in another prefix", async () => {
    const seededA = await track(
      await seedBullMqQueue({
        prefix: "a",
        name: "q",
        jobs: [{ name: "only-in-a" }],
      }),
    );
    await track(
      await seedBullMqQueue({ prefix: "b", name: "q", jobs: [] }),
    );

    const waiting = await seededA.queue.getWaiting();
    const jobId = waiting[0]?.id;
    expect(jobId).toBeDefined();

    await withBullMqProvider(
      { prefixes: ["a", "b"] },
      async (provider) => {
        const fromA = await provider.getJob("q", jobId as string, "a");
        const fromB = await provider.getJob("q", jobId as string, "b");
        expect(fromA?.name).toBe("only-in-a");
        expect(fromB).toBeNull();
      },
    );
  });

  it("reports different getJobCounts per prefix", async () => {
    await track(
      await seedBullMqQueue({
        prefix: "a",
        name: "q",
        jobs: [{ name: "x" }, { name: "x" }],
      }),
    );
    await track(
      await seedBullMqQueue({
        prefix: "b",
        name: "q",
        jobs: Array.from({ length: 5 }, (_, i) => ({ name: `y${i}` })),
      }),
    );

    await withBullMqProvider(
      { prefixes: ["a", "b"] },
      async (provider) => {
        const a = await provider.getJobCounts("q", "a");
        const b = await provider.getJobCounts("q", "b");
        expect(a.waiting).toBe(2);
        expect(b.waiting).toBe(5);
      },
    );
  });

  it("pauses only the queue scoped to the given prefix", async () => {
    await track(await seedBullMqQueue({ prefix: "a", name: "q" }));
    await track(await seedBullMqQueue({ prefix: "b", name: "q" }));

    await withBullMqProvider(
      { prefixes: ["a", "b"] },
      async (provider) => {
        await provider.pauseQueue("q", "a");
        const qa = await provider.getQueue("q", "a");
        const qb = await provider.getQueue("q", "b");
        expect(qa?.isPaused).toBe(true);
        expect(qb?.isPaused).toBe(false);
      },
    );
  });

  it("surfaces completed and failed counts produced by real workers", async () => {
    const { completed } = await seedBullMqProcessed({
      prefix: "stage",
      name: "processed-q",
      count: 3,
      shouldFail: false,
    });
    expect(completed).toBe(3);

    await withBullMqProvider(
      { prefixes: ["stage"] },
      async (provider) => {
        const counts = await provider.getJobCounts("processed-q", "stage");
        expect(counts.completed).toBe(3);
        expect(counts.waiting).toBe(0);
      },
    );
  });
});

import { FlowProducer, Queue } from "bullmq";
import Redis, { Cluster } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { disconnectProvider } from "../connection";
import { createStandaloneQueueSource } from "../standalone-source";
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
  const flowPrefix = `${tag}-flow-prefix`;
  let cluster: Cluster;
  let queues: Queue[] = [];
  let flowProducer: FlowProducer;
  let flowQueueName: string;
  let flowId: string;
  const previousRedisUrl = process.env.REDIS_URL;
  const previousRedisPrefix = process.env.REDIS_PREFIX;

  beforeAll(async () => {
    const seed = parseRedisUrl(url);
    cluster = new Cluster([{ host: seed.host, port: seed.port }], {
      redisOptions: { maxRetriesPerRequest: null },
    });
    const flowTag = await findTagOutsideSeedMaster(url, `${tag}-flow`);
    flowQueueName = `{${flowTag}}`;
    queues = [
      new Queue("orders", { connection: cluster, prefix: prefixA }),
      new Queue("emails", { connection: cluster, prefix: prefixB }),
      new Queue(flowQueueName, { connection: cluster, prefix: flowPrefix }),
    ];
    await queues[0]?.add("job-a", { i: 0 });
    await queues[1]?.add("job-b", { i: 1 });
    flowProducer = new FlowProducer({
      connection: cluster,
      prefix: flowPrefix,
    });
    const flow = await flowProducer.add({
      name: "root",
      queueName: flowQueueName,
      data: { level: 0 },
      children: [
        {
          name: "child",
          queueName: flowQueueName,
          data: { level: 1 },
        },
      ],
    });
    flowId = flow.job.id as string;
    process.env.REDIS_URL = url;
    process.env.REDIS_PREFIX = flowPrefix;
  });

  afterAll(async () => {
    await disconnectProvider().catch(() => {});
    await flowProducer?.close().catch(() => {});
    for (const queue of queues) {
      await queue.obliterate({ force: true }).catch(() => {});
      await queue.close().catch(() => {});
    }
    await cluster?.quit().catch(() => {});
    restoreEnv("REDIS_URL", previousRedisUrl);
    restoreEnv("REDIS_PREFIX", previousRedisPrefix);
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

  it("lists and gets a flow stored outside the seed master's slots", async () => {
    const source = createStandaloneQueueSource();

    await expect(source.listFlows({ limit: 50 })).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: flowId,
          queueName: flowQueueName,
          totalJobs: 2,
        }),
      ]),
    );
    await expect(
      source.getFlow({
        flowId,
        queueName: flowQueueName,
        prefix: flowPrefix,
      }),
    ).resolves.toMatchObject({
      id: flowId,
      queueName: flowQueueName,
      totalNodes: 2,
    });
  });
});

type ClusterSlotRange = [
  start: number,
  end: number,
  master: [host: string, port: number, id: string],
];

async function findTagOutsideSeedMaster(
  url: string,
  base: string,
): Promise<string> {
  const seed = new Redis(url, { maxRetriesPerRequest: null });
  try {
    const seedId = String(await seed.cluster("MYID"));
    const slots = (await seed.cluster("SLOTS")) as ClusterSlotRange[];

    for (let index = 0; index < 100; index++) {
      const tag = `${base}-${index}`;
      const slot = Number(await seed.cluster("KEYSLOT", `{${tag}}`));
      const owner = slots.find(([start, end]) => slot >= start && slot <= end);
      if (owner && owner[2][2] !== seedId) {
        return tag;
      }
    }
  } finally {
    await seed.quit().catch(() => {});
  }

  throw new Error("Could not find a hash tag outside the seed master's slots");
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

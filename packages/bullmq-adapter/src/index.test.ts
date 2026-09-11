import { createBullMqQueueAdapter } from "@bullstudio/bullmq-adapter";
import type { QueueAdapter } from "@bullstudio/embedded-core";
import type { FlowProducer, Queue } from "bullmq";
import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";

const getFlow = vi.fn<FlowProducer["getFlow"]>();

vi.mock("bullmq", async (importOriginal) => {
  const actual = await importOriginal<typeof import("bullmq")>();

  return {
    ...actual,
    FlowProducer: vi.fn(() => ({
      getFlow,
    })),
  };
});

describe("createBullMqQueueAdapter", () => {
  beforeEach(() => {
    getFlow.mockReset();
  });

  it("wraps a host-owned BullMQ queue with inferred identity and capabilities", () => {
    const queue = { name: "email" } as Queue;

    const adapter = createBullMqQueueAdapter(queue);

    expectTypeOf(adapter).toMatchTypeOf<QueueAdapter>();
    expect(adapter).toMatchObject({
      key: "email",
      label: "email",
      provider: "bullmq",
      capabilities: {
        flows: true,
        jobLogs: true,
        jobRemoval: true,
        jobRetry: true,
        queuePause: true,
        queueResume: true,
        queueDrain: true,
        workers: true,
      },
    });
  });

  it("uses explicit queue key and label overrides", () => {
    const queue = { name: "email" } as Queue;

    const adapter = createBullMqQueueAdapter(queue, {
      key: "critical-email",
      label: "Critical email",
    });

    expect(adapter.key).toBe("critical-email");
    expect(adapter.label).toBe("Critical email");
  });

  it("reads queue state and counts from the supplied queue", async () => {
    const queue = {
      name: "email",
      opts: { prefix: "production" },
      isPaused: async () => true,
      getJobCounts: async () => ({
        waiting: 2,
        active: 1,
        completed: 3,
        failed: 4,
        delayed: 5,
        paused: 6,
        prioritized: 7,
        "waiting-children": 8,
      }),
    } as unknown as Queue;

    const adapter = createBullMqQueueAdapter(queue);

    await expect(adapter.getQueue()).resolves.toEqual({
      name: "email",
      prefix: "production",
      isPaused: true,
      jobCounts: {
        waiting: 2,
        active: 1,
        completed: 3,
        failed: 4,
        delayed: 5,
        paused: 6,
        prioritized: 7,
        waitingChildren: 8,
      },
    });
  });

  it("reads jobs from the supplied queue", async () => {
    const queue = {
      name: "email",
      getJobs: async () => [
        {
          id: "1",
          name: "welcome",
          data: { userId: 123 },
          progress: 50,
          attemptsMade: 1,
          opts: { attempts: 3, delay: 10, priority: 2 },
          failedReason: undefined,
          stacktrace: [],
          returnvalue: { ok: true },
          timestamp: 100,
          processedOn: 110,
          finishedOn: undefined,
          parentKey: "bull:parent:42",
          repeatJobKey: "repeat:welcome",
          getState: async () => "active",
        },
      ],
    } as unknown as Queue;

    const adapter = createBullMqQueueAdapter(queue);

    await expect(adapter.getJobs()).resolves.toEqual([
      {
        id: "1",
        name: "welcome",
        queueName: "email",
        data: { userId: 123 },
        status: "active",
        progress: 50,
        attemptsMade: 1,
        attemptsLimit: 3,
        failedReason: undefined,
        stacktrace: [],
        returnValue: { ok: true },
        timestamp: 100,
        processedOn: 110,
        finishedOn: undefined,
        delay: 10,
        priority: 2,
        parentId: "42",
        repeatJobKey: "repeat:welcome",
      },
    ]);
  });

  it("applies name filtering and sorting when reading job summaries", async () => {
    const queue = {
      name: "email",
      getJobs: async () => [
        createQueueJob({ id: "1", name: "digest", timestamp: 300 }),
        createQueueJob({ id: "2", name: "welcome", timestamp: 100 }),
        createQueueJob({ id: "3", name: "welcome", timestamp: 200 }),
      ],
    } as unknown as Queue;

    const adapter = createBullMqQueueAdapter(queue);

    await expect(
      adapter.getJobsSummary({
        filter: { name: "welcome" },
        sort: { field: "timestamp", order: "desc" },
      }),
    ).resolves.toEqual([
      {
        id: "3",
        name: "welcome",
        queueName: "email",
        status: "waiting",
        progress: 0,
        attemptsMade: 0,
        failedReason: undefined,
        timestamp: 200,
        processedOn: undefined,
        finishedOn: undefined,
        delay: undefined,
        priority: undefined,
        parentId: undefined,
        repeatJobKey: undefined,
      },
      {
        id: "2",
        name: "welcome",
        queueName: "email",
        status: "waiting",
        progress: 0,
        attemptsMade: 0,
        failedReason: undefined,
        timestamp: 100,
        processedOn: undefined,
        finishedOn: undefined,
        delay: undefined,
        priority: undefined,
        parentId: undefined,
        repeatJobKey: undefined,
      },
    ]);
  });

  it("delegates job and queue operations without closing the supplied queue", async () => {
    const retry = vi.fn<() => Promise<void>>();
    const remove = vi.fn<() => Promise<void>>();
    const retryJobs = vi.fn<() => Promise<void>>();
    const close = vi.fn<() => Promise<void>>();
    const queue = {
      name: "email",
      getJob: async () => ({
        id: "1",
        name: "welcome",
        data: {},
        progress: 0,
        attemptsMade: 0,
        opts: {},
        stacktrace: [],
        timestamp: 100,
        getState: async () => "waiting",
        retry,
        remove,
      }),
      getJobLogs: async () => ({ logs: ["created"], count: 1 }),
      getJobCountByTypes: vi
        .fn<() => Promise<number>>()
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(0),
      retryJobs,
      pause: vi.fn<() => Promise<void>>(),
      resume: vi.fn<() => Promise<void>>(),
      client: Promise.resolve({
        clientList: async () =>
          "id=1 addr=10.0.0.1:5000 fd=8 name=bull:email:w:w1 age=5 idle=1\n" +
          "id=2 addr=10.0.0.1:5001 fd=9 name=bull:ZW1haWw=:w:w2 age=6 idle=2",
      }),
      close,
    } as unknown as Queue;

    const adapter = createBullMqQueueAdapter(queue);

    await expect(adapter.getJob("1")).resolves.toMatchObject({
      id: "1",
      name: "welcome",
      queueName: "email",
      status: "waiting",
    });
    await expect(adapter.getJobLogs("1")).resolves.toEqual({
      logs: ["created"],
      count: 1,
    });
    await adapter.pauseQueue();
    await adapter.resumeQueue();
    await adapter.retryJob("1");
    await expect(adapter.retryFailedJobs()).resolves.toBe(2);
    expect(retryJobs).toHaveBeenCalledWith({ state: "failed", count: 1000 });
    await adapter.removeJob("1");
    await expect(adapter.getWorkerCount()).resolves.toEqual({
      queueName: "email",
      count: 2,
    });
    await expect(adapter.listWorkers?.()).resolves.toMatchObject([
      { name: "email", queueName: "email", address: "10.0.0.1:5000", age: 5 },
      { name: "email", queueName: "email", address: "10.0.0.1:5001", age: 6 },
    ]);

    expect(queue.pause).toHaveBeenCalledOnce();
    expect(queue.resume).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(adapter).not.toHaveProperty("close");
    expect(adapter).not.toHaveProperty("disconnect");
  });

  it("maps BullMQ worker client metadata and preserves the raw client name", async () => {
    const queue = {
      name: "email",
      opts: { prefix: "production" },
      client: Promise.resolve({
        clientList: async () =>
          "id=42 addr=127.0.0.1:6379 fd=7 name=production:email:w:worker-a age=12 idle=2",
      }),
    } as unknown as Queue;

    const adapter = createBullMqQueueAdapter(queue);

    await expect(adapter.listWorkers?.()).resolves.toEqual([
      {
        id: "production:email:email:127.0.0.1:6379:7",
        name: "email",
        queueName: "email",
        prefix: "production",
        provider: "bullmq",
        address: "127.0.0.1:6379",
        age: 12,
        idle: 2,
        metadata: {
          id: "42",
          addr: "127.0.0.1:6379",
          fd: "7",
          name: "email",
          age: "12",
          idle: "2",
          rawname: "production:email:w:worker-a",
        },
      },
    ]);
  });

  it("returns an empty BullMQ worker list", async () => {
    const queue = {
      name: "email",
      client: Promise.resolve({
        clientList: async () =>
          "id=1 addr=127.0.0.1:6379 fd=5 name=bull:other:w:x age=1 idle=0",
      }),
    } as unknown as Queue;

    const adapter = createBullMqQueueAdapter(queue);

    await expect(adapter.listWorkers?.()).resolves.toEqual([]);
    await expect(adapter.getWorkerCount()).resolves.toEqual({
      queueName: "email",
      count: 0,
    });
  });

  it("matches workers registered with plain and base64 client names", async () => {
    // Node BullMQ registers `bull:base64(name)`; the Python/Bull ports use the
    // plain `bull:name`. Both encodings (and their `:w:` named forms) must match,
    // while similarly-prefixed queues (e.g. `emailish`) must not.
    const queue = {
      name: "email",
      client: Promise.resolve({
        clientList: async () =>
          "id=1 addr=1.1.1.1:1 fd=1 name=bull:email age=1 idle=0\n" +
          "id=2 addr=1.1.1.1:2 fd=2 name=bull:email:w:py age=1 idle=0\n" +
          "id=3 addr=1.1.1.1:3 fd=3 name=bull:ZW1haWw= age=1 idle=0\n" +
          "id=4 addr=1.1.1.1:4 fd=4 name=bull:ZW1haWw=:w:node age=1 idle=0\n" +
          "id=5 addr=1.1.1.1:5 fd=5 name=bull:emailish:w:y age=1 idle=0\n" +
          "id=6 addr=1.1.1.1:6 fd=6 name=bull:other age=1 idle=0\n" +
          "id=7 addr=1.1.1.1:7 fd=7 name= age=1 idle=0",
      }),
    } as unknown as Queue;

    const adapter = createBullMqQueueAdapter(queue);

    await expect(adapter.getWorkerCount()).resolves.toEqual({
      queueName: "email",
      count: 4,
    });

    const workers = await adapter.listWorkers?.();
    expect(workers?.map((worker) => worker.metadata.rawname)).toEqual([
      "bull:email",
      "bull:email:w:py",
      "bull:ZW1haWw=",
      "bull:ZW1haWw=:w:node",
    ]);
  });

  it("fans out over Redis Cluster nodes and keeps the node with the most workers", async () => {
    const queue = {
      name: "email",
      client: Promise.resolve({
        isCluster: true,
        nodes: () => [
          {
            clientList: async () =>
              "id=1 addr=1.1.1.1:1 fd=1 name=bull:email:w:a age=1 idle=0",
          },
          {
            clientList: async () =>
              "id=2 addr=1.1.1.1:2 fd=2 name=bull:email:w:a age=1 idle=0\n" +
              "id=3 addr=1.1.1.1:3 fd=3 name=bull:email:w:b age=1 idle=0",
          },
        ],
      }),
    } as unknown as Queue;

    const adapter = createBullMqQueueAdapter(queue);

    await expect(adapter.getWorkerCount()).resolves.toEqual({
      queueName: "email",
      count: 2,
    });
  });

  it("degrades gracefully when Redis blocks the CLIENT command", async () => {
    const queue = {
      name: "email",
      client: Promise.resolve({
        clientList: async () => {
          throw new Error("ERR unknown command 'client'");
        },
      }),
    } as unknown as Queue;

    const adapter = createBullMqQueueAdapter(queue);

    await expect(adapter.getWorkerCount()).resolves.toEqual({
      queueName: "email",
      count: 1,
    });
  });

  it("rethrows unexpected CLIENT LIST errors", async () => {
    const queue = {
      name: "email",
      client: Promise.resolve({
        clientList: async () => {
          throw new Error("READONLY You can't write against a read only replica");
        },
      }),
    } as unknown as Queue;

    const adapter = createBullMqQueueAdapter(queue);

    await expect(adapter.getWorkerCount()).rejects.toThrow(/READONLY/);
  });

  it("lists and reads BullMQ flows from the supplied queue", async () => {
    const flowTree = {
      job: createFlowJob({
        id: "parent",
        name: "send-campaign",
        queueName: "email",
        state: "waiting-children",
        timestamp: 300,
      }),
      children: [
        {
          job: createFlowJob({
            id: "child-1",
            name: "send-message",
            queueName: "email",
            state: "completed",
            timestamp: 100,
          }),
        },
        {
          job: createFlowJob({
            id: "child-2",
            name: "send-message",
            queueName: "email",
            state: "failed",
            timestamp: 200,
            failedReason: "SMTP unavailable",
          }),
        },
      ],
    };
    getFlow.mockResolvedValue(flowTree);
    const queue = {
      name: "email",
      opts: { prefix: "production", connection: {} },
      getJobs: vi
        .fn()
        .mockResolvedValueOnce([
          createQueueJob({
            id: "parent",
            name: "send-campaign",
            timestamp: 300,
          }),
        ])
        .mockResolvedValueOnce([]),
    } as unknown as Queue;

    const adapter = createBullMqQueueAdapter(queue);

    await expect(adapter.listFlows?.()).resolves.toEqual([
      {
        id: "parent",
        name: "send-campaign",
        queueName: "email",
        prefix: "production",
        status: "waiting-children",
        totalJobs: 3,
        completedJobs: 1,
        failedJobs: 1,
        timestamp: 300,
      },
    ]);
    await expect(adapter.getFlow?.("parent")).resolves.toEqual({
      id: "parent",
      queueName: "email",
      totalNodes: 3,
      completedNodes: 1,
      failedNodes: 1,
      root: {
        id: "parent",
        name: "send-campaign",
        queueName: "email",
        status: "waiting-children",
        data: {},
        timestamp: 300,
        processedOn: undefined,
        finishedOn: undefined,
        failedReason: undefined,
        children: [
          {
            id: "child-1",
            name: "send-message",
            queueName: "email",
            status: "completed",
            data: {},
            timestamp: 100,
            processedOn: undefined,
            finishedOn: undefined,
            failedReason: undefined,
            children: [],
          },
          {
            id: "child-2",
            name: "send-message",
            queueName: "email",
            status: "failed",
            data: {},
            timestamp: 200,
            processedOn: undefined,
            finishedOn: undefined,
            failedReason: "SMTP unavailable",
            children: [],
          },
        ],
      },
    });
    expect(getFlow).toHaveBeenCalledWith({
      id: "parent",
      queueName: "email",
      prefix: "production",
    });
  });
});

function createQueueJob(overrides: {
  id: string;
  name: string;
  timestamp: number;
}) {
  return {
    data: { userId: 123 },
    progress: 0,
    attemptsMade: 0,
    opts: {},
    failedReason: undefined,
    stacktrace: [],
    returnvalue: { ok: true },
    processedOn: undefined,
    finishedOn: undefined,
    getState: async () => "waiting",
    ...overrides,
  };
}

function createFlowJob(options: {
  id: string;
  name: string;
  queueName: string;
  state: string;
  timestamp: number;
  failedReason?: string;
}) {
  return {
    id: options.id,
    name: options.name,
    queueName: options.queueName,
    data: {},
    timestamp: options.timestamp,
    processedOn: undefined,
    finishedOn: undefined,
    failedReason: options.failedReason,
    getState: async () => options.state,
  };
}

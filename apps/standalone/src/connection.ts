import { FlowProducer } from "bullmq";
import { getPrefixes } from "./prefixes";
import {
  createQueueProvider,
  type QueueService,
  type QueueServiceConfig,
} from "./queue";
import {
  createRedisConnection,
  type RedisConnection,
  redisReconnectStrategy,
} from "./queue/utils";

let provider: QueueService | null = null;
let providerRedisUrl: string | null = null;
let connectingPromise: Promise<QueueService> | null = null;
let flowProducer: FlowProducer | null = null;
let flowConnection: RedisConnection | null = null;

function getRedisUrl(): string {
  return process.env.REDIS_URL || "redis://localhost:6379";
}

export const getQueueProvider = async (): Promise<QueueService> => {
  const redisUrl = getRedisUrl();

  if (provider && providerRedisUrl !== redisUrl) {
    await disconnectCurrentProvider();
  }

  if (provider) {
    return provider;
  }

  if (!connectingPromise) {
    connectingPromise = (async () => {
      try {
        const cfg: QueueServiceConfig = {
          redisUrl,
          prefixes: getPrefixes(),
        };
        const p = await createQueueProvider(cfg);
        await p.connect();
        providerRedisUrl = redisUrl;
        provider = p;

        const caps = p.getCapabilities();
        console.log(
          `[CLI] Connected to ` +
            `${caps.displayName} ` +
            `(${p.providerType})`,
        );
        return p;
      } catch (error) {
        provider = null;
        providerRedisUrl = null;
        throw error;
      } finally {
        connectingPromise = null;
      }
    })();
  }

  return connectingPromise;
};

export const getFlowProducer = async (): Promise<FlowProducer> => {
  if (flowProducer) {
    return flowProducer;
  }

  const currentProvider = await getQueueProvider();
  // Another caller may have created the producer while we awaited the provider.
  if (flowProducer) {
    return flowProducer;
  }

  const connection = createRedisConnection(getRedisUrl(), {
    cluster: currentProvider.cluster,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy: redisReconnectStrategy,
    commandTimeout: 10000,
  });
  const producer = new FlowProducer({ connection });
  // FlowProducer re-emits Redis connection errors on itself. Without a
  // listener Node treats an emitted "error" as fatal and crashes the process
  // when the connection drops.
  producer.on("error", (error) => {
    console.error("[Standalone] FlowProducer error:", error.message);
  });
  flowConnection = connection;
  flowProducer = producer;
  return producer;
};

export const disconnectProvider = async (): Promise<void> => {
  await disconnectCurrentProvider();
};

async function disconnectCurrentProvider(): Promise<void> {
  const currentFlowProducer = flowProducer;
  const currentFlowConnection = flowConnection;
  flowProducer = null;
  flowConnection = null;

  try {
    await currentFlowProducer?.close();
  } finally {
    await currentFlowConnection?.quit().catch(() => {});
  }

  if (provider) {
    await provider.disconnect();
  }
  provider = null;
  providerRedisUrl = null;
  connectingPromise = null;
}

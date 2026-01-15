import { TRPCError } from "@trpc/server";
import { AlertType, AlertStatus } from "@bullstudio/prisma";
import { getConnectionManager } from "@bullstudio/queue";
import type { Job } from "@bullstudio/connect-types";
import type { AuthedTRPCContext } from "../../types";
import type {
  TestAlertInput,
  FailureRateConfig,
  BacklogConfig,
  ProcessingTimeConfig,
  MissingWorkersConfig,
} from "./alert.schema";

type TestAlertHandlerProps = {
  ctx: AuthedTRPCContext;
  input: TestAlertInput;
};

type EvaluationResult = {
  currentValue: number;
  threshold: number;
  wouldTrigger: boolean;
  message: string;
};

export async function testAlertHandler({ ctx, input }: TestAlertHandlerProps) {
  const { prisma, user } = ctx;

  const alert = await prisma.alert.findUnique({
    where: { id: input.id },
    include: {
      connection: {
        include: {
          workspace: {
            include: {
              members: { where: { userId: user.id } },
            },
          },
        },
      },
    },
  });

  if (!alert) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Alert not found",
    });
  }

  if (alert.connection.workspace.members.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this alert",
    });
  }

  const connectionManager = getConnectionManager(prisma);
  const service = await connectionManager.getConnection(alert.connectionId);

  if (!service) {
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Connection is not available",
    });
  }

  const result = await evaluateAlert(
    alert.type,
    alert.config as Record<string, unknown>,
    alert.queueName,
    service
  );

  return {
    alertId: alert.id,
    alertName: alert.name,
    currentStatus: alert.status,
    evaluation: result,
  };
}

async function evaluateAlert(
  type: AlertType,
  config: Record<string, unknown>,
  queueName: string,
  service: Awaited<ReturnType<ReturnType<typeof getConnectionManager>["getConnection"]>>
): Promise<EvaluationResult> {
  if (!service) {
    throw new Error("Service not available");
  }

  switch (type) {
    case AlertType.FailureRate:
      return evaluateFailureRate(config as FailureRateConfig, queueName, service);

    case AlertType.BacklogExceeded:
      return evaluateBacklog(config as BacklogConfig, queueName, service);

    case AlertType.ProcessingTimeAvg:
      return evaluateProcessingTime(config as ProcessingTimeConfig, queueName, service, "avg");

    case AlertType.ProcessingTimeP95:
      return evaluateProcessingTime(config as ProcessingTimeConfig, queueName, service, "p95");

    case AlertType.ProcessingTimeP99:
      return evaluateProcessingTime(config as ProcessingTimeConfig, queueName, service, "p99");

    case AlertType.MissingWorkers:
      return evaluateMissingWorkers(config as MissingWorkersConfig, queueName, service);

    default:
      throw new Error(`Unknown alert type: ${type}`);
  }
}

async function evaluateFailureRate(
  config: FailureRateConfig,
  queueName: string,
  service: NonNullable<Awaited<ReturnType<ReturnType<typeof getConnectionManager>["getConnection"]>>>
): Promise<EvaluationResult> {
  const cutoffTime = Date.now() - config.timeWindowMinutes * 60 * 1000;

  const [completed, failed] = await Promise.all([
    service.getJobs(queueName, {
      filter: { status: "completed" },
      sort: { field: "finishedOn", order: "desc" },
      limit: 1000,
    }),
    service.getJobs(queueName, {
      filter: { status: "failed" },
      sort: { field: "finishedOn", order: "desc" },
      limit: 1000,
    }),
  ]);

  const recentCompleted = completed.filter(
    (j) => j.finishedOn && j.finishedOn >= cutoffTime
  ).length;
  const recentFailed = failed.filter(
    (j) => j.finishedOn && j.finishedOn >= cutoffTime
  ).length;

  const total = recentCompleted + recentFailed;
  const failureRate = total > 0 ? (recentFailed / total) * 100 : 0;

  return {
    currentValue: failureRate,
    threshold: config.threshold,
    wouldTrigger: failureRate > config.threshold,
    message: `Failure rate: ${failureRate.toFixed(1)}% (${recentFailed}/${total} jobs in last ${config.timeWindowMinutes}min)`,
  };
}

async function evaluateBacklog(
  config: BacklogConfig,
  queueName: string,
  service: NonNullable<Awaited<ReturnType<ReturnType<typeof getConnectionManager>["getConnection"]>>>
): Promise<EvaluationResult> {
  const jobCounts = await service.getJobCounts(queueName);
  const backlog = jobCounts.waiting + jobCounts.delayed;

  return {
    currentValue: backlog,
    threshold: config.threshold,
    wouldTrigger: backlog > config.threshold,
    message: `Backlog: ${backlog} jobs (waiting: ${jobCounts.waiting}, delayed: ${jobCounts.delayed})`,
  };
}

async function evaluateProcessingTime(
  config: ProcessingTimeConfig,
  queueName: string,
  service: NonNullable<Awaited<ReturnType<ReturnType<typeof getConnectionManager>["getConnection"]>>>,
  percentile: "avg" | "p95" | "p99"
): Promise<EvaluationResult> {
  const cutoffTime = Date.now() - config.timeWindowMinutes * 60 * 1000;

  const completed = await service.getJobs(queueName, {
    filter: { status: "completed" },
    sort: { field: "finishedOn", order: "desc" },
    limit: 1000,
  });

  const recentJobs = completed.filter(
    (j) => j.finishedOn && j.finishedOn >= cutoffTime && j.processedOn
  );

  if (recentJobs.length === 0) {
    return {
      currentValue: 0,
      threshold: config.threshold,
      wouldTrigger: false,
      message: `No completed jobs in last ${config.timeWindowMinutes}min to calculate processing time`,
    };
  }

  const processingTimes = recentJobs
    .map((j) => j.finishedOn! - j.processedOn!)
    .sort((a, b) => a - b);

  let value: number;
  let label: string;

  if (percentile === "avg") {
    value = processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length;
    label = "Average";
  } else if (percentile === "p95") {
    const idx = Math.floor(processingTimes.length * 0.95);
    value = processingTimes[idx] ?? 0;
    label = "P95";
  } else {
    const idx = Math.floor(processingTimes.length * 0.99);
    value = processingTimes[idx] ?? 0;
    label = "P99";
  }

  return {
    currentValue: value,
    threshold: config.threshold,
    wouldTrigger: value > config.threshold,
    message: `${label} processing time: ${formatMs(value)} (from ${recentJobs.length} jobs in last ${config.timeWindowMinutes}min)`,
  };
}

async function evaluateMissingWorkers(
  config: MissingWorkersConfig,
  queueName: string,
  service: NonNullable<Awaited<ReturnType<ReturnType<typeof getConnectionManager>["getConnection"]>>>
): Promise<EvaluationResult> {
  const workerCount = await service.getWorkerCount(queueName);

  return {
    currentValue: workerCount.count,
    threshold: 1,
    wouldTrigger: workerCount.count === 0,
    message: `Worker count: ${workerCount.count}`,
  };
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

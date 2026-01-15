import { Worker, Job } from "bullmq";
import { AlertStatus } from "@bullstudio/prisma";
import { getConnectionManager } from "@bullstudio/queue";
import { redis } from "../lib/redis";
import { prisma } from "../lib/prisma";
import { ALERT_CHECK_QUEUE_NAME, type AlertCheckJobData } from "../queues/alert-check";
import { emailQueue, type EmailJobData } from "../queues/email";
import { evaluateAlert, type AlertConfig } from "../evaluators";

export function createAlertCheckerWorker() {
  const worker = new Worker<AlertCheckJobData>(
    ALERT_CHECK_QUEUE_NAME,
    async (job: Job<AlertCheckJobData>) => {
      console.log(`[AlertChecker] Starting alert check at ${new Date().toISOString()}`);

      const connectionManager = getConnectionManager(prisma);

      // Fetch all enabled alerts
      const alerts = await prisma.alert.findMany({
        where: { enabled: true },
        include: {
          connection: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      console.log(`[AlertChecker] Processing ${alerts.length} alerts`);

      let processed = 0;
      let triggered = 0;
      let resolved = 0;
      let errors = 0;

      for (const alert of alerts) {
        try {
          // Skip if connection is not connected
          if (alert.connection.status !== "Connected") {
            console.log(
              `[AlertChecker] Skipping alert ${alert.id} - connection not connected`
            );
            continue;
          }

          const service = await connectionManager.getConnection(
            alert.connection.id
          );

          if (!service) {
            console.log(
              `[AlertChecker] Skipping alert ${alert.id} - service not available`
            );
            continue;
          }

          // Evaluate the alert
          const result = await evaluateAlert(
            alert.type,
            alert.config as AlertConfig,
            alert.queueName,
            service,
            alert.status
          );

          const statusChanged = result.status !== alert.status;
          const now = new Date();

          // Update alert state
          await prisma.alert.update({
            where: { id: alert.id },
            data: {
              status: result.status,
              lastCheckedAt: now,
              lastValue: result.value,
              ...(statusChanged && result.status === AlertStatus.Triggered
                ? { lastTriggeredAt: now }
                : {}),
              ...(statusChanged && result.status === AlertStatus.OK
                ? { lastResolvedAt: now }
                : {}),
            },
          });

          // Create history record if status changed
          if (statusChanged) {
            await prisma.alertHistory.create({
              data: {
                alertId: alert.id,
                status: result.status,
                value: result.value,
                message: result.message,
              },
            });

            // Check if we should send notification
            const shouldNotify = shouldSendNotification(
              alert.status,
              result.status,
              alert.lastTriggeredAt,
              alert.cooldownMinutes
            );

            if (shouldNotify && alert.recipients.length > 0) {
              const emailJobData: EmailJobData = {
                type:
                  result.status === AlertStatus.Triggered
                    ? "alert-triggered"
                    : "alert-resolved",
                recipients: alert.recipients,
                alertId: alert.id,
                alertName: alert.name,
                alertType: alert.type,
                queueName: alert.queueName,
                connectionName: alert.connection.name,
                status: result.status,
                value: result.value,
                message: result.message,
                timestamp: Date.now(),
              };

              await emailQueue.add("send-alert-email", emailJobData);
            }

            if (result.status === AlertStatus.Triggered) {
              triggered++;
            } else {
              resolved++;
            }
          }

          processed++;
        } catch (error) {
          console.error(`[AlertChecker] Error evaluating alert ${alert.id}:`, error);
          errors++;
        }
      }

      console.log(
        `[AlertChecker] Completed: ${processed} processed, ${triggered} triggered, ${resolved} resolved, ${errors} errors`
      );

      return { processed, triggered, resolved, errors };
    },
    {
      connection: redis,
      concurrency: 1,
    }
  );

  worker.on("completed", (job: Job<AlertCheckJobData>) => {
    console.log(`[AlertChecker] Job ${job.id} completed`);
  });

  worker.on("failed", (job: Job<AlertCheckJobData> | undefined, error: Error) => {
    console.error(`[AlertChecker] Job ${job?.id} failed:`, error);
  });

  return worker;
}

function shouldSendNotification(
  previousStatus: AlertStatus,
  newStatus: AlertStatus,
  lastTriggeredAt: Date | null,
  cooldownMinutes: number
): boolean {
  // Always notify on resolve
  if (newStatus === AlertStatus.OK) {
    return true;
  }

  // For triggers, check cooldown
  if (newStatus === AlertStatus.Triggered) {
    if (!lastTriggeredAt) {
      return true; // First trigger
    }

    const cooldownMs = cooldownMinutes * 60 * 1000;
    const timeSinceLastTrigger = Date.now() - lastTriggeredAt.getTime();

    return timeSinceLastTrigger >= cooldownMs;
  }

  return false;
}

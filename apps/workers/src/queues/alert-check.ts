import { Queue } from "bullmq";
import { redis } from "../lib/redis";

export const ALERT_CHECK_QUEUE_NAME = "alert-check";

export type AlertCheckJobData = {
  timestamp: number;
};

export const alertCheckQueue = new Queue<AlertCheckJobData>(
  ALERT_CHECK_QUEUE_NAME,
  {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
    },
  }
);

export async function scheduleAlertChecks() {
  // Remove any existing repeatable jobs
  const existingJobs = await alertCheckQueue.getRepeatableJobs();
  for (const job of existingJobs) {
    await alertCheckQueue.removeRepeatableByKey(job.key);
  }

  // Schedule alert checks every 1 minute
  await alertCheckQueue.add(
    "check-alerts",
    { timestamp: Date.now() },
    {
      repeat: {
        every: 30 * 1000, // 30 seconds
      },
    }
  );

  console.log("[AlertCheck] Scheduled alert checks every 30 seconds");
}

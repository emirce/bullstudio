/**
 * Script to generate random Bull jobs for testing.
 * Run with: npx tsx scripts/generate-bull-jobs.ts
 */

import Bull from "bull";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const QUEUE_NAMES = ["email-queue", "payment-processing", "notifications", "data-sync"];

const JOB_TYPES = [
  "send-welcome-email",
  "send-password-reset",
  "process-payment",
  "refund-payment",
  "send-push-notification",
  "send-sms",
  "sync-user-data",
  "export-report",
  "generate-invoice",
  "cleanup-expired-sessions",
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateJobData() {
  return {
    userId: `user_${randomInt(1000, 9999)}`,
    email: `user${randomInt(1, 100)}@example.com`,
    amount: randomInt(10, 1000),
    currency: randomElement(["USD", "EUR", "GBP"]),
    timestamp: Date.now(),
    metadata: {
      source: randomElement(["web", "mobile", "api"]),
      region: randomElement(["us-east", "us-west", "eu-west", "ap-south"]),
    },
  };
}

async function createProcessor(queue: Bull.Queue, shouldFail: boolean = false) {
  queue.process(async (job) => {
    // Simulate work
    const workTime = randomInt(100, 500);
    await new Promise((resolve) => setTimeout(resolve, workTime));

    if (shouldFail) {
      throw new Error(`Simulated failure for job ${job.id}`);
    }

    return { processed: true, duration: workTime };
  });
}

async function main() {
  console.log("Generating Bull test jobs...");
  console.log(`Redis URL: ${REDIS_URL}`);

  const queues: Bull.Queue[] = [];

  try {
    // Create queues
    for (const queueName of QUEUE_NAMES) {
      const queue = new Bull(queueName, REDIS_URL);
      queues.push(queue);
      console.log(`Created queue: ${queueName}`);
    }

    // Generate jobs for each queue
    for (const queue of queues) {
      const jobCount = randomInt(10, 25);
      console.log(`\nAdding ${jobCount} jobs to ${queue.name}...`);

      for (let i = 0; i < jobCount; i++) {
        const jobType = randomElement(JOB_TYPES);
        const jobData = generateJobData();

        // Randomly assign different job configurations
        const rand = Math.random();

        if (rand < 0.3) {
          // 30% - Regular jobs (will be processed immediately)
          await queue.add(jobType, jobData);
        } else if (rand < 0.5) {
          // 20% - Delayed jobs
          const delay = randomInt(5000, 60000); // 5s to 60s delay
          await queue.add(jobType, jobData, { delay });
          console.log(`  Added delayed job: ${jobType} (delay: ${delay}ms)`);
        } else if (rand < 0.7) {
          // 20% - Jobs with priority
          const priority = randomInt(1, 10);
          await queue.add(jobType, jobData, { priority });
        } else if (rand < 0.85) {
          // 15% - Jobs with retry attempts
          await queue.add(jobType, jobData, {
            attempts: randomInt(2, 5),
            backoff: { type: "exponential", delay: 1000 },
          });
        } else {
          // 15% - Jobs that will be removed on completion
          await queue.add(jobType, jobData, {
            removeOnComplete: true,
          });
        }
      }

      console.log(`  Added ${jobCount} jobs to ${queue.name}`);
    }

    // Process some jobs to create completed/failed states
    console.log("\nProcessing some jobs to create different states...");

    // Process jobs with success
    const successQueue = queues[0];
    createProcessor(successQueue, false);

    // Process jobs with some failures
    const failQueue = queues[1];
    createProcessor(failQueue, true);

    // Wait for some processing
    console.log("Waiting for job processing (10 seconds)...");
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Print summary
    console.log("\n=== Summary ===");
    for (const queue of queues) {
      const counts = await queue.getJobCounts();
      console.log(`${queue.name}:`);
      console.log(`  Waiting: ${counts.waiting}`);
      console.log(`  Active: ${counts.active}`);
      console.log(`  Completed: ${counts.completed}`);
      console.log(`  Failed: ${counts.failed}`);
      console.log(`  Delayed: ${counts.delayed}`);
    }

    // Close queues
    console.log("\nClosing queues...");
    for (const queue of queues) {
      await queue.close();
    }

    console.log("\nDone! You can now run bullstudio to view the jobs.");
    console.log("Run: REDIS_URL=" + REDIS_URL + " pnpm start");

  } catch (error) {
    console.error("Error:", error);
    // Cleanup
    for (const queue of queues) {
      await queue.close().catch(() => {});
    }
    process.exit(1);
  }
}

main();

import { Queue, Worker } from "bullmq";

const connection = { host: "localhost", port: 6378 };

const QUEUE_NAME = "large-payload-test";

// Generate a ~5MB payload
function generateLargePayload(sizeInMB: number): Record<string, unknown> {
  const targetBytes = sizeInMB * 1024 * 1024;
  const baseString = "x".repeat(1024); // 1KB string
  const entries: string[] = [];

  // Each entry is ~1KB, so we need ~5000 entries for 5MB
  const numEntries = Math.ceil(targetBytes / 1024);

  for (let i = 0; i < numEntries; i++) {
    entries.push(baseString);
  }

  return {
    description: "This is a test job with a very large payload (~5MB)",
    timestamp: new Date().toISOString(),
    metadata: {
      testType: "large-payload",
      targetSizeMB: sizeInMB,
      generatedAt: Date.now(),
    },
    largeData: entries,
    nestedObject: {
      level1: {
        level2: {
          level3: {
            data: entries.slice(0, 100),
          },
        },
      },
    },
  };
}

async function main() {
  console.log("Creating queue and adding job with ~5MB payload...");

  const queue = new Queue(QUEUE_NAME, { connection });

  // Generate the large payload
  const payload = generateLargePayload(5);
  const payloadSize = Buffer.byteLength(JSON.stringify(payload));
  console.log(`Payload size: ${(payloadSize / 1024 / 1024).toFixed(2)} MB`);

  // Add the job to the queue
  const job = await queue.add("large-payload-job", payload, {
    attempts: 1, // Only 1 attempt so it fails immediately
    removeOnFail: false, // Keep the job in Redis after failure
    removeOnComplete: false,
  });

  console.log(`Job ${job.id} added to queue "${QUEUE_NAME}"`);

  // Create a worker that will fail the job
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      console.log(`Processing job ${job.id}...`);
      // Simulate some work then fail
      await new Promise((resolve) => setTimeout(resolve, 500));
      throw new Error(
        "Intentional failure for testing large payload display in UI"
      );
    },
    {
      connection,
      concurrency: 1,
    }
  );

  worker.on("failed", async (job, err) => {
    console.log(`Job ${job?.id} failed with error: ${err.message}`);
    console.log("Job is now in failed state and kept in Redis for UI testing");

    // Close worker and queue after job fails
    await worker.close();
    await queue.close();
    process.exit(0);
  });

  worker.on("error", (err) => {
    console.error("Worker error:", err);
  });

  console.log("Worker started, waiting for job to be processed and fail...");
}

main().catch(console.error);

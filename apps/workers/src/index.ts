import "dotenv/config";

import { scheduleAlertChecks } from "./queues/alert-check";
import { createAlertCheckerWorker } from "./workers/alert-checker";
import { createEmailSenderWorker } from "./workers/email-sender";

async function main() {
  console.log("[Workers] Starting bullstudio workers...");

  // Start workers
  const alertCheckerWorker = createAlertCheckerWorker();
  const emailSenderWorker = createEmailSenderWorker();

  console.log("[Workers] Alert checker worker started");
  console.log("[Workers] Email sender worker started");

  // Schedule recurring alert checks
  await scheduleAlertChecks();

  // Graceful shutdown
  const shutdown = async () => {
    console.log("[Workers] Shutting down...");

    await Promise.all([alertCheckerWorker.close(), emailSenderWorker.close()]);

    console.log("[Workers] Shutdown complete");
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  console.log("[Workers] bullstudio workers ready");
}

main().catch((error) => {
  console.error("[Workers] Fatal error:", error);
  process.exit(1);
});

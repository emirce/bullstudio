import { Worker, Job } from "bullmq";
import { AlertStatus, AlertType } from "@bullstudio/prisma";
import { redis } from "../lib/redis";
import { resend, EMAIL_FROM } from "../lib/resend";
import { EMAIL_QUEUE_NAME, type EmailJobData } from "../queues/email";

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  [AlertType.FailureRate]: "Failure Rate",
  [AlertType.BacklogExceeded]: "Backlog Exceeded",
  [AlertType.ProcessingTimeAvg]: "Average Processing Time",
  [AlertType.ProcessingTimeP95]: "P95 Processing Time",
  [AlertType.ProcessingTimeP99]: "P99 Processing Time",
  [AlertType.MissingWorkers]: "Missing Workers",
};

export function createEmailSenderWorker() {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const data = job.data;

      console.log(
        `[EmailSender] Processing ${data.type} email for alert ${data.alertId}`
      );

      if (!resend) {
        console.warn(
          "[EmailSender] Resend not configured - skipping email notification"
        );
        return { skipped: true, reason: "Resend not configured" };
      }

      const isTriggered = data.type === "alert-triggered";
      const subject = isTriggered
        ? `🚨 Alert Triggered: ${data.alertName}`
        : `✅ Alert Resolved: ${data.alertName}`;

      const html = generateEmailHtml(data, isTriggered);
      const text = generateEmailText(data, isTriggered);

      const result = await resend.emails.send({
        from: EMAIL_FROM,
        to: data.recipients,
        subject,
        html,
        text,
      });

      console.log(`[EmailSender] Email sent successfully: ${result.data?.id}`);

      return { sent: true, emailId: result.data?.id };
    },
    {
      connection: redis,
      concurrency: 5,
    }
  );

  worker.on("completed", (job: Job<EmailJobData>) => {
    console.log(`[EmailSender] Job ${job.id} completed`);
  });

  worker.on("failed", (job: Job<EmailJobData> | undefined, error: Error) => {
    console.error(`[EmailSender] Job ${job?.id} failed:`, error);
  });

  return worker;
}

function generateEmailHtml(data: EmailJobData, isTriggered: boolean): string {
  const statusColor = isTriggered ? "#dc2626" : "#16a34a";
  const statusBg = isTriggered ? "#fef2f2" : "#f0fdf4";
  const statusLabel = isTriggered ? "TRIGGERED" : "RESOLVED";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: #18181b; padding: 24px; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fafafa; margin: 0; font-size: 20px;">bullstudio</h1>
  </div>

  <div style="background: #ffffff; border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
    <div style="background: ${statusBg}; border: 1px solid ${statusColor}; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
      <span style="display: inline-block; background: ${statusColor}; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">
        ${statusLabel}
      </span>
      <h2 style="margin: 8px 0 0 0; color: ${statusColor}; font-size: 18px;">
        ${data.alertName}
      </h2>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Alert Type</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 500;">${ALERT_TYPE_LABELS[data.alertType]}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb;">Queue</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 500; border-top: 1px solid #e5e7eb; font-family: monospace;">${data.queueName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb;">Connection</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 500; border-top: 1px solid #e5e7eb;">${data.connectionName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb;">Current Value</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 500; border-top: 1px solid #e5e7eb;">${formatValue(data.alertType, data.value)}</td>
      </tr>
      <tr>
        <td style="padding: 8px 0; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb;">Time</td>
        <td style="padding: 8px 0; text-align: right; font-weight: 500; border-top: 1px solid #e5e7eb;">${new Date(data.timestamp).toLocaleString()}</td>
      </tr>
    </table>

    <div style="background: #f9fafb; border-radius: 6px; padding: 16px;">
      <p style="margin: 0; color: #374151; font-size: 14px;">
        ${data.message}
      </p>
    </div>
  </div>

  <div style="text-align: center; padding: 16px; color: #9ca3af; font-size: 12px;">
    <p style="margin: 0;">This is an automated alert from bullstudio.</p>
  </div>
</body>
</html>
  `.trim();
}

function generateEmailText(data: EmailJobData, isTriggered: boolean): string {
  const status = isTriggered ? "TRIGGERED" : "RESOLVED";

  return `
bullstudio Alert ${status}

Alert: ${data.alertName}
Type: ${ALERT_TYPE_LABELS[data.alertType]}
Queue: ${data.queueName}
Connection: ${data.connectionName}
Current Value: ${formatValue(data.alertType, data.value)}
Time: ${new Date(data.timestamp).toLocaleString()}

${data.message}

---
This is an automated alert from bullstudio.
  `.trim();
}

function formatValue(type: AlertType, value: number): string {
  switch (type) {
    case AlertType.FailureRate:
      return `${value.toFixed(1)}%`;
    case AlertType.BacklogExceeded:
      return `${Math.round(value)} jobs`;
    case AlertType.ProcessingTimeAvg:
    case AlertType.ProcessingTimeP95:
    case AlertType.ProcessingTimeP99:
      return formatMs(value);
    case AlertType.MissingWorkers:
      return `${Math.round(value)} workers`;
    default:
      return String(value);
  }
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

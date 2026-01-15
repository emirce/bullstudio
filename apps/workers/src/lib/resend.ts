import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
  console.warn("[Resend] RESEND_API_KEY not set - email notifications disabled");
}

export const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export const EMAIL_FROM = process.env.EMAIL_FROM ?? "alerts@bullstudio.dev";

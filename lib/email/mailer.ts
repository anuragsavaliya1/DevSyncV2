/** Resend mail sender for DevSync transactional emails. */
import "server-only";
import { Resend } from "resend";
import { getResendEmailConfig } from "@/lib/email/config";

export type SendAppEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
};

export type SendAppEmailResult =
  | { sent: true; messageId?: string }
  | { sent: false; reason: "not_configured" | "failed"; error?: string };

let resendClient: Resend | null = null;

function getResendClient(apiKey: string) {
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export async function sendAppEmail(
  input: SendAppEmailInput,
): Promise<SendAppEmailResult> {
  const config = getResendEmailConfig();
  if (!config) {
    console.info(
      `[email] skipped (Resend not configured): ${input.subject} → ${Array.isArray(input.to) ? input.to.join(", ") : input.to}`,
    );
    return { sent: false, reason: "not_configured" };
  }

  try {
    const resend = getResendClient(config.apiKey);
    const { data, error } = await resend.emails.send({
      from: config.from,
      to: Array.isArray(input.to) ? input.to : [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html || plainTextToHtml(input.text),
    });

    if (error) {
      console.error("[email] Resend send failed:", error.message);
      return { sent: false, reason: "failed", error: error.message };
    }

    return { sent: true, messageId: data?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[email] send failed:", message);
    return { sent: false, reason: "failed", error: message };
  }
}

function plainTextToHtml(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#294354;white-space:pre-wrap;">${escaped}</p>`;
}

/** Pure notification-email rules (safe for unit tests). */

/** Events that should also send email (mirrors Signal Center notifications). */
export const EMAIL_NOTIFICATION_TYPES = [
  "task_assigned",
  "task_overdue",
  "leave_requested",
  "leave_approved",
  "leave_rejected",
  "punch_in_correction_requested",
  "punch_out_correction_requested",
  "punch_in_correction_approved",
  "punch_out_correction_approved",
  "punch_in_correction_rejected",
  "punch_out_correction_rejected",
] as const;

export type EmailNotificationType = (typeof EMAIL_NOTIFICATION_TYPES)[number];

export type NotificationEmailTheme = {
  accent: string;
  badge: string;
  badgeBg: string;
  badgeText: string;
  headerBg: string;
};

export function shouldEmailNotificationType(
  type: string,
): type is EmailNotificationType {
  return (EMAIL_NOTIFICATION_TYPES as readonly string[]).includes(type);
}

export function getNotificationEmailTheme(type: string): NotificationEmailTheme {
  switch (type) {
    case "leave_approved":
    case "punch_in_correction_approved":
    case "punch_out_correction_approved":
      return {
        accent: "#0E9384",
        badge: "Approved",
        badgeBg: "#EAF7F4",
        badgeText: "#0E9384",
        headerBg: "#F3FBFA",
      };
    case "leave_rejected":
    case "punch_in_correction_rejected":
    case "punch_out_correction_rejected":
      return {
        accent: "#A64D43",
        badge: "Rejected",
        badgeBg: "#FFF1EF",
        badgeText: "#A64D43",
        headerBg: "#FFF8F7",
      };
    case "leave_requested":
    case "punch_in_correction_requested":
    case "punch_out_correction_requested":
      return {
        accent: "#A87532",
        badge: "Needs review",
        badgeBg: "#FFF3E4",
        badgeText: "#A87532",
        headerBg: "#FFF9F1",
      };
    case "task_assigned":
      return {
        accent: "#3B6EA5",
        badge: "New task",
        badgeBg: "#EAF1F9",
        badgeText: "#3B6EA5",
        headerBg: "#F5F9FD",
      };
    case "task_overdue":
      return {
        accent: "#A64D43",
        badge: "Overdue",
        badgeBg: "#FFF1EF",
        badgeText: "#A64D43",
        headerBg: "#FFF8F7",
      };
    default:
      return {
        accent: "#0E9384",
        badge: "Update",
        badgeBg: "#EAF7F4",
        badgeText: "#0E9384",
        headerBg: "#F3FBFA",
      };
  }
}

/** Split body into summary + optional reason block (matches Signal Center). */
export function splitEmailBody(body: string) {
  const reasonLabelMatch = body.match(/^(.*?)\nReason:\s*([\s\S]+)$/);
  if (reasonLabelMatch) {
    return {
      summary: reasonLabelMatch[1].trim(),
      reason: reasonLabelMatch[2].trim() || null,
    };
  }

  const marker = " was rejected.";
  const idx = body.indexOf(marker);
  if (idx === -1) {
    return { summary: body.trim(), reason: null as string | null };
  }

  const summary = body.slice(0, idx + marker.length).trim();
  const reason = body.slice(idx + marker.length).trim();
  return { summary, reason: reason || null };
}

export function buildNotificationEmailSubject(title: string) {
  return `${title} · DevSync`;
}

export function buildNotificationEmailText(input: {
  title: string;
  body: string;
  appUrl?: string | null;
}) {
  const { summary, reason } = splitEmailBody(input.body);
  const lines = [
    input.title,
    "",
    summary,
    reason ? `\nReason:\n${reason}` : "",
    "",
    input.appUrl
      ? `Open DevSync: ${input.appUrl.replace(/\/+$/, "")}/dashboard`
      : "Open DevSync to review this update.",
    "",
    "— DevSync · Daily operating system",
  ].filter((line) => line !== "");
  return lines.join("\n");
}

export function buildNotificationEmailHtml(input: {
  title: string;
  body: string;
  type?: string;
  appUrl?: string | null;
}) {
  const theme = getNotificationEmailTheme(input.type || "");
  const { summary, reason } = splitEmailBody(input.body);
  const safeTitle = escapeHtml(input.title);
  const safeSummary = escapeHtml(summary).replace(/\n/g, "<br />");
  const safeReason = reason
    ? escapeHtml(reason).replace(/\n/g, "<br />")
    : null;
  const dashboardUrl = input.appUrl
    ? `${input.appUrl.replace(/\/+$/, "")}/dashboard`
    : null;
  const year = new Date().getFullYear();

  const ctaBlock = dashboardUrl
    ? `
                  <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0;">
                    <tr>
                      <td style="border-radius:12px;background:${theme.accent};">
                        <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:12px 20px;font-size:13px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                          Open in DevSync
                        </a>
                      </td>
                    </tr>
                  </table>`
    : `
                  <p style="margin:0;font-size:13px;line-height:1.5;color:#708494;">
                    Open DevSync for details.
                  </p>`;

  const reasonBlock = safeReason
    ? `
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0 0;">
                    <tr>
                      <td style="padding:14px 16px;border:1px solid #F0C9C4;border-radius:12px;background:#FFF1EF;">
                        <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#A64D43;">
                          Reason
                        </div>
                        <div style="margin-top:8px;font-size:14px;line-height:1.55;color:#8B3D35;">
                          ${safeReason}
                        </div>
                      </td>
                    </tr>
                  </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#e8eef2;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e8eef2;padding:28px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;margin:0 auto;">
            <tr>
              <td style="padding:0 4px 14px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      <span style="display:inline-block;width:28px;height:28px;border-radius:8px;background:#102a3a;color:#7ed7cb;font-size:11px;font-weight:700;line-height:28px;text-align:center;">D</span>
                      <span style="margin-left:10px;font-size:16px;font-weight:700;letter-spacing:-0.03em;color:#102a3a;vertical-align:middle;">devsync</span>
                    </td>
                    <td align="right" style="vertical-align:middle;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#8B9BA6;">
                      Signal Center
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="background:#ffffff;border:1px solid #D9E4EA;border-radius:18px;overflow:hidden;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="height:4px;background:${theme.accent};font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                  <tr>
                    <td style="padding:24px 28px 8px;background:${theme.headerBg};">
                      <span style="display:inline-block;padding:5px 10px;border-radius:999px;background:${theme.badgeBg};color:${theme.badgeText};font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;">
                        ${escapeHtml(theme.badge)}
                      </span>
                      <h1 style="margin:14px 0 0;font-size:22px;line-height:1.25;font-weight:700;color:#294354;">
                        ${safeTitle}
                      </h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:22px 28px 8px;">
                      <p style="margin:0;font-size:15px;line-height:1.6;color:#486170;">
                        ${safeSummary}
                      </p>
                      ${reasonBlock}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:22px 28px 28px;">
                      ${ctaBlock}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 8px 0;text-align:center;">
                <p style="margin:0;font-size:12px;line-height:1.5;color:#8B9BA6;">
                  This is an automated message from DevSync.
                </p>
                <p style="margin:6px 0 0;font-size:11px;line-height:1.5;color:#A8B5BD;">
                  © ${year} DevSync · Daily operating system for your team
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

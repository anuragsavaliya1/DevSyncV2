/** Optional Resend config — email is skipped when these are unset. */
export type ResendEmailConfig = {
  apiKey: string;
  from: string;
};

export function getResendEmailConfig(): ResendEmailConfig | null {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();

  if (!apiKey || !from) {
    return null;
  }

  return { apiKey, from };
}

export function isEmailDeliveryEnabled() {
  return Boolean(getResendEmailConfig());
}

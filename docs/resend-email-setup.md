# DevSync email with Resend

DevSync sends transactional email for the same events shown in Signal Center:

- Task assigned
- Leave requested / approved / rejected
- Punch correction requested / approved / rejected

In-app notifications always work. Email is optional and is skipped (with a server log) until Resend is configured.

## 1. Create a Resend account

1. Go to [https://resend.com](https://resend.com) and sign up.
2. Open **API Keys** → **Create API Key**.
3. Copy the key (starts with `re_...`). Store it only in env vars — never commit it.

## 2. Set a from address

### Quick test (Resend sandbox)

You can send from Resend’s onboarding address while testing:

```text
RESEND_FROM_EMAIL=DevSync <onboarding@resend.dev>
```

With the sandbox sender, Resend usually only delivers to **your own Resend account email**.

### Production (recommended)

1. In Resend → **Domains** → add your domain (for example `xitij.com`).
2. Add the DNS records Resend shows (SPF / DKIM).
3. Wait until the domain status is **Verified**.
4. Use a from address on that domain:

```text
RESEND_FROM_EMAIL=DevSync <noreply@your-domain.com>
```

## 3. Add environment variables

Add these to your local `.env` and to production hosting env:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=DevSync <noreply@your-domain.com>
DEVSYNC_APP_URL=https://your-devsync-host.example.com
```

Both `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are required. If either is missing, DevSync logs:

```text
[email] skipped (Resend not configured): ...
```

and continues without failing the Task / Leave / Punch action.

`DEVSYNC_APP_URL` is optional but recommended. When set, emails include an **Open in DevSync** button linking to `/dashboard`.

## 4. Restart the app

After changing env vars:

```bash
pnpm dev
```

Or restart your production process / container so it picks up the new values.

## 5. Verify it works

1. Assign a task, apply/approve/reject leave, or submit/review a punch correction.
2. Confirm:
   - Signal Center still shows the notification
   - The recipient mailbox gets `[DevSync] ...` email
3. Check server logs if mail does not arrive:
   - `skipped (Resend not configured)` → env vars missing/restart needed
   - `Resend send failed` → invalid key, unverified domain, or recipient restrictions

## 6. Code map

| File | Role |
|------|------|
| `lib/email/config.ts` | Reads `RESEND_API_KEY` + `RESEND_FROM_EMAIL` |
| `lib/email/mailer.ts` | Sends via Resend SDK |
| `lib/email/notification-mail.ts` | Looks up recipient email and queues send |
| `lib/email/notification-mail-rules.ts` | Which notification types get email |
| `lib/operations.ts` | Calls email after creating matching notifications |

## Notes

- Email send is fire-and-forget; Resend failures never block business actions.
- Remove any old `SMTP_*` variables — they are no longer used.
- Keep `RESEND_API_KEY` secret. Rotate it in Resend if it leaks.
- Browser push for the same events is documented in [`firebase-browser-push-setup.md`](firebase-browser-push-setup.md).

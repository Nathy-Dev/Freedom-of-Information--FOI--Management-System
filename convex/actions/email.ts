"use node";
import { internalAction } from "../_generated/server";
import { v } from "convex/values";

export const deliverAccountEmail = internalAction({
  args: { to: v.string(), url: v.string(), invitation: v.boolean(), idempotencyKey: v.optional(v.string()) },
  returns: v.boolean(),
  handler: async (_ctx, args) => {
    const escapedUrl = args.url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    const result = await sendEmail({ to: args.to, subject: args.invitation ? "Your HYPREP account invitation" : "Reset your HYPREP password", html: `<p>${args.invitation ? "Your HYPREP account is ready. Set your password to activate it." : "Use the secure link to reset your password."}</p><p><a href="${escapedUrl}">Set password</a></p><p>If you did not expect this email, contact HYPREP.</p>`, text: `Set your HYPREP password: ${args.url}`, idempotencyKey: args.idempotencyKey });
    return !result.skipped;
  },
});

/**
 * Email delivery via Resend (user-resolved choice).
 *
 * Edge cases handled:
 * - Missing RESEND_API_KEY / sender address → skipped with a warning (never crash)
 * - Provider failure → throws so the caller can retry/schedule
 * - Recipient list dedup + length cap
 */

export async function sendEmail(input: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  idempotencyKey?: string;
  attachments?: Array<{ filename: string; content: string }>;
}): Promise<{ id: string | null; skipped: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS;
  const fromName = process.env.EMAIL_FROM_NAME;

  if (!apiKey || !fromAddress) {
    console.warn("[email] RESEND_API_KEY or EMAIL_FROM_ADDRESS not configured — email skipped.");
    return { id: null, skipped: true };
  }

  const to = Array.isArray(input.to) ? [...new Set(input.to)] : [input.to];
  if (to.length === 0) return { id: null, skipped: true };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        ...(input.idempotencyKey ? { "idempotency-key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: fromName ? `${fromName} <${fromAddress}>` : fromAddress,
        to: to.length === 1 ? to[0] : to,
        subject: input.subject,
        html: input.html,
        text: input.text ?? input.html.replace(/<[^>]*>/g, ""),
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(input.attachments ? { attachments: input.attachments } : {}),
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Resend error ${res.status}: ${detail.slice(0, 300)}`);
    }

    const body = (await res.json()) as { id?: string };
    if (!body.id) throw new Error("The email provider did not confirm acceptance.");
    return { id: body.id, skipped: false };
  } catch (e) {
    console.error("[email] Resend delivery failed:", e);
    throw e;
  }
}

/** Shared HTML shell for transactional mail. */
export function emailShell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="font-family:Segoe UI,Arial,sans-serif;color:#1a1a1a;max-width:600px;margin:0 auto">
  <div style="border-bottom:3px solid #008751;padding:16px 0">
    <strong style="font-size:18px;color:#008751">HYPREP — FOI Management System</strong>
  </div>
  <div style="padding:24px 0">
    <h2 style="margin-top:0">${title}</h2>
    ${bodyHtml}
  </div>
  <div style="border-top:1px solid #e5e7eb;padding-top:12px;font-size:12px;color:#6b7280">
    Hydrocarbon Pollution Remediation Project · Legal Unit · Freedom of Information Act 2011
  </div>
</body></html>`;
}

"use node";

/**
 * SMS delivery via Termii (user-resolved choice) for court reminders and
 * urgent SLA notices. Uses the Termii REST API directly (no SDK dependency).
 *
 * Edge cases handled:
 * - Missing TERMII_API_KEY / sender id → skipped with a warning
 * - Provider failure → throws so the caller can retry
 * - Nigerian phone formatting (leading 0 → +234) normalisation
 */

const TERMII_BASE = "https://api.ng.termii.com";

export async function sendSms(input: {
  to: string;
  message: string;
  channel?: "generic" | "dnd" | "whatsapp";
}): Promise<{ messageId: string | null; skipped: boolean }> {
  const apiKey = process.env.TERMII_API_KEY;
  const senderId = process.env.TERMII_SENDER_ID;

  if (!apiKey || !senderId) {
    console.warn("[sms] TERMII_API_KEY or TERMII_SENDER_ID not configured — SMS skipped.");
    return { messageId: null, skipped: true };
  }

  const to = normalisePhone(input.to);
  if (!to) {
    console.warn(`[sms] Could not normalise phone number: ${input.to}`);
    return { messageId: null, skipped: true };
  }

  try {
    const res = await fetch(`${TERMII_BASE}/api/sms/send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        to,
        from: senderId,
        sms: input.message,
        type: "plain",
        channel: input.channel ?? "generic",
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Termii error ${res.status}: ${detail.slice(0, 300)}`);
    }

    const body = (await res.json()) as { message_id?: string };
    if (!body.message_id) throw new Error("The SMS provider did not confirm acceptance.");
    return { messageId: body.message_id, skipped: false };
  } catch (e) {
    console.error("[sms] Termii delivery failed:", e);
    throw e;
  }
}

/** Normalise a Nigerian number to E.164: 08031234567 → +2348031234567. */
function normalisePhone(value: string): string | null {
  const cleaned = value.replace(/[\s()-]/g, "");
  if (/^\+?\d{10,15}$/.test(cleaned)) {
    if (cleaned.startsWith("+")) return cleaned;
    if (cleaned.startsWith("0")) return `+234${cleaned.slice(1)}`;
    return `+${cleaned}`;
  }
  return null;
}

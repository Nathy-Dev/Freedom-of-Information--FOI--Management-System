/**
 * Inbound webhook receiver (ToR §4 — external court-scheduling / case-management
 * systems may push events).
 *
 * Security: requests must carry an HMAC-SHA256 signature header
 * (`X-HYPREP-Signature: sha256=<hex>`) computed over the raw body with the
 * configured `WEBHOOK_SECRET`. Signature verification is timing-safe. Payloads
 * are validated and turned into domain mutations. Uses the Web Crypto API
 * (default Convex runtime — no node built-ins).
 *
 * Edge cases: missing/invalid signature → 401; malformed JSON → 400;
 * unknown event type → 400; unhandled errors → 500.
 */

import type { GenericActionCtx } from "convex/server";
import { internal } from "../_generated/api";

export async function handleInboundWebhook(
  ctx: GenericActionCtx<any>,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const segments = url.pathname.replace(/^\/api\/webhooks\/?/, "").split("/").filter(Boolean);
  const hookId = segments[0];
  if (!hookId) {
    return json({ error: "Missing webhook id." }, 400);
  }

  // --- Signature verification ----------------------------------------------
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    console.error("WEBHOOK_SECRET is not configured");
    return json({ error: "Webhook verification is not configured." }, 500);
  }
  const signature = request.headers.get("x-hyprep-signature") ?? "";
  const raw = await request.bytes();
  const expected = await hmacSha256Hex(secret, new Uint8Array(raw));
  const received = signature.replace(/^sha256=/, "").toLowerCase();

  if (!timingSafeEqualHex(expected, received)) {
    return json({ error: "Invalid signature." }, 401);
  }

  // --- Parse + dispatch ------------------------------------------------------
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return json({ error: "Invalid JSON body." }, 400);
  }
  if (!body || typeof body !== "object") {
    return json({ error: "Body must be a JSON object." }, 400);
  }
  const payload = body as Record<string, unknown>;
  const eventType = payload.event ?? payload.type;
  if (typeof eventType !== "string") {
    return json({ error: "Missing event type." }, 400);
  }

  try {
    if (eventType === "court.date.scheduled" || eventType === "court.date.updated") {
      await ctx.runMutation(internal.http.webhookHandlers.ingestCourtEvent, {
        hookId,
        payload: payload as never,
      });
      return json({ received: true });
    }
    if (eventType === "case.external.created") {
      await ctx.runMutation(internal.http.webhookHandlers.ingestExternalCase, {
        hookId,
        payload: payload as never,
      });
      return json({ received: true });
    }
    return json({ error: `Unsupported event type: ${eventType}` }, 400);
  } catch (e) {
    console.error("Webhook handling error:", e);
    return json({ error: "Internal server error." }, 500);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function hmacSha256Hex(secret: string, data: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  // Copy into a fresh ArrayBuffer-backed view to satisfy BufferSource typing.
  const buffer = new Uint8Array(data).buffer as ArrayBuffer;
  const sig = await crypto.subtle.sign("HMAC", key, buffer);
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time hex comparison. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

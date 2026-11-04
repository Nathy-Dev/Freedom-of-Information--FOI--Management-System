/**
 * REST API handler for third-party integrators (ToR §18/§19).
 *
 * Auth: `Authorization: Bearer <clientId>:<secret>` against `apiClients`.
 * DB work is delegated to internal functions via ctx.runQuery/ctx.runMutation
 * (HTTP actions have no ctx.db). Uses the Web Crypto API (default Convex
 * runtime — no node built-ins).
 *
 * Edge cases: malformed auth → 401; bad secret → 401 (timing-safe compare);
 * missing scope → 403; bad JSON/validation → 400; unknown route → 404;
 * unexpected errors → 500 with suppressed detail; paging bounded.
 */

import type { GenericActionCtx } from "convex/server";
import { internal } from "../_generated/api";

export async function handleRestRequest(
  ctx: GenericActionCtx<any>,
  request: Request,
): Promise<Response> {
  const url = new URL(request.url);
  const segments = url.pathname.replace(/^\/api\/v1\/?/, "").split("/").filter(Boolean);
  const resource = segments[0];
  const id = segments[1];

  // --- Auth -----------------------------------------------------------------
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const [clientId, secret] = token.split(":");
  if (!clientId || !secret) {
    return json({ error: "Missing or malformed Authorization header." }, 401);
  }

  const clientRow = await ctx.runQuery(internal.http.restApi.lookupClient, { clientId });
  if (!clientRow || !clientRow.isActive) {
    return json({ error: "Invalid client credentials." }, 401);
  }

  const hash = await sha256Hex(secret);
  if (!timingSafeEqualHex(hash, clientRow.secretHash)) {
    return json({ error: "Invalid client credentials." }, 401);
  }

  await ctx.runMutation(internal.http.restApi.apiTouchClient, { clientId: clientRow.id });

  try {
    if (resource === "cases") {
      if (!clientRow.scopes.includes("cases:read") && !clientRow.scopes.includes("cases:write")) {
        return json({ error: "Missing required scope." }, 403);
      }
      if (!id) {
        if (request.method === "GET") {
          const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);
          const rows = await ctx.runQuery(internal.http.restApi.apiListCases, {
            status: url.searchParams.get("status") ?? undefined,
            limit,
          });
          return json(rows);
        }
        if (request.method === "POST" && clientRow.scopes.includes("cases:write")) {
          const body = await request.json().catch(() => null);
          if (!body || typeof body !== "object") {
            return json({ error: "Invalid JSON body." }, 400);
          }
          const payload = body as Record<string, unknown>;
          if (typeof payload.subject !== "string" || typeof payload.description !== "string") {
            return json({ error: "subject and description are required." }, 400);
          }
          const result = await ctx.runMutation(internal.http.restApi.apiCreateCase, {
            payload: payload as never,
          });
          return json({ id: result.id, caseNumber: result.caseNumber }, 201);
        }
        return json({ error: "Method not allowed." }, 405);
      }
      if (request.method === "GET") {
        const row = await ctx.runQuery(internal.http.restApi.apiGetCase, { id });
        if (!row) return json({ error: "Case not found." }, 404);
        return json(row);
      }
      return json({ error: "Method not allowed." }, 405);
    }

    if (resource === "reports" && !id && request.method === "GET") {
      if (!clientRow.scopes.includes("reports:read")) {
        return json({ error: "Missing required scope." }, 403);
      }
      const limit = Math.min(Number(url.searchParams.get("limit") ?? "100"), 500);
      const rows = await ctx.runQuery(internal.http.restApi.apiListReports, { limit });
      return json(rows);
    }

    if (resource === "health" && request.method === "GET") {
      return json({ status: "ok" });
    }

    return json({ error: "Not found." }, 404);
  } catch (e) {
    console.error("REST handler error:", e);
    return json({ error: "Internal server error." }, 500);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time hex comparison (avoids early-exit timing leaks). */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

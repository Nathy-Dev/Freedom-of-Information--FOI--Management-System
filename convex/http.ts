import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent, createAuth } from "./auth";
import { handleRestRequest } from "./http/rest";
import { handleInboundWebhook } from "./http/webhooks";

const http = httpRouter();

http.route({
  pathPrefix: "/files/",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const token = new URL(request.url).pathname.slice("/files/".length);
    if (!/^[a-f0-9-]{36}$/.test(token)) return new Response("Not found", { status: 404 });
    const ticket = await ctx.runQuery(internal.fileAccess.readTicket, { token });
    if (!ticket) return new Response("Link expired or access revoked", { status: 403 });
    const file = await ctx.storage.get(ticket.storageId);
    if (!file) return new Response("File unavailable", { status: 404 });
    const headers = new Headers({ "Content-Type": ticket.inline ? ticket.contentType : file.type || "application/octet-stream", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Content-Disposition": `${ticket.inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(ticket.filename)}` });
    if (ticket.inline) headers.set("Content-Security-Policy", "sandbox; default-src 'none'; frame-ancestors 'self' " + FRONTEND_ORIGINS.join(" "));
    const origin = request.headers.get("origin");
    const allowed = (process.env.FRONTEND_ORIGINS ?? "http://localhost:5173").split(",").map((value) => value.trim());
    if (origin && allowed.includes(origin)) { headers.set("Access-Control-Allow-Origin", origin); headers.set("Vary", "Origin"); }
    return new Response(file, { headers });
  }),
});

// Better Auth routes (sign-in, sign-up, OAuth callbacks, 2FA, session,
// sign-out). CORS is enabled so the SPA (e.g. http://localhost:5173 or the
// production frontend origin) can call /api/auth/* cross-origin without
// "blocked by CORS" on get_session.
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

authComponent.registerRoutes(http, createAuth, {
  cors: { allowedOrigins: FRONTEND_ORIGINS },
});

// REST API for third-party integrators (ToR §18/§19). Convex httpRouter only
// accepts concrete methods, so register each verb to the same handler (which
// dispatches on request.method internally).
for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
  http.route({
    pathPrefix: "/api/v1/",
    method,
    handler: httpAction((ctx, request) => handleRestRequest(ctx, request)),
  });
}

// Inbound webhooks (ToR §4 — external court-scheduling / case-management).
http.route({
  pathPrefix: "/api/webhooks/",
  method: "POST",
  handler: httpAction((ctx, request) => handleInboundWebhook(ctx, request)),
});

// Health and readiness.
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async (_ctx, _request) => {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }),
});

http.route({
  path: "/health/detailed",
  method: "GET",
  handler: httpAction(async (ctx, _request) => {
    const auth = createAuth(ctx as never);
    const headers = await authComponent.getHeaders(ctx as never);
    const checks: Record<string, unknown> = {
      database: "operational",
      timestamp: new Date().toISOString(),
    };
    try {
      const session = await auth.api.getSession({ headers });
      checks.auth = session ? "operational" : "no-session";
    } catch (e) {
      checks.auth = `degraded: ${e instanceof Error ? e.message : "unknown"}`;
    }
    return new Response(JSON.stringify(checks), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }),
});

export default http;

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { handleRestRequest } from "./http/rest";
import { handleInboundWebhook } from "./http/webhooks";

const http = httpRouter();

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
    path: "/api/v1/*",
    method,
    handler: httpAction((ctx, request) => handleRestRequest(ctx, request)),
  });
}

// Inbound webhooks (ToR §4 — external court-scheduling / case-management).
http.route({
  path: "/api/webhooks/*",
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

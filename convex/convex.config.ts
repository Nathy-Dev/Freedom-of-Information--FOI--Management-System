import { defineApp } from "convex/server";
import { v } from "convex/values";
import betterAuth from "@convex-dev/better-auth/convex.config";

const app = defineApp({
  // Typed environment variables. These are read through the generated `env`
  // export from "./_generated/server" inside functions — never process.env.
  env: {
    // Email (Resend)
    RESEND_API_KEY: v.optional(v.string()),
    EMAIL_FROM_ADDRESS: v.optional(v.string()),
    EMAIL_FROM_NAME: v.optional(v.string()),
    // SMS (Termii)
    TERMII_API_KEY: v.optional(v.string()),
    TERMII_SENDER_ID: v.optional(v.string()),
    // Auth (Better Auth)
    BETTER_AUTH_SECRET: v.optional(v.string()),
    BETTER_AUTH_URL: v.optional(v.string()),
    // Demo admin credentials created by `seed:run` (dev/preview only).
    SEED_ADMIN_EMAIL: v.optional(v.string()),
    SEED_ADMIN_PASSWORD: v.optional(v.string()),
    SEED_ADMIN_NAME: v.optional(v.string()),
    // Comma-separated browser origins allowed to call /api/auth/* (CORS).
    FRONTEND_ORIGINS: v.optional(v.string()),
    // SSO (Entra ID / OIDC) — enabled per deployment via env
    ENTRA_ID_CLIENT_ID: v.optional(v.string()),
    ENTRA_ID_CLIENT_SECRET: v.optional(v.string()),
    ENTRA_ID_ISSUER_URL: v.optional(v.string()),
    // Virus scanning (ClamAV / cloud AV)
    CLAMAV_URL: v.optional(v.string()),
    // OCR service
    OCR_API_KEY: v.optional(v.string()),
    OCR_ENDPOINT: v.optional(v.string()),
    // Encryption envelope key for restricted/confidential document payloads
    DOCUMENT_ENCRYPTION_KEY: v.optional(v.string()),
    // External webhook secret (outbound signing + inbound verification)
    WEBHOOK_SECRET: v.optional(v.string()),
    // Sentry
    SENTRY_DSN: v.optional(v.string()),
  },
});

// Mount the Better Auth component. Its isolated tables (user, session, account,
// verification, twoFactor, oauthApplication, oauthAccessToken, oauthConsent,
// jwks, rateLimit) are managed by the component; the app schema declares its own
// business tables alongside.
app.use(betterAuth);

export default app;

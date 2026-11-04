import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config";

/**
 * Convex auth provider config.
 *
 * The Better Auth component mints RS256 JWTs whose public keys are served from
 * the component's `jwks` table. Convex validates those JWTs via
 * `ctx.auth.getUserIdentity()` (used by every query/mutation through the
 * `safeGetAuthUser` helper). The provider discovery URL is the site URL; the
 * JWKS is read from the component database, so no env var is required.
 */
export default {
  providers: [getAuthConfigProvider()],
};

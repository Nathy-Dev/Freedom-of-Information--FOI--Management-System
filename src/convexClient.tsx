/**
 * Convex + Better Auth client wiring (client side).
 *
 * The Better Auth client mints Convex JWTs through the `convexClient()` plugin.
 * `ConvexBetterAuthProvider` keeps the Convex auth state synchronized with the
 * Better Auth session, including sign-in, sign-out and token refresh.
 */
import { ConvexReactClient } from 'convex/react'
import { createAuthClient } from 'better-auth/react'
import { convexClient } from '@convex-dev/better-auth/client/plugins'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import type { AuthClient } from '@convex-dev/better-auth/react'
import { twoFactorClient } from 'better-auth/client/plugins'
import type { ReactNode } from 'react'

const convexUrl = import.meta.env.VITE_CONVEX_URL || 'http://127.0.0.1:3210'

export const convex = new ConvexReactClient(convexUrl, {
  unsavedChangesWarning: false,
})

/**
 * Better Auth client. `convexClient()` adds the token-minting plugin; the app
 * reads the session through the same-origin auth routes proxied by Vite.
 */
export const authClient = createAuthClient({
  // Keep the session cookie same-origin in the browser. Vite proxies these
  // routes to the Convex site URL during local development.
  baseURL: typeof window !== 'undefined' ? window.location.origin : (import.meta.env.VITE_CONVEX_SITE_URL || convexUrl),
  plugins: [
    convexClient(),
    twoFactorClient(),
  ],
  fetchOptions: { credentials: 'include' },
})

/** Mounts the live Convex provider used by all query and mutation adapters. */
export function ConvexAuthProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexBetterAuthProvider client={convex} authClient={authClient as unknown as AuthClient}>
      {children}
    </ConvexBetterAuthProvider>
  )
}

/**
 * Backend verification check against the Convex deployment.
 *
 * - `/health` HTTP route responds 200.
 * - The local/dev backend is reachable.
 *
 * Uses plain fetch (no npx) so it runs reliably in CI and locally.
 */
const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL ?? 'http://127.0.0.1:3211'

let failures = 0
const check = (label, cond) => {
  console.log(cond ? `  ok   ${label}` : `  FAIL ${label}`)
  if (!cond) failures += 1
}

console.log('Backend verification against the Convex deployment:')

async function main() {
  try {
    const res = await fetch(`${CONVEX_SITE_URL}/health`)
    check('health endpoint responds 200', res.status === 200)
  } catch {
    check('health endpoint responds 200', false)
  }

  console.log(failures === 0 ? '\nBackend check passed.' : `\nBackend check failed: ${failures} problem(s).`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

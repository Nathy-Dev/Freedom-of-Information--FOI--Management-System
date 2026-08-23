/**
 * Import-time smoke test. Loads every feature barrel and the app entry through
 * Vite's SSR pipeline, then server-renders every public screen. Catches circular
 * imports, bad barrel exports and module-initialisation crashes without a
 * browser — the failures that a typecheck cannot see.
 */
import { createServer } from 'vite'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server.js'

const MODULES = [
  'src/lib/rbac.ts',
  'src/lib/navigation.ts',
  'src/lib/constants.ts',
  'src/lib/sla.ts',
  'src/mocks/db.ts',
  'src/mocks/api.ts',
  'src/mocks/adminApi.ts',
  'src/mocks/importApi.ts',
  'src/mocks/metrics.ts',
  'src/components/ui/index.ts',
  'src/components/common/index.ts',
  'src/components/charts/index.ts',
  'src/components/layout/index.ts',
  'src/features/auth/index.ts',
  'src/features/dashboard/index.ts',
  'src/features/cases/index.ts',
  'src/features/court/index.ts',
  'src/features/documents/index.ts',
  'src/features/templates/index.ts',
  'src/features/reports/index.ts',
  'src/features/admin/index.ts',
  'src/features/notifications/index.ts',
  'src/features/search/index.ts',
  'src/features/profile/index.ts',
  'src/features/misc/index.ts',
  'src/app/index.ts',
]

function installBrowserStubs() {
  const store = new Map()
  const localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  }
  const noop = () => {}
  globalThis.localStorage = localStorage
  globalThis.window = {
    localStorage,
    addEventListener: noop,
    removeEventListener: noop,
    scrollTo: noop,
    matchMedia: () => ({ matches: false, addEventListener: noop, removeEventListener: noop }),
    navigator: { clipboard: { writeText: async () => {} } },
    location: { pathname: '/login', search: '', hash: '', href: 'http://localhost/login' },
  }
  globalThis.document = { getElementById: () => null, documentElement: { style: {} }, body: {} }
  // Node 22 exposes a read-only navigator; leave it alone if it is already there.
  if (!('navigator' in globalThis)) globalThis.navigator = globalThis.window.navigator
}

async function main() {
  installBrowserStubs()

  const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'warn',
  })

  let failures = 0

  for (const id of MODULES) {
    try {
      const mod = await server.ssrLoadModule(`/${id}`)
      const exported = Object.keys(mod).length
      console.log(`  ok   ${id} (${exported} export${exported === 1 ? '' : 's'})`)
    } catch (error) {
      failures += 1
      console.error(`  FAIL ${id}\n       ${error?.message ?? error}`)
    }
  }

  // Render the public screens for real. Anything behind sign-in needs a live
  // session, which only exists in the browser, so those stay a manual check.
  const { AuthProvider } = await server.ssrLoadModule('/src/store/AuthContext.tsx')
  const { DataProvider } = await server.ssrLoadModule('/src/store/DataContext.tsx')
  const { ToastProvider } = await server.ssrLoadModule('/src/store/ToastContext.tsx')
  const { AppRoutes } = await server.ssrLoadModule('/src/app/router.tsx')
  const auth = await server.ssrLoadModule('/src/features/auth/index.ts')
  const misc = await server.ssrLoadModule('/src/features/misc/index.ts')

  const wrap = (node, location) =>
    createElement(
      StaticRouter,
      { location },
      createElement(AuthProvider, null, createElement(DataProvider, null, createElement(ToastProvider, null, node))),
    )

  const SCREENS = [
    ['route tree at /login', createElement(AppRoutes), '/login'],
    ['LoginPage', createElement(auth.LoginPage), '/login'],
    ['RegisterPage', createElement(auth.RegisterPage), '/register'],
    ['ForgotPasswordPage', createElement(auth.ForgotPasswordPage), '/forgot-password'],
    ['SwitchAccountPage', createElement(auth.SwitchAccountPage), '/switch-account'],
    ['HelpPage', createElement(misc.HelpPage), '/help'],
    ['NotFoundPage', createElement(misc.NotFoundPage), '/no-such-page'],
    ['ForbiddenPage', createElement(misc.ForbiddenPage), '/403'],
  ]

  for (const [label, node, location] of SCREENS) {
    try {
      const html = renderToString(wrap(node, location))
      console.log(`  ok   render ${label} (${html.length} chars)`)
    } catch (error) {
      failures += 1
      console.error(`  FAIL render ${label}
       ${error?.stack ?? error}`)
    }
  }

  await server.close()

  console.log(failures === 0 ? '\nSmoke test passed.' : `\nSmoke test failed: ${failures} problem(s).`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

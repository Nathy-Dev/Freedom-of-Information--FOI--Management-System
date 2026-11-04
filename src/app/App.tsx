import { BrowserRouter } from 'react-router-dom'
import { ConvexAuthProvider } from '@/convexClient'
import { AuthProvider } from '@/store/AuthContext'
import { DataProvider } from '@/store/DataContext'
import { ToastProvider } from '@/store/ToastContext'
import { AppErrorBoundary } from '@/components/common/AppErrorBoundary'
import { ScrollToTop } from './ScrollToTop'
import { AppRoutes } from './router'

/**
 * Provider order matters: ConvexAuthProvider must sit outermost so the Convex
 * client carries the Better Auth session token for every query/mutation.
 * DataProvider derives its badge counts from the signed-in user, so it sits
 * inside AuthProvider. Toasts sit innermost because every screen raises them.
 */
export function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <ConvexAuthProvider>
          <AuthProvider>
            <DataProvider>
              <ToastProvider>
                <ScrollToTop />
                <AppRoutes />
              </ToastProvider>
            </DataProvider>
          </AuthProvider>
        </ConvexAuthProvider>
      </AppErrorBoundary>
    </BrowserRouter>
  )
}

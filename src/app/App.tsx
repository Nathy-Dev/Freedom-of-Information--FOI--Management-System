import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '@/store/AuthContext'
import { DataProvider } from '@/store/DataContext'
import { ToastProvider } from '@/store/ToastContext'
import { ScrollToTop } from './ScrollToTop'
import { AppRoutes } from './router'

/**
 * Provider order matters: DataProvider derives its badge counts and saved views
 * from the signed-in user, so it must sit inside AuthProvider. Toasts sit
 * innermost because every screen raises them.
 */
export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <ToastProvider>
            <ScrollToTop />
            <AppRoutes />
          </ToastProvider>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

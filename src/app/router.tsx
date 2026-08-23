import { Suspense, lazy } from 'react'
import { Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout'
import { SkeletonStats, SkeletonTable, Spinner } from '@/components/ui'
import { HomeRedirect, RequireAnonymous, RequireAuth, RequirePermission } from './guards'

/*
 * Pages are code-split per feature module: opening the court diary does not
 * download the report builder. Grouping by barrel keeps one chunk per feature
 * rather than one per screen, which is the right granularity for this app.
 */
const LoginPage = lazy(() => import('@/features/auth').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/features/auth').then((m) => ({ default: m.RegisterPage })))
const ForgotPasswordPage = lazy(() => import('@/features/auth').then((m) => ({ default: m.ForgotPasswordPage })))
const SwitchAccountPage = lazy(() => import('@/features/auth').then((m) => ({ default: m.SwitchAccountPage })))

const SystemDashboard = lazy(() => import('@/features/dashboard').then((m) => ({ default: m.SystemDashboard })))
const AdminDashboard = lazy(() => import('@/features/dashboard').then((m) => ({ default: m.AdminDashboard })))
const LegalDashboard = lazy(() => import('@/features/dashboard').then((m) => ({ default: m.LegalDashboard })))
const AuditorDashboard = lazy(() => import('@/features/dashboard').then((m) => ({ default: m.AuditorDashboard })))
const MyRequestsPage = lazy(() => import('@/features/dashboard').then((m) => ({ default: m.MyRequestsPage })))

const CaseListPage = lazy(() => import('@/features/cases').then((m) => ({ default: m.CaseListPage })))
const CaseDetailPage = lazy(() => import('@/features/cases').then((m) => ({ default: m.CaseDetailPage })))
const NewCasePage = lazy(() => import('@/features/cases').then((m) => ({ default: m.NewCasePage })))
const NewRequestPage = lazy(() => import('@/features/cases').then((m) => ({ default: m.NewRequestPage })))
const ReviewQueuePage = lazy(() => import('@/features/cases').then((m) => ({ default: m.ReviewQueuePage })))

const CourtCalendarPage = lazy(() => import('@/features/court').then((m) => ({ default: m.CourtCalendarPage })))
const DocumentsPage = lazy(() => import('@/features/documents').then((m) => ({ default: m.DocumentsPage })))
const TemplatesPage = lazy(() => import('@/features/templates').then((m) => ({ default: m.TemplatesPage })))
const ReportsPage = lazy(() => import('@/features/reports').then((m) => ({ default: m.ReportsPage })))
const ReportBuilderPage = lazy(() => import('@/features/reports').then((m) => ({ default: m.ReportBuilderPage })))

const AuditTrailPage = lazy(() => import('@/features/admin').then((m) => ({ default: m.AuditTrailPage })))
const UsersPage = lazy(() => import('@/features/admin').then((m) => ({ default: m.UsersPage })))
const RolesPage = lazy(() => import('@/features/admin').then((m) => ({ default: m.RolesPage })))
const OrganisationPage = lazy(() => import('@/features/admin').then((m) => ({ default: m.OrganisationPage })))
const ImportPage = lazy(() => import('@/features/admin').then((m) => ({ default: m.ImportPage })))
const IntegrationsPage = lazy(() => import('@/features/admin').then((m) => ({ default: m.IntegrationsPage })))
const SettingsPage = lazy(() => import('@/features/admin').then((m) => ({ default: m.SettingsPage })))

const NotificationsPage = lazy(() => import('@/features/notifications').then((m) => ({ default: m.NotificationsPage })))
const SearchPage = lazy(() => import('@/features/search').then((m) => ({ default: m.SearchPage })))
const ProfilePage = lazy(() => import('@/features/profile').then((m) => ({ default: m.ProfilePage })))
const HelpPage = lazy(() => import('@/features/misc').then((m) => ({ default: m.HelpPage })))
const NotFoundPage = lazy(() => import('@/features/misc').then((m) => ({ default: m.NotFoundPage })))
const ForbiddenPage = lazy(() => import('@/features/misc').then((m) => ({ default: m.ForbiddenPage })))

/** Keeps the shell on screen while the next feature chunk arrives. */
function RouteFallback() {
  return (
    <div className="space-y-5" role="status" aria-live="polite">
      <span className="sr-only">Loading page</span>
      <div className="h-16 animate-pulse rounded-xl bg-ink-100" />
      <SkeletonStats />
      <SkeletonTable rows={6} />
    </div>
  )
}

/** Fallback for the split-screen sign-in chrome, which has no shell to keep. */
function AuthFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <Spinner className="h-5 w-5" />
    </div>
  )
}

/** Pathless layout route: the suspense boundary sits inside the shell. */
function SuspendedOutlet() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Outlet />
    </Suspense>
  )
}

/**
 * The route table mirrors `src/lib/navigation.ts`: every guarded route declares
 * the same permission its sidebar entry declares, so the navigation and the
 * router can never disagree about who may open a page.
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Public — sign-in, registration and recovery. */}
      <Route element={<RequireAnonymous />}>
        <Route
          element={
            <Suspense fallback={<AuthFallback />}>
              <Outlet />
            </Suspense>
          }
        >
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
      </Route>

      {/* Authenticated application shell. */}
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomeRedirect />} />

          {/* Every routed page below streams in behind the shell. */}
          <Route element={<SuspendedOutlet />}>
            {/* Dashboards — one per user class (ToR section 30). */}
            <Route
              path="/dashboard/system"
              element={
                <RequirePermission roles={['super_admin']}>
                  <SystemDashboard />
                </RequirePermission>
              }
            />
            <Route
              path="/dashboard/admin"
              element={
                <RequirePermission roles={['admin', 'super_admin']}>
                  <AdminDashboard />
                </RequirePermission>
              }
            />
            <Route
              path="/dashboard/legal"
              element={
                <RequirePermission roles={['legal', 'clerk', 'admin', 'super_admin']}>
                  <LegalDashboard />
                </RequirePermission>
              }
            />
            <Route
              path="/dashboard/audit"
              element={
                <RequirePermission roles={['auditor', 'super_admin']}>
                  <AuditorDashboard />
                </RequirePermission>
              }
            />

            {/* Requestor self-service (FR-010, FR-016). */}
            <Route
              path="/my-requests"
              element={
                <RequirePermission permission="case:read:own">
                  <MyRequestsPage />
                </RequirePermission>
              }
            />
            <Route
              path="/requests/new"
              element={
                <RequirePermission permission="case:create">
                  <NewRequestPage />
                </RequirePermission>
              }
            />

            {/* Case management (FR-020 → FR-025). */}
            <Route
              path="/cases"
              element={
                <RequirePermission permission={['case:read:all', 'case:read:assigned']}>
                  <CaseListPage />
                </RequirePermission>
              }
            />
            <Route
              path="/cases/new"
              element={
                <RequirePermission permission="case:create">
                  <NewCasePage />
                </RequirePermission>
              }
            />
            <Route
              path="/cases/:id"
              element={
                <RequirePermission permission={['case:read:all', 'case:read:assigned', 'case:read:own']}>
                  <CaseDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="/review-queue"
              element={
                <RequirePermission permission="case:triage">
                  <ReviewQueuePage />
                </RequirePermission>
              }
            />

            {/* Court diary (FR-034 → FR-036). */}
            <Route
              path="/court"
              element={
                <RequirePermission permission="court:read">
                  <CourtCalendarPage />
                </RequirePermission>
              }
            />
            <Route
              path="/court/:hearingId"
              element={
                <RequirePermission permission="court:read">
                  <CourtCalendarPage />
                </RequirePermission>
              }
            />

            {/* Documents (FR-070 → FR-073). */}
            <Route
              path="/documents"
              element={
                <RequirePermission permission="document:read">
                  <DocumentsPage />
                </RequirePermission>
              }
            />
            <Route
              path="/documents/:documentId"
              element={
                <RequirePermission permission="document:read">
                  <DocumentsPage />
                </RequirePermission>
              }
            />

            {/* Templates and reporting (FR-033, FR-050 → FR-054). */}
            <Route
              path="/templates"
              element={
                <RequirePermission permission="template:read">
                  <TemplatesPage />
                </RequirePermission>
              }
            />
            <Route
              path="/reports"
              element={
                <RequirePermission permission="report:read">
                  <ReportsPage />
                </RequirePermission>
              }
            />
            <Route
              path="/reports/builder"
              element={
                <RequirePermission permission="report:build">
                  <ReportBuilderPage />
                </RequirePermission>
              }
            />

            {/* Oversight (FR-006, FR-073). */}
            <Route
              path="/audit"
              element={
                <RequirePermission permission="audit:read">
                  <AuditTrailPage />
                </RequirePermission>
              }
            />
            <Route
              path="/audit/access"
              element={
                <RequirePermission permission="audit:read">
                  <AuditTrailPage />
                </RequirePermission>
              }
            />

            {/* Administration (FR-001 → FR-005, FR-044, FR-060, FR-070). */}
            <Route
              path="/admin/users"
              element={
                <RequirePermission permission="user:read">
                  <UsersPage />
                </RequirePermission>
              }
            />
            <Route
              path="/admin/roles"
              element={
                <RequirePermission permission="role:manage">
                  <RolesPage />
                </RequirePermission>
              }
            />
            <Route
              path="/admin/organisation"
              element={
                <RequirePermission permission="org:manage">
                  <OrganisationPage />
                </RequirePermission>
              }
            />
            <Route
              path="/admin/import"
              element={
                <RequirePermission permission="import:bulk">
                  <ImportPage />
                </RequirePermission>
              }
            />
            <Route
              path="/admin/integrations"
              element={
                <RequirePermission permission="integration:manage">
                  <IntegrationsPage />
                </RequirePermission>
              }
            />

            {/* System (FR-005, FR-046, monitoring and backups). */}
            <Route
              path="/system/settings"
              element={
                <RequirePermission permission="system:settings">
                  <SettingsPage />
                </RequirePermission>
              }
            />
            <Route
              path="/system/monitoring"
              element={
                <RequirePermission permission="system:monitor">
                  <SettingsPage />
                </RequirePermission>
              }
            />
            <Route
              path="/system/backups"
              element={
                <RequirePermission permission={['system:backup', 'system:export']}>
                  <SettingsPage />
                </RequirePermission>
              }
            />

            {/* Utility bar destinations — open to every signed-in user. */}
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/switch-account" element={<SwitchAccountPage />} />

            <Route path="/403" element={<ForbiddenPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}

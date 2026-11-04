/** Supported integration contracts. These are application capabilities, not seeded records. */
export const WEBHOOK_EVENTS = [
  'case.created',
  'case.assigned',
  'case.status_changed',
  'case.responded',
  'case.closed',
  'case.escalated',
  'case.appealed',
  'document.uploaded',
  'document.published',
  'court_date.scheduled',
  'court_date.outcome_recorded',
  'sla.due_soon',
  'sla.breached',
] as const

export const API_SCOPES = [
  'cases:read',
  'cases:write',
  'documents:read',
  'documents:write',
  'reports:read',
  'audit:read',
  'users:read',
  'webhooks:manage',
] as const

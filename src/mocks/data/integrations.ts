import type { ApiClient, Webhook } from '@/types'
import { relativeIso } from './reference'

/** Events an integrator can subscribe to (FR-070). */
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
]

export const API_SCOPES = [
  'cases:read',
  'cases:write',
  'documents:read',
  'documents:write',
  'reports:read',
  'audit:read',
  'users:read',
  'webhooks:manage',
]

export const webhooks: Webhook[] = [
  {
    id: 'whk-001',
    url: 'https://portal.hyprep.gov.ng/api/hooks/foi-status',
    events: ['case.status_changed', 'case.responded', 'case.closed'],
    isActive: true,
    secretMasked: 'whsec_••••••••••••4f8c',
    lastDeliveryAt: relativeIso(0, 8, 42),
    lastStatus: 200,
    createdAt: relativeIso(-240, 10, 0),
  },
  {
    id: 'whk-002',
    url: 'https://records.environment.gov.ng/integrations/hyprep/foi',
    events: ['case.created', 'case.closed', 'document.published'],
    isActive: true,
    secretMasked: 'whsec_••••••••••••91ab',
    lastDeliveryAt: relativeIso(-1, 16, 5),
    lastStatus: 200,
    createdAt: relativeIso(-180, 11, 30),
  },
  {
    id: 'whk-003',
    url: 'https://hooks.slack.com/services/T0000/B0000/hyprep-legal-alerts',
    events: ['sla.due_soon', 'sla.breached', 'case.escalated', 'case.appealed'],
    isActive: true,
    secretMasked: 'whsec_••••••••••••2d70',
    lastDeliveryAt: relativeIso(0, 6, 12),
    lastStatus: 200,
    createdAt: relativeIso(-120, 9, 15),
  },
  {
    id: 'whk-004',
    url: 'https://litigation.hyprep.gov.ng/api/diary/sync',
    events: ['court_date.scheduled', 'court_date.outcome_recorded'],
    isActive: true,
    secretMasked: 'whsec_••••••••••••c33e',
    lastDeliveryAt: relativeIso(-2, 12, 0),
    lastStatus: 500,
    createdAt: relativeIso(-95, 14, 0),
  },
  {
    id: 'whk-005',
    url: 'https://analytics-staging.hyprep.gov.ng/ingest/foi',
    events: ['case.created', 'case.status_changed'],
    isActive: false,
    secretMasked: 'whsec_••••••••••••78d1',
    lastDeliveryAt: relativeIso(-46, 10, 20),
    lastStatus: 410,
    createdAt: relativeIso(-70, 15, 45),
  },
]

export const apiClients: ApiClient[] = [
  {
    id: 'api-001',
    name: 'HYPREP Public FOI Portal',
    clientId: 'hyprep_portal_7f2c91a4',
    scopes: ['cases:read', 'cases:write', 'documents:read'],
    createdAt: relativeIso(-240, 10, 0),
    lastUsedAt: relativeIso(0, 9, 4),
    isActive: true,
  },
  {
    id: 'api-002',
    name: 'Ministry Records Exchange',
    clientId: 'fmenv_exchange_3b81de60',
    scopes: ['cases:read', 'documents:read', 'reports:read'],
    createdAt: relativeIso(-180, 11, 30),
    lastUsedAt: relativeIso(-1, 15, 48),
    isActive: true,
  },
  {
    id: 'api-003',
    name: 'Office of the Auditor-General (read-only)',
    clientId: 'oaugf_audit_5c04ab19',
    scopes: ['cases:read', 'audit:read', 'reports:read'],
    createdAt: relativeIso(-150, 9, 0),
    lastUsedAt: relativeIso(-6, 11, 22),
    isActive: true,
  },
  {
    id: 'api-004',
    name: 'Litigation Diary Sync',
    clientId: 'hyprep_diary_ae7712f3',
    scopes: ['cases:read', 'webhooks:manage'],
    createdAt: relativeIso(-95, 14, 0),
    lastUsedAt: relativeIso(-2, 12, 1),
    isActive: true,
  },
  {
    id: 'api-005',
    name: 'Data Warehouse (decommissioned)',
    clientId: 'hyprep_warehouse_1d9044c8',
    scopes: ['cases:read'],
    createdAt: relativeIso(-320, 8, 0),
    lastUsedAt: relativeIso(-88, 3, 30),
    isActive: false,
  },
]

/** Single sign-on configuration surfaced on the integrations screen (FR-004). */
export const ssoConfig = {
  provider: 'Microsoft Entra ID',
  isEnabled: true,
  domain: 'hyprep.gov.ng',
  tenantId: '8f14d2c6-4a7b-4e19-9c53-b0a71f2e6d84',
  metadataUrl: 'https://login.microsoftonline.com/8f14d2c6/federationmetadata/2007-06/federationmetadata.xml',
  defaultRole: 'clerk' as const,
  autoProvision: true,
  enforceForStaff: true,
  lastSyncAt: relativeIso(0, 5, 15),
  mappedGroups: [
    { group: 'HYPREP-Legal-Unit', roleId: 'legal' as const },
    { group: 'HYPREP-Legal-Admins', roleId: 'admin' as const },
    { group: 'HYPREP-Registry', roleId: 'clerk' as const },
    { group: 'OAuGF-Auditors', roleId: 'auditor' as const },
  ],
}

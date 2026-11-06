import { useMemo } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { Paginated, RoleId, User, UserStatus } from '@/types'
import {
  mapApiClient,
  mapBackup,
  mapCourt,
  mapDepartment,
  mapHealth,
  mapLegalTeam,
  mapRole,
  mapSettings,
  mapTaxonomyTerm,
  mapUser,
  mapWebhook,
} from './transform'

export interface LiveReference {
  assignableStaff: ReturnType<typeof mapUser>[]
  departments: ReturnType<typeof mapDepartment>[]
  courts: ReturnType<typeof mapCourt>[]
  legalTeams: ReturnType<typeof mapLegalTeam>[]
  tags: ReturnType<typeof mapTaxonomyTerm>[]
  outcomeCodes: ReturnType<typeof mapTaxonomyTerm>[]
  closureReasons: ReturnType<typeof mapTaxonomyTerm>[]
  retentionLabels: ReturnType<typeof mapTaxonomyTerm>[]
}

export const EMPTY_REFERENCE: LiveReference = {
  assignableStaff: [],
  departments: [],
  courts: [],
  legalTeams: [],
  tags: [],
  outcomeCodes: [],
  closureReasons: [],
  retentionLabels: [],
}

export interface UserDirectoryQuery {
  q?: string
  roleIds?: RoleId[]
  statuses?: UserStatus[]
  departments?: string[]
  page?: number
  pageSize?: number
}

export function useUserDirectory(options: UserDirectoryQuery = {}, enabled = true): Paginated<User> | undefined {
  const result = useQuery(api.queries.admin.listUsers, enabled ? {
    q: options.q,
    roleIds: options.roleIds,
    statuses: options.statuses,
    departments: options.departments,
    page: options.page ?? 1,
    pageSize: options.pageSize ?? 20,
  } : 'skip') as
    | { rows: unknown[] }
    | undefined
  return result ? { ...result, rows: result.rows.map(mapUser) } as Paginated<User> : undefined
}

export function useDirectory(enabled = true) {
  const result = useUserDirectory({ page: 1, pageSize: 200 }, enabled)
  return result?.rows ?? []
}

export function useReference(enabled = true): LiveReference | undefined {
  const result = useQuery(api.queries.admin.reference, enabled ? {} : 'skip') as
    | {
        departments: unknown[]
        courts: unknown[]
        legalTeams: unknown[]
        tags: unknown[]
        outcomeCodes: unknown[]
        closureReasons: unknown[]
        retentionLabels: unknown[]
        assignableStaff: unknown[]
      }
    | undefined
  if (!result) return undefined
  return {
    assignableStaff: result.assignableStaff.map(mapUser),
    departments: result.departments.map(mapDepartment),
    courts: result.courts.map(mapCourt),
    legalTeams: result.legalTeams.map(mapLegalTeam),
    tags: result.tags.map(mapTaxonomyTerm),
    outcomeCodes: result.outcomeCodes.map(mapTaxonomyTerm),
    closureReasons: result.closureReasons.map(mapTaxonomyTerm),
    retentionLabels: result.retentionLabels.map(mapTaxonomyTerm),
  }
}

export function useRoles(enabled = true) {
  const result = useQuery(api.queries.admin.roles, enabled ? {} : 'skip') as unknown[] | undefined
  return (result ?? []).map(mapRole)
}

export function useSystemSettings(enabled = true) {
  const result = useQuery(api.queries.admin.systemSettings, enabled ? {} : 'skip')
  return useMemo(() => mapSettings(result), [result])
}

export function usePublicSettings() {
  return useQuery(api.queries.admin.publicSettings, {}) as
    | { passwordMinLength: number; passwordRotationDays: number; selfRegistrationEnabled: boolean; sessionTimeoutMinutes: number; ssoEnabled: boolean }
    | null
    | undefined
}

export function useServiceHealth(enabled = true) {
  const result = useQuery(api.queries.admin.serviceHealth, enabled ? {} : 'skip') as unknown[] | undefined
  return (result ?? []).map(mapHealth)
}

export function useBackups(enabled = true) {
  const result = useQuery(api.queries.admin.backups, enabled ? {} : 'skip') as unknown[] | undefined
  return (result ?? []).map(mapBackup)
}

export function useWebhooks(enabled = true) {
  const result = useQuery(api.queries.admin.webhooks, enabled ? {} : 'skip') as unknown[] | undefined
  return (result ?? []).map(mapWebhook)
}

export function useApiClients(enabled = true) {
  const result = useQuery(api.queries.admin.apiClients, enabled ? {} : 'skip') as unknown[] | undefined
  return (result ?? []).map(mapApiClient)
}

export function useCreateUser() {
  const mutate = useMutation(api.mutations.admin.createUser)
  return (input: {
    name: string
    email: string
    roleId: RoleId
    organization: string
    position?: string
    department?: string
    phone?: string
    mfaEnabled: boolean
  }) => mutate(input)
}

export function useUpdateUser() {
  const mutate = useMutation(api.mutations.admin.updateUser)
  return (id: string, patch: Partial<User>) => mutate({ id: id as never, patch: patch as never })
}

export function useSetUserStatus() {
  const mutate = useMutation(api.mutations.admin.setUserStatus)
  return (id: string, status: UserStatus) => mutate({ id: id as never, status })
}

export function useResetUserMfa() {
  const mutate = useMutation(api.mutations.admin.resetUserMfa)
  return (id: string) => mutate({ id: id as never })
}

export function useBulkSetUserStatus() {
  const mutate = useMutation(api.mutations.admin.bulkSetUserStatus)
  return (ids: string[], status: UserStatus) => mutate({ ids: ids as never, status })
}

export function useSaveDepartment() {
  const mutate = useMutation(api.mutations.admin.saveDepartment)
  return (input: { id?: string; name: string; code: string; headUserId?: string | null }) => mutate({ ...input, id: input.id as never, headUserId: input.headUserId as never })
}

export function useSaveTaxonomyTerm() {
  const mutate = useMutation(api.mutations.admin.saveTaxonomyTerm)
  return (input: { id?: string; label: string; kind: 'tag' | 'category' | 'outcome_code' | 'closure_reason' | 'retention_label'; description?: string; color?: string }) => mutate({ ...input, id: input.id as never })
}

export function useDeleteTaxonomyTerm() {
  const mutate = useMutation(api.mutations.admin.deleteTaxonomyTerm)
  return (id: string) => mutate({ id: id as never })
}

export function useUpdateSettings() {
  const mutate = useMutation(api.mutations.admin.updateSettings)
  return (patch: Record<string, unknown>) => mutate({ patch })
}

export function useRunBackup() {
  const mutate = useMutation(api.mutations.admin.runBackup)
  return async (type: 'full' | 'incremental') => mapBackup(await mutate({ type }))
}

export function useSaveWebhook() {
  const mutate = useMutation(api.mutations.admin.saveWebhook)
  return (input: { id?: string; url: string; events: string[]; isActive: boolean }) => mutate({ ...input, id: input.id as never })
}

export function useDeleteWebhook() {
  const mutate = useMutation(api.mutations.admin.deleteWebhook)
  return (id: string) => mutate({ id: id as never })
}

export function useRotateApiSecret() {
  const mutate = useMutation(api.mutations.admin.rotateApiSecret)
  return async (id: string) => {
    const result = await mutate({ id: id as never })
    return result?.secret ?? ''
  }
}

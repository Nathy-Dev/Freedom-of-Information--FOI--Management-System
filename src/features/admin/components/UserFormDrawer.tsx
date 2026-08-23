import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import type { RoleId, User, UserStatus } from '@/types'
import { Button, Drawer, Input, Select, Toggle } from '@/components/ui'
import type { SelectOption } from '@/components/ui'
import { createUser, updateUser } from '@/mocks/adminApi'
import { reference } from '@/mocks/db'
import { ROLES, getRole } from '@/lib/rbac'
import { useAuth } from '@/store/AuthContext'
import { useToast } from '@/store/ToastContext'

const ROLE_OPTIONS: SelectOption[] = ROLES.map((role) => ({ value: role.id, label: role.name }))

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'active', label: 'Active' },
  { value: 'invited', label: 'Invited — awaiting first sign-in' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'locked', label: 'Locked — too many failed attempts' },
]

interface FormState {
  name: string
  email: string
  roleId: RoleId
  organization: string
  position: string
  department: string
  phone: string
  status: UserStatus
  mfaEnabled: boolean
}

const BLANK: FormState = {
  name: '',
  email: '',
  roleId: 'legal',
  organization: 'HYPREP',
  position: '',
  department: 'Legal Unit',
  phone: '',
  status: 'invited',
  mfaEnabled: true,
}

/** FR-001 / FR-005: invite a new account or amend an existing one. */
export function UserFormDrawer({
  open,
  user,
  onClose,
  onSaved,
}: {
  open: boolean
  user: User | null
  onClose: () => void
  onSaved: () => void
}) {
  const { user: actor } = useAuth()
  const toast = useToast()

  const [form, setForm] = useState<FormState>(BLANK)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [isBusy, setBusy] = useState(false)

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  useEffect(() => {
    if (!open) return
    setErrors({})
    setForm(
      user
        ? {
            name: user.name,
            email: user.email,
            roleId: user.roleId,
            organization: user.organization,
            position: user.position ?? '',
            department: user.department ?? '',
            phone: user.phone ?? '',
            status: user.status,
            mfaEnabled: user.mfaEnabled,
          }
        : BLANK,
    )
  }, [open, user])

  const submit = async () => {
    if (!actor) return
    const next: Partial<Record<keyof FormState, string>> = {}
    if (form.name.trim().length < 3) next.name = 'Enter the full name.'
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email address.'
    if (!form.organization.trim()) next.organization = 'Organisation is required.'
    const isInternal = form.roleId !== 'requestor' && form.roleId !== 'external'
    if (isInternal && !form.department.trim()) next.department = 'Internal accounts must belong to a department.'
    setErrors(next)
    if (Object.keys(next).length) return

    setBusy(true)
    try {
      if (user) {
        await updateUser(
          user.id,
          {
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            roleId: form.roleId,
            organization: form.organization.trim(),
            position: form.position.trim() || undefined,
            department: form.department.trim() || undefined,
            phone: form.phone.trim() || undefined,
            status: form.status,
            mfaEnabled: form.mfaEnabled,
          },
          actor.id,
        )
        toast.success('Account updated', `${form.name.trim()} was saved.`)
      } else {
        await createUser(
          {
            name: form.name.trim(),
            email: form.email.trim().toLowerCase(),
            roleId: form.roleId,
            organization: form.organization.trim(),
            position: form.position.trim() || undefined,
            department: form.department.trim() || undefined,
            phone: form.phone.trim() || undefined,
            mfaEnabled: form.mfaEnabled,
          },
          actor.id,
        )
        toast.success('Invitation sent', `${form.name.trim()} will receive an enrolment link by email.`)
      }
      onSaved()
    } finally {
      setBusy(false)
    }
  }

  const role = getRole(form.roleId)
  const departmentOptions: SelectOption[] = reference.departments.map((department) => ({
    value: department.name,
    label: department.name,
  }))

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={user ? `Edit ${user.name}` : 'Invite a new user'}
      description={
        user
          ? 'Changes take effect at the next request. Role changes are written to the audit trail.'
          : 'The account is created in the Invited state and receives an enrolment email with a single-use link.'
      }
      width="md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} isLoading={isBusy}>
            {user ? 'Save changes' : 'Send invitation'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Full name"
          placeholder="Barr. Adaeze Nwankwo"
          value={form.name}
          onChange={(event) => set('name', event.target.value)}
          error={errors.name}
          required
        />
        <Input
          type="email"
          label="Official email"
          placeholder="a.nwankwo@hyprep.gov.ng"
          value={form.email}
          onChange={(event) => set('email', event.target.value)}
          error={errors.email}
          required
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select
            label="Role"
            options={ROLE_OPTIONS}
            value={form.roleId}
            onChange={(event) => set('roleId', event.target.value as RoleId)}
          />
          {user ? (
            <Select
              label="Status"
              options={STATUS_OPTIONS}
              value={form.status}
              onChange={(event) => set('status', event.target.value as UserStatus)}
            />
          ) : (
            <Input label="Phone" placeholder="+234 803 000 0000" value={form.phone} onChange={(event) => set('phone', event.target.value)} />
          )}
        </div>
        <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-3">
          <p className="text-xs font-semibold text-brand-900">{role.name}</p>
          <p className="mt-1 text-xs leading-relaxed text-brand-800">{role.description}</p>
          <p className="mt-1.5 text-2xs text-brand-700">
            {role.permissions.length} permission{role.permissions.length === 1 ? '' : 's'} granted by this role.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Organisation"
            value={form.organization}
            onChange={(event) => set('organization', event.target.value)}
            error={errors.organization}
            required
          />
          <Select
            label="Department"
            options={departmentOptions}
            value={form.department}
            onChange={(event) => set('department', event.target.value)}
            placeholder="Not applicable"
            error={errors.department}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Position"
            placeholder="Senior Legal Officer"
            value={form.position}
            onChange={(event) => set('position', event.target.value)}
          />
          {user ? (
            <Input label="Phone" value={form.phone} onChange={(event) => set('phone', event.target.value)} />
          ) : null}
        </div>
        <div className="rounded-lg border border-ink-200 p-3">
          <Toggle
            checked={form.mfaEnabled}
            onChange={(value) => set('mfaEnabled', value)}
            label="Require multi-factor authentication"
            description="Required for all privileged roles. Enrolment is completed at first sign-in."
          />
          {!form.mfaEnabled && form.roleId !== 'requestor' ? (
            <p className="mt-2 flex items-start gap-1.5 text-2xs text-gold-700">
              <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0" />
              Internal accounts without MFA are flagged in the security report.
            </p>
          ) : null}
        </div>
      </div>
    </Drawer>
  )
}

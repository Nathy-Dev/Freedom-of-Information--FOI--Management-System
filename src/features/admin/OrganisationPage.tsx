import { useMemo, useState } from 'react'
import { Building2, Gavel, Landmark, Plus, Tag, Trash2, Users } from 'lucide-react'
import type { Department, TaxonomyTerm } from '@/types'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  Input,
  Modal,
  Select,
  Table,
  TableWrap,
  Tabs,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  UserChip,
} from '@/components/ui'
import type { SelectOption, TabItem } from '@/components/ui'
import { PageHeader } from '@/components/common'
import { deleteTaxonomyTerm, saveDepartment, saveTaxonomyTerm } from '@/mocks/adminApi'
import { db, reference, usersById } from '@/mocks/db'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'

type OrgTab = 'departments' | 'teams' | 'courts' | 'taxonomy'

type TaxonomyKind = TaxonomyTerm['kind']

const TABS: Array<TabItem<OrgTab>> = [
  { key: 'departments', label: 'Departments', icon: <Building2 className="h-4 w-4" /> },
  { key: 'teams', label: 'Legal teams', icon: <Users className="h-4 w-4" /> },
  { key: 'courts', label: 'Courts', icon: <Gavel className="h-4 w-4" /> },
  { key: 'taxonomy', label: 'Tags & codes', icon: <Tag className="h-4 w-4" /> },
]

const TAXONOMY_SECTIONS: Array<{ kind: TaxonomyKind; title: string; description: string }> = [
  { kind: 'tag', title: 'Case tags', description: 'Applied at triage to group requests by subject matter.' },
  { kind: 'outcome_code', title: 'Outcome codes', description: 'Recorded at closure and reported in the annual return.' },
  { kind: 'closure_reason', title: 'Closure reasons', description: 'Why a request left the active pipeline.' },
  { kind: 'retention_label', title: 'Retention labels', description: 'Drive the document retention schedule.' },
]

const KIND_OPTIONS: SelectOption[] = TAXONOMY_SECTIONS.map((section) => ({
  value: section.kind,
  label: section.title,
}))

function collectionFor(kind: TaxonomyKind): TaxonomyTerm[] {
  if (kind === 'tag') return reference.tags
  if (kind === 'outcome_code') return reference.outcomeCodes
  if (kind === 'closure_reason') return reference.closureReasons
  return reference.retentionLabels
}

/** FR-060: reference data behind departments, teams, courts and taxonomies. */
export function OrganisationPage() {
  const { user, can, isReadOnly } = useAuth()
  const { version, refresh } = useData()
  const toast = useToast()

  const [tab, setTab] = useState<OrgTab>('departments')
  const [department, setDepartment] = useState<Partial<Department> | null>(null)
  const [term, setTerm] = useState<(Partial<TaxonomyTerm> & { kind: TaxonomyKind }) | null>(null)
  const [pending, setPending] = useState<TaxonomyTerm | null>(null)
  const [isBusy, setBusy] = useState(false)

  const canManage = can('org:manage') && !isReadOnly

  const caseCounts = useMemo(() => {
    const map = new Map<string, number>()
    db.cases.forEach((row) => map.set(row.department, (map.get(row.department) ?? 0) + 1))
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const hearingCounts = useMemo(() => {
    const map = new Map<string, number>()
    db.courtDates.forEach((row) => map.set(row.courtId, (map.get(row.courtId) ?? 0) + 1))
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const headOptions: SelectOption[] = [
    { value: '', label: 'Not assigned' },
    ...reference.users
      .filter((row) => row.roleId !== 'requestor' && row.roleId !== 'external')
      .map((row) => ({ value: row.id, label: `${row.name} — ${row.position ?? row.department ?? 'HYPREP'}` })),
  ]

  const persistDepartment = async () => {
    if (!user || !department) return
    if (!department.name?.trim() || !department.code?.trim()) {
      toast.error('Name and code required', 'A department needs a display name and a short code.')
      return
    }
    setBusy(true)
    try {
      await saveDepartment(
        {
          id: department.id || `dep-${department.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 18)}`,
          name: department.name.trim(),
          code: department.code.trim().toUpperCase(),
          headUserId: department.headUserId || null,
        },
        user.id,
      )
      refresh()
      toast.success(department.id ? 'Department updated' : 'Department added', department.name.trim())
      setDepartment(null)
    } finally {
      setBusy(false)
    }
  }

  const persistTerm = async () => {
    if (!user || !term) return
    if (!term.label?.trim()) {
      toast.error('Label required', 'Enter the text that will appear on the case record.')
      return
    }
    setBusy(true)
    try {
      await saveTaxonomyTerm(
        {
          id: term.id || `${term.kind.slice(0, 2)}-${term.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20)}`,
          label: term.label.trim(),
          kind: term.kind,
          description: term.description?.trim() || undefined,
          color: term.color,
        },
        user.id,
      )
      refresh()
      toast.success(term.id ? 'Term updated' : 'Term added', term.label.trim())
      setTerm(null)
    } finally {
      setBusy(false)
    }
  }

  const removeTerm = async () => {
    if (!user || !pending) return
    setBusy(true)
    try {
      await deleteTaxonomyTerm(pending.id, pending.kind, user.id)
      refresh()
      toast.success('Term removed', `“${pending.label}” is no longer offered at triage.`)
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Organisation"
        description="Departments, legal teams, courts and the controlled vocabularies used across the case file."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Administration' }, { label: 'Organisation' }]}
        actions={
          canManage && tab === 'departments' ? (
            <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setDepartment({})}>
              Add department
            </Button>
          ) : canManage && tab === 'taxonomy' ? (
            <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setTerm({ kind: 'tag' })}>
              Add term
            </Button>
          ) : null
        }
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} label="Organisation sections" />

      {tab === 'departments' ? (
        <Card>
          <CardHeader
            title="Departments"
            description="Requests are routed to the department that holds the records."
            icon={<Building2 className="h-4 w-4" />}
          />
          <CardBody className="p-0">
            <TableWrap>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Department</Th>
                    <Th>Code</Th>
                    <Th>Head of department</Th>
                    <Th className="text-right">Requests</Th>
                    {canManage ? <Th className="text-right">Actions</Th> : null}
                  </Tr>
                </Thead>
                <Tbody>
                  {reference.departments.map((row) => {
                    const head = row.headUserId ? usersById.get(row.headUserId) : undefined
                    return (
                      <Tr key={row.id}>
                        <Td className="font-medium text-ink-900">{row.name}</Td>
                        <Td>
                          <Badge tone="neutral">{row.code}</Badge>
                        </Td>
                        <Td>{head ? <UserChip user={head} secondary={head.position} /> : <span className="text-xs text-ink-400">Vacant</span>}</Td>
                        <Td className="text-right">{caseCounts.get(row.name) ?? 0}</Td>
                        {canManage ? (
                          <Td className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => setDepartment(row)}>
                              Edit
                            </Button>
                          </Td>
                        ) : null}
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            </TableWrap>
          </CardBody>
        </Card>
      ) : null}

      {tab === 'teams' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {reference.legalTeams.map((team) => {
            const lead = usersById.get(team.leadUserId)
            return (
              <Card key={team.id}>
                <CardHeader title={team.name} description={team.focus} icon={<Users className="h-4 w-4" />} />
                <CardBody className="space-y-3">
                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Team lead</p>
                    <div className="mt-1.5">
                      {lead ? <UserChip user={lead} secondary={lead.position} /> : <span className="text-xs text-ink-400">Unassigned</span>}
                    </div>
                  </div>
                  <div>
                    <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500">
                      Members ({team.memberIds.length})
                    </p>
                    <ul className="mt-1.5 space-y-1.5">
                      {team.memberIds.map((id) => {
                        const member = usersById.get(id)
                        return member ? (
                          <li key={id}>
                            <UserChip user={member} secondary={member.position} size="sm" />
                          </li>
                        ) : null
                      })}
                    </ul>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      ) : null}

      {tab === 'courts' ? (
        <Card>
          <CardHeader
            title="Courts and divisions"
            description="Venues available when listing a judicial review under section 20 of the Act."
            icon={<Landmark className="h-4 w-4" />}
          />
          <CardBody className="p-0">
            <TableWrap>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Court</Th>
                    <Th>Division</Th>
                    <Th>State</Th>
                    <Th>Address</Th>
                    <Th className="text-right">Listed hearings</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {reference.courts.map((court) => (
                    <Tr key={court.id}>
                      <Td className="font-medium text-ink-900">{court.name}</Td>
                      <Td>{court.division}</Td>
                      <Td>{court.state}</Td>
                      <Td className="max-w-sm text-xs text-ink-500">{court.address}</Td>
                      <Td className="text-right">{hearingCounts.get(court.id) ?? 0}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          </CardBody>
        </Card>
      ) : null}

      {tab === 'taxonomy' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {TAXONOMY_SECTIONS.map((section) => (
            <Card key={section.kind}>
              <CardHeader
                title={section.title}
                description={section.description}
                icon={<Tag className="h-4 w-4" />}
                actions={
                  canManage ? (
                    <Button size="sm" variant="ghost" onClick={() => setTerm({ kind: section.kind })}>
                      Add
                    </Button>
                  ) : null
                }
              />
              <CardBody className="p-0">
                <ul className="divide-y divide-ink-200/70">
                  {collectionFor(section.kind).map((row) => (
                    <li key={row.id} className="flex items-start justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-800">{row.label}</p>
                        {row.description ? (
                          <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{row.description}</p>
                        ) : null}
                        <p className="mt-0.5 font-mono text-2xs text-ink-400">{row.id}</p>
                      </div>
                      {canManage ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setTerm(row)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            aria-label={`Delete ${row.label}`}
                            onClick={() => setPending(row)}
                          >
                            <Trash2 className="h-4 w-4 text-crest-600" />
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : null}

      <Modal
        open={Boolean(department)}
        onClose={() => setDepartment(null)}
        title={department?.id ? 'Edit department' : 'Add department'}
        description="Departments appear in the intake form, the review queue filters and the compliance report."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setDepartment(null)}>
              Cancel
            </Button>
            <Button onClick={persistDepartment} isLoading={isBusy}>
              Save department
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            label="Name"
            placeholder="Remediation & Restoration"
            value={department?.name ?? ''}
            onChange={(event) => setDepartment((prev) => ({ ...prev, name: event.target.value }))}
            required
          />
          <Input
            label="Short code"
            placeholder="REM"
            value={department?.code ?? ''}
            onChange={(event) => setDepartment((prev) => ({ ...prev, code: event.target.value }))}
            hint="Used on case references and exports."
            required
          />
          <Select
            label="Head of department"
            options={headOptions}
            value={department?.headUserId ?? ''}
            onChange={(event) => setDepartment((prev) => ({ ...prev, headUserId: event.target.value || null }))}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(term)}
        onClose={() => setTerm(null)}
        title={term?.id ? 'Edit term' : 'Add term'}
        description="Controlled vocabularies keep reporting consistent across the Legal Unit."
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setTerm(null)}>
              Cancel
            </Button>
            <Button onClick={persistTerm} isLoading={isBusy}>
              Save term
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Select
            label="Vocabulary"
            options={KIND_OPTIONS}
            value={term?.kind ?? 'tag'}
            onChange={(event) => setTerm((prev) => ({ ...prev, kind: event.target.value as TaxonomyKind }))}
            disabled={Boolean(term?.id)}
          />
          <Input
            label="Label"
            placeholder="Contractor Records"
            value={term?.label ?? ''}
            onChange={(event) => setTerm((prev) => (prev ? { ...prev, label: event.target.value } : prev))}
            required
          />
          <Input
            label="Description"
            placeholder="What this term covers, for the officer applying it."
            value={term?.description ?? ''}
            onChange={(event) => setTerm((prev) => (prev ? { ...prev, description: event.target.value } : prev))}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={removeTerm}
        title="Remove this term?"
        message={`“${pending?.label ?? ''}” will no longer be offered when officers tag or close a request. Existing case records keep the value they were saved with.`}
        confirmLabel="Remove term"
        destructive
        isBusy={isBusy}
      />
    </div>
  )
}

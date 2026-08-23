import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Inbox, Save, ShieldAlert } from 'lucide-react'
import type { CasePriority, CaseSource, Confidentiality, ResponseFormat } from '@/types'
import {
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  ChoiceChip,
  FileDrop,
  Input,
  Select,
  Textarea,
} from '@/components/ui'
import type { SelectOption } from '@/components/ui'
import { PageHeader } from '@/components/common'
import { createCase, uploadDocument } from '@/mocks/api'
import { reference } from '@/mocks/db'
import {
  CONFIDENTIALITY_META,
  PRIORITY_META,
  RESPONSE_FORMAT_LABELS,
  SOURCE_LABELS,
  STATUTORY_RESPONSE_DAYS,
} from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'

const SOURCE_OPTIONS: SelectOption[] = (
  ['email', 'walk_in', 'post', 'portal'] as CaseSource[]
).map((value) => ({ value, label: SOURCE_LABELS[value] }))

const FORMAT_OPTIONS: SelectOption[] = (
  ['electronic', 'hard_copy', 'inspection', 'certified_copy'] as ResponseFormat[]
).map((value) => ({ value, label: RESPONSE_FORMAT_LABELS[value] }))

const PRIORITY_ORDER: CasePriority[] = ['low', 'medium', 'high', 'critical']
const CONFIDENTIALITY_ORDER: Confidentiality[] = ['public', 'internal', 'confidential', 'restricted']

/**
 * FR-010: internal intake. Clerks log requests that arrive by email, post or at
 * the counter, and triage them in the same step so the case never sits unrouted.
 */
export function NewCasePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refresh } = useData()
  const toast = useToast()

  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    subject: '',
    description: '',
    department: reference.departments[0]?.name ?? 'Legal Unit',
    source: 'email' as CaseSource,
    responseFormat: 'electronic' as ResponseFormat,
    priority: 'medium' as CasePriority,
    confidentiality: 'public' as Confidentiality,
    assignedTo: '',
    tags: [] as string[],
  })

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const staffOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'Leave unassigned (goes to the triage queue)' },
      ...reference.assignableStaff.map((staff) => ({
        value: staff.id,
        label: `${staff.name} — ${staff.position ?? staff.department ?? 'Legal Unit'}`,
      })),
    ],
    [],
  )

  const departmentOptions = useMemo<SelectOption[]>(
    () => reference.departments.map((dep) => ({ value: dep.name, label: dep.name })),
    [],
  )

  const errors = useMemo(() => {
    const list: Record<string, string> = {}
    if (!form.name.trim()) list.name = 'Record the name of the requestor.'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) list.email = 'A contact email is required for the acknowledgement.'
    if (form.subject.trim().length < 8) list.subject = 'Summarise the request in a short title.'
    if (form.description.trim().length < 20) list.description = 'Capture the request as received, verbatim where possible.'
    return list
  }, [form])

  const dueDate = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() + STATUTORY_RESPONSE_DAYS)
    return date.toISOString().slice(0, 10)
  }, [])

  const toggleTag = (label: string) =>
    set('tags', form.tags.includes(label) ? form.tags.filter((tag) => tag !== label) : [...form.tags, label])

  const submit = async () => {
    setTouched(true)
    if (Object.keys(errors).length > 0 || !user) return
    setBusy(true)
    try {
      const created = await createCase(
        {
          subject: form.subject.trim(),
          description: form.description.trim(),
          department: form.department,
          priority: form.priority,
          confidentiality: form.confidentiality,
          responseFormat: form.responseFormat,
          source: form.source,
          tags: form.tags,
          requestorId: 'usr-external-walkin',
          requestor: {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || undefined,
            organization: form.organization.trim() || 'Private individual',
            isJournalist: form.tags.includes('Media Enquiry'),
          },
          assignedTo: form.assignedTo || null,
        },
        user.id,
      )

      for (const file of files) {
        await uploadDocument(
          created.id,
          {
            fileName: file.name,
            fileSize: file.size,
            kind: 'request',
            confidentiality: form.confidentiality,
            isPublic: false,
            retentionLabel: 'Standard - 7 years',
          },
          user.id,
        )
      }

      refresh()
      toast.success(`Case ${created.caseNumber} opened`, 'Acknowledgement queued to the requestor.')
      navigate(`/cases/${created.id}`)
    } catch {
      toast.error('Could not open the case', 'Check the required fields and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        breadcrumbs={[{ label: 'Cases', to: '/cases' }, { label: 'Log a request' }]}
        title="Log an FOI request"
        description={`For requests received off-portal. The statutory clock starts today and expires ${formatDate(dueDate)}.`}
        actions={
          <ButtonLink to="/cases" variant="ghost" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
            Cancel
          </ButtonLink>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader
              title="Requestor"
              description="Taken from the letter, email header or the counter register."
            />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Full name"
                required
                value={form.name}
                error={touched ? errors.name : null}
                onChange={(event) => set('name', event.target.value)}
              />
              <Input
                label="Email address"
                type="email"
                required
                value={form.email}
                error={touched ? errors.email : null}
                onChange={(event) => set('email', event.target.value)}
              />
              <Input
                label="Phone number"
                value={form.phone}
                onChange={(event) => set('phone', event.target.value)}
              />
              <Input
                label="Organisation"
                value={form.organization}
                hint="Leave blank for a private individual."
                onChange={(event) => set('organization', event.target.value)}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Request" description="Reproduce the request as received; do not paraphrase." />
            <CardBody className="space-y-4">
              <Input
                label="Title"
                required
                placeholder="e.g. Sampling results for the Bodo Creek sites, 2024"
                value={form.subject}
                error={touched ? errors.subject : null}
                onChange={(event) => set('subject', event.target.value)}
              />
              <Textarea
                label="Records requested"
                required
                rows={8}
                maxLength={4000}
                showCount
                value={form.description}
                error={touched ? errors.description : null}
                onChange={(event) => set('description', event.target.value)}
              />
              <FileDrop
                label="Scan of the original request"
                files={files}
                onChange={setFiles}
                multiple
                maxSizeMb={25}
                hint="Attach the signed letter or the printed email so the file is complete."
              />
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Triage" description="Route and classify the request at the point of intake." />
            <CardBody className="space-y-4">
              <Select
                label="Received via"
                value={form.source}
                options={SOURCE_OPTIONS}
                onChange={(event) => set('source', event.target.value as CaseSource)}
              />
              <Select
                label="Holding department"
                value={form.department}
                options={departmentOptions}
                onChange={(event) => set('department', event.target.value)}
              />
              <Select
                label="Assign to"
                value={form.assignedTo}
                options={staffOptions}
                onChange={(event) => set('assignedTo', event.target.value)}
              />
              <Select
                label="Response format requested"
                value={form.responseFormat}
                options={FORMAT_OPTIONS}
                onChange={(event) => set('responseFormat', event.target.value as ResponseFormat)}
              />

              <div>
                <p className="mb-1.5 text-sm font-medium text-ink-700">Priority</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRIORITY_ORDER.map((priority) => (
                    <ChoiceChip
                      key={priority}
                      selected={form.priority === priority}
                      dot={PRIORITY_META[priority].dot}
                      onClick={() => set('priority', priority)}
                    >
                      {PRIORITY_META[priority].label}
                    </ChoiceChip>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium text-ink-700">Confidentiality</p>
                <div className="flex flex-wrap gap-1.5">
                  {CONFIDENTIALITY_ORDER.map((level) => (
                    <ChoiceChip
                      key={level}
                      selected={form.confidentiality === level}
                      dot={CONFIDENTIALITY_META[level].dot}
                      onClick={() => set('confidentiality', level)}
                    >
                      {CONFIDENTIALITY_META[level].label}
                    </ChoiceChip>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-500">
                  {CONFIDENTIALITY_META[form.confidentiality].description}
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium text-ink-700">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {reference.tags.map((tag) => (
                    <ChoiceChip
                      key={tag.id}
                      selected={form.tags.includes(tag.label)}
                      onClick={() => toggleTag(tag.label)}
                    >
                      {tag.label}
                    </ChoiceChip>
                  ))}
                </div>
              </div>
            </CardBody>
            <CardFooter className="flex flex-col gap-2">
              <Button fullWidth onClick={submit} isLoading={busy} leadingIcon={<Save className="h-4 w-4" />}>
                Open case
              </Button>
              <p className="flex items-start gap-1.5 text-xs text-ink-500">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                An acknowledgement is issued automatically and the action is written to the audit trail.
              </p>
            </CardFooter>
          </Card>

          <Card>
            <CardBody className="flex items-start gap-2.5 text-xs text-ink-600">
              <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <p>
                Logging several requests at once? Use the{' '}
                <ButtonLink to="/admin/import" variant="ghost" size="sm" className="px-0 underline">
                  bulk CSV import
                </ButtonLink>{' '}
                instead — it validates and maps the columns before anything is created.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

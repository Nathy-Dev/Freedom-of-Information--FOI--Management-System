import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, FilePlus2, Info, Scale, Send } from 'lucide-react'
import type { ResponseFormat } from '@/types'
import {
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  FileDrop,
  Input,
  Select,
  Textarea,
} from '@/components/ui'
import type { SelectOption } from '@/components/ui'
import { DescriptionList, PageHeader } from '@/components/common'
import { createCase, uploadDocument } from '@/mocks/api'
import { reference } from '@/mocks/db'
import { RESPONSE_FORMAT_LABELS, STATUTORY_RESPONSE_DAYS } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'

type Step = 0 | 1 | 2

const STEPS = [
  { title: 'Your details', hint: 'So we can reach you with the determination' },
  { title: 'Your request', hint: 'Describe the records you are seeking' },
  { title: 'Review & submit', hint: 'Confirm before the clock starts' },
]

const FORMAT_OPTIONS: SelectOption[] = (
  ['electronic', 'hard_copy', 'inspection', 'certified_copy'] as ResponseFormat[]
).map((value) => ({ value, label: RESPONSE_FORMAT_LABELS[value] }))

const DEPARTMENT_OPTIONS: SelectOption[] = [
  { value: '', label: 'I am not sure — let HYPREP decide' },
  ...reference.departments.map((dep) => ({ value: dep.name, label: dep.name })),
]

interface FormState {
  name: string
  email: string
  phone: string
  organization: string
  isJournalist: boolean
  subject: string
  description: string
  department: string
  responseFormat: ResponseFormat
  consent: boolean
}

/** FR-010: the public request form. Submitting opens a case and starts the statutory clock. */
export function NewRequestPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { refresh } = useData()
  const toast = useToast()

  const [step, setStep] = useState<Step>(0)
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [touched, setTouched] = useState(false)
  const [receipt, setReceipt] = useState<{ id: string; caseNumber: string; due: string } | null>(null)

  const [form, setForm] = useState<FormState>({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    organization: user?.organization ?? '',
    isJournalist: /Premium Times|Sahara|TheCable|Reporters/i.test(user?.organization ?? ''),
    subject: '',
    description: '',
    department: '',
    responseFormat: 'electronic',
    consent: false,
  })

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const errors = useMemo(() => {
    const list: Partial<Record<keyof FormState, string>> = {}
    if (!form.name.trim()) list.name = 'Your full name is required.'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) list.email = 'Enter a valid email address.'
    if (form.subject.trim().length < 8) list.subject = 'Give the request a short, specific title.'
    if (form.description.trim().length < 40)
      list.description = 'Describe the records you want in at least 40 characters.'
    if (!form.consent) list.consent = 'Please confirm the declaration before submitting.'
    return list
  }, [form])

  const stepValid = (target: Step) => {
    if (target === 0) return !errors.name && !errors.email
    if (target === 1) return !errors.subject && !errors.description
    return Object.keys(errors).length === 0
  }

  const expectedDue = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() + STATUTORY_RESPONSE_DAYS)
    return date.toISOString().slice(0, 10)
  }, [])

  const next = () => {
    setTouched(true)
    if (!stepValid(step)) return
    setTouched(false)
    setStep((current) => (Math.min(2, current + 1) as Step))
  }

  const back = () => setStep((current) => (Math.max(0, current - 1) as Step))

  const submit = async () => {
    setTouched(true)
    if (!stepValid(2) || !user) return
    setBusy(true)
    try {
      const created = await createCase(
        {
          subject: form.subject.trim(),
          description: form.description.trim(),
          department: form.department || 'Legal Unit',
          priority: 'medium',
          confidentiality: 'public',
          responseFormat: form.responseFormat,
          source: 'portal',
          tags: form.isJournalist ? ['Media Enquiry'] : [],
          requestorId: user.id,
          requestor: {
            name: form.name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || undefined,
            organization: form.organization.trim() || 'Private individual',
            isJournalist: form.isJournalist,
          },
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
            confidentiality: 'public',
            isPublic: true,
            retentionLabel: 'Standard - 7 years',
          },
          user.id,
        )
      }

      refresh()
      toast.success(`Request ${created.caseNumber} submitted`, 'An acknowledgement has been sent to your email.')
      setReceipt({ id: created.id, caseNumber: created.caseNumber, due: created.statutoryDueDate })
    } catch {
      toast.error('Submission failed', 'Please review the form and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (receipt) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Card>
          <CardBody className="space-y-4 text-center">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-lg font-semibold text-ink-900">Your request has been received</h1>
              <p className="mt-1 text-sm text-ink-600">
                Keep the case number below — quote it in any correspondence with the Legal Unit.
              </p>
            </div>
            <p className="rounded-lg bg-ink-50 px-4 py-3 font-mono text-base font-semibold text-brand-700">
              {receipt.caseNumber}
            </p>
            <DescriptionList
              items={[
                { label: 'Submitted', value: formatDate(new Date().toISOString()) },
                { label: 'Response due by', value: formatDate(receipt.due) },
                { label: 'Statutory window', value: `${STATUTORY_RESPONSE_DAYS} working days` },
                { label: 'Attachments', value: files.length ? `${files.length} file(s)` : 'None' },
              ]}
            />
          </CardBody>
          <CardFooter className="flex flex-wrap justify-center gap-2">
            <ButtonLink to={`/cases/${receipt.id}`} leadingIcon={<Scale className="h-4 w-4" />}>
              Track this request
            </ButtonLink>
            <Button
              variant="outline"
              onClick={() => {
                setReceipt(null)
                setStep(0)
                setFiles([])
                set('subject', '')
                set('description', '')
                set('consent', false)
              }}
              leadingIcon={<FilePlus2 className="h-4 w-4" />}
            >
              Submit another request
            </Button>
            <Button variant="ghost" onClick={() => navigate('/my-requests')}>
              Go to my requests
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        breadcrumbs={[{ label: 'My requests', to: '/my-requests' }, { label: 'New request' }]}
        title="Make a Freedom of Information request"
        description="Submitted under the Freedom of Information Act 2011. HYPREP must respond within seven days of receipt."
        actions={
          <ButtonLink to="/my-requests" variant="ghost" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
            Cancel
          </ButtonLink>
        }
      />

      <ol className="grid gap-2 sm:grid-cols-3">
        {STEPS.map((item, index) => {
          const state = index === step ? 'current' : index < step ? 'done' : 'todo'
          return (
            <li
              key={item.title}
              className={
                state === 'current'
                  ? 'rounded-lg border border-brand-200 bg-brand-50/60 px-3 py-2'
                  : state === 'done'
                    ? 'rounded-lg border border-ink-200 bg-white px-3 py-2'
                    : 'rounded-lg border border-dashed border-ink-200 px-3 py-2'
              }
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-ink-800">
                <span
                  className={
                    state === 'todo'
                      ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink-100 text-xs text-ink-500'
                      : 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs text-white'
                  }
                >
                  {state === 'done' ? '✓' : index + 1}
                </span>
                {item.title}
              </p>
              <p className="mt-0.5 pl-7 text-xs text-ink-500">{item.hint}</p>
            </li>
          )
        })}
      </ol>

      {step === 0 ? (
        <Card>
          <CardHeader
            title="Your details"
            description="You do not have to give a reason for your request. We only need enough to reach you."
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
              hint="The acknowledgement and determination are sent here."
              value={form.email}
              error={touched ? errors.email : null}
              onChange={(event) => set('email', event.target.value)}
            />
            <Input
              label="Phone number"
              value={form.phone}
              hint="Optional. Used only if we need a quick clarification."
              onChange={(event) => set('phone', event.target.value)}
            />
            <Input
              label="Organisation"
              value={form.organization}
              hint="Leave blank if you are requesting as a private individual."
              onChange={(event) => set('organization', event.target.value)}
            />
            <div className="sm:col-span-2">
              <Checkbox
                label="I am requesting in my capacity as a journalist or media organisation"
                description="Flags the request for the media desk so responses are coordinated with Communications."
                checked={form.isJournalist}
                onChange={(event) => set('isJournalist', event.target.checked)}
              />
            </div>
          </CardBody>
          <CardFooter className="flex justify-end">
            <Button onClick={next} trailingIcon={<ArrowRight className="h-4 w-4" />}>
              Continue
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <CardHeader
            title="Your request"
            description="Be as specific as you can: the records sought, the period they cover and the sites involved."
          />
          <CardBody className="space-y-4">
            <Input
              label="Title of your request"
              required
              placeholder="e.g. Contract awards for the Ogale Phase 2 remediation lots"
              value={form.subject}
              error={touched ? errors.subject : null}
              onChange={(event) => set('subject', event.target.value)}
            />
            <Textarea
              label="Records you are requesting"
              required
              rows={9}
              maxLength={4000}
              showCount
              hint="Identify the documents, the date range and, where relevant, the site or community."
              value={form.description}
              error={touched ? errors.description : null}
              onChange={(event) => set('description', event.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Which part of HYPREP holds the records?"
                value={form.department}
                options={DEPARTMENT_OPTIONS}
                hint="If you are unsure, the Legal Unit will route it for you."
                onChange={(event) => set('department', event.target.value)}
              />
              <Select
                label="How would you like to receive the records?"
                value={form.responseFormat}
                options={FORMAT_OPTIONS}
                onChange={(event) => set('responseFormat', event.target.value as ResponseFormat)}
              />
            </div>
            <FileDrop
              label="Supporting documents (optional)"
              files={files}
              onChange={setFiles}
              multiple
              maxSizeMb={25}
              hint="PDF, Word, Excel or images up to 25 MB each. Files are scanned on upload."
            />
          </CardBody>
          <CardFooter className="flex justify-between">
            <Button variant="ghost" onClick={back} leadingIcon={<ArrowLeft className="h-4 w-4" />}>
              Back
            </Button>
            <Button onClick={next} trailingIcon={<ArrowRight className="h-4 w-4" />}>
              Review request
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader
            title="Review and submit"
            description="Check the details below. Submitting starts the statutory response clock."
          />
          <CardBody className="space-y-4">
            <DescriptionList
              items={[
                { label: 'Requestor', value: form.name },
                { label: 'Email', value: form.email },
                { label: 'Phone', value: form.phone || '—' },
                { label: 'Organisation', value: form.organization || 'Private individual' },
                { label: 'Title', value: form.subject || '—', span: true },
                {
                  label: 'Records requested',
                  value: <span className="whitespace-pre-line">{form.description || '—'}</span>,
                  span: true,
                },
                { label: 'Directed to', value: form.department || 'Legal Unit (to be routed)' },
                { label: 'Preferred format', value: RESPONSE_FORMAT_LABELS[form.responseFormat] },
                {
                  label: 'Attachments',
                  value: files.length ? files.map((file) => file.name).join(', ') : 'None',
                  span: true,
                },
                { label: 'Expected response by', value: formatDate(expectedDue) },
              ]}
            />

            <div className="flex gap-3 rounded-lg border border-brand-100 bg-brand-50/60 p-4 text-sm text-ink-700">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              <div className="space-y-1.5">
                <p className="font-semibold text-ink-800">What happens next</p>
                <p>
                  You will receive an acknowledgement with your case number immediately. HYPREP must respond
                  within {STATUTORY_RESPONSE_DAYS} days, which may be extended once by a further seven days
                  under section 6 of the Act where the request covers a large volume of records.
                </p>
                <p>
                  If access is refused, the notice will state the grounds and your right to apply to the Federal
                  High Court for judicial review under section 20.
                </p>
              </div>
            </div>

            <Checkbox
              label="I confirm the information given above is accurate"
              description="Knowingly providing false information in an application may affect the processing of your request."
              checked={form.consent}
              onChange={(event) => set('consent', event.target.checked)}
            />
            {touched && errors.consent ? (
              <p className="text-sm text-crest-600">{errors.consent}</p>
            ) : null}
          </CardBody>
          <CardFooter className="flex justify-between">
            <Button variant="ghost" onClick={back} leadingIcon={<ArrowLeft className="h-4 w-4" />}>
              Back
            </Button>
            <Button onClick={submit} isLoading={busy} leadingIcon={<Send className="h-4 w-4" />}>
              Submit request
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      <p className="text-center text-xs text-ink-500">
        Need help? Read the{' '}
        <Link to="/help" className="font-medium text-brand-700 hover:underline">
          guide to making a request
        </Link>
        . All times are Africa/Lagos (WAT).
      </p>
    </div>
  )
}

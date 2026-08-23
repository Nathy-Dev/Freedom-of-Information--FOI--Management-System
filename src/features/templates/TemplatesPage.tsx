import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Copy, Download, FileSignature, Pencil, Plus, Trash2, Wand2 } from 'lucide-react'
import type { LetterTemplate, TemplateCategory } from '@/types'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ChoiceChip,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  Select,
  Textarea,
} from '@/components/ui'
import type { SelectOption } from '@/components/ui'
import { PageHeader } from '@/components/common'
import { deleteTemplate, renderTemplate, saveTemplate } from '@/mocks/adminApi'
import { db, userName } from '@/mocks/db'
import { TEMPLATE_CATEGORY_LABELS } from '@/lib/constants'
import { formatRelative } from '@/lib/format'
import { cn, downloadTextFile } from '@/lib/utils'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'

const CATEGORY_ORDER: TemplateCategory[] = [
  'acknowledgement',
  'response',
  'refusal',
  'notice',
  'affidavit',
  'internal',
]

const MERGE_TOKENS = [
  '{{case_number}}',
  '{{requestor_name}}',
  '{{requestor_organization}}',
  '{{subject}}',
  '{{date_submitted}}',
  '{{statutory_due_date}}',
  '{{today}}',
  '{{officer_name}}',
  '{{officer_position}}',
  '{{exemption_grounds}}',
  '{{records_released}}',
  '{{records_withheld}}',
  '{{suit_number}}',
  '{{court_name}}',
  '{{hearing_date}}',
]

const BLANK: Omit<LetterTemplate, 'updatedAt' | 'usageCount' | 'updatedBy'> = {
  id: '',
  name: '',
  category: 'response',
  description: '',
  body: '',
  mergeFields: [],
}

/** FR-033: template library and the letter generator that merges one against a case. */
export function TemplatesPage() {
  const [params, setParams] = useSearchParams()
  const { user, can } = useAuth()
  const { version, refresh } = useData()
  const toast = useToast()

  const [category, setCategory] = useState<TemplateCategory | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [caseId, setCaseId] = useState(params.get('case') ?? '')
  const [rendered, setRendered] = useState<string | null>(null)
  const [editing, setEditing] = useState<typeof BLANK | null>(null)
  const [pendingDelete, setPendingDelete] = useState<LetterTemplate | null>(null)
  const [busy, setBusy] = useState(false)

  const templates = useMemo(() => {
    const rows = [...db.templates].sort((a, b) => a.name.localeCompare(b.name))
    return category === 'all' ? rows : rows.filter((row) => row.category === category)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, version])

  const selected = useMemo(
    () => db.templates.find((row) => row.id === selectedId) ?? templates[0] ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, templates, version],
  )

  const caseOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'Choose a case to merge against' },
      ...db.cases
        .slice(0, 60)
        .map((row) => ({ value: row.id, label: `${row.caseNumber} — ${row.subject.slice(0, 52)}` })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  )

  useEffect(() => {
    const fromUrl = params.get('case')
    if (fromUrl && fromUrl !== caseId) setCaseId(fromUrl)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const generate = () => {
    if (!selected || !user) return
    if (!caseId) {
      toast.warning('Pick a case first', 'The merge fields are filled from the case record.')
      return
    }
    setRendered(renderTemplate(selected, caseId, user))
    refresh()
  }

  const persist = async () => {
    if (!editing || !user) return
    if (editing.name.trim().length < 4 || editing.body.trim().length < 40) {
      toast.warning('Incomplete template', 'Give the template a name and a body of at least 40 characters.')
      return
    }
    setBusy(true)
    try {
      const saved = await saveTemplate(
        {
          ...editing,
          name: editing.name.trim(),
          description: editing.description.trim(),
          mergeFields: MERGE_TOKENS.filter((token) => editing.body.includes(token)),
          updatedBy: user.id,
        },
        user.id,
      )
      refresh()
      setSelectedId(saved.id)
      setEditing(null)
      toast.success('Template saved', `${saved.name} is available to the Legal Unit.`)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!pendingDelete || !user) return
    setBusy(true)
    try {
      await deleteTemplate(pendingDelete.id, user.id)
      refresh()
      setPendingDelete(null)
      setSelectedId(null)
      toast.success('Template deleted')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Letter templates"
        description="Standard HYPREP correspondence for FOI matters. Merge a template against a case to produce a letter ready for signature."
        actions={
          can('template:manage') ? (
            <Button
              onClick={() => setEditing({ ...BLANK })}
              leadingIcon={<Plus className="h-4 w-4" />}
            >
              New template
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <ChoiceChip selected={category === 'all'} onClick={() => setCategory('all')}>
          All ({db.templates.length})
        </ChoiceChip>
        {CATEGORY_ORDER.map((item) => (
          <ChoiceChip key={item} selected={category === item} onClick={() => setCategory(item)}>
            {TEMPLATE_CATEGORY_LABELS[item]}
          </ChoiceChip>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Library" description={`${templates.length} template(s)`} />
          <CardBody className="p-0">
            {templates.length === 0 ? (
              <EmptyState
                compact
                icon={<FileSignature className="h-5 w-5" />}
                title="No templates in this category"
                description="Choose another category or create a template."
              />
            ) : (
              <ul className="divide-y divide-ink-100">
                {templates.map((template) => (
                  <li key={template.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(template.id)
                        setRendered(null)
                      }}
                      className={cn(
                        'w-full px-5 py-3 text-left transition-colors hover:bg-ink-50',
                        selected?.id === template.id && 'bg-brand-50/60',
                      )}
                    >
                      <p className="flex items-center gap-2 text-sm font-semibold text-ink-800">
                        {template.name}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{template.description}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-400">
                        <Badge tone="neutral">{TEMPLATE_CATEGORY_LABELS[template.category]}</Badge>
                        used {template.usageCount}×
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {!selected ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={<FileSignature className="h-6 w-6" />}
                  title="Select a template"
                  description="Pick a template from the library to preview it and generate a letter."
                />
              </CardBody>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader
                  title={selected.name}
                  description={selected.description}
                  actions={
                    can('template:manage') ? (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditing({ ...selected })}
                          leadingIcon={<Pencil className="h-3.5 w-3.5" />}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPendingDelete(selected)}
                          leadingIcon={<Trash2 className="h-3.5 w-3.5" />}
                        >
                          Delete
                        </Button>
                      </div>
                    ) : null
                  }
                />
                <CardBody className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <Select
                      label="Merge against case"
                      value={caseId}
                      options={caseOptions}
                      onChange={(event) => {
                        setCaseId(event.target.value)
                        setRendered(null)
                        const draft = new URLSearchParams(params)
                        if (event.target.value) draft.set('case', event.target.value)
                        else draft.delete('case')
                        setParams(draft, { replace: true })
                      }}
                    />
                    <Button onClick={generate} leadingIcon={<Wand2 className="h-4 w-4" />}>
                      Generate letter
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {selected.mergeFields.map((field) => (
                      <span key={field} className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] text-ink-600">
                        {field}
                      </span>
                    ))}
                  </div>

                  <div className="max-h-80 overflow-auto rounded-lg border border-ink-200 bg-ink-50 p-4">
                    <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-ink-700">
                      {selected.body}
                    </pre>
                  </div>

                  <p className="text-xs text-ink-500">
                    Last updated {formatRelative(selected.updatedAt)} by {userName(selected.updatedBy)}.
                  </p>
                </CardBody>
              </Card>

              {rendered ? (
                <Card>
                  <CardHeader
                    title="Generated letter"
                    description="Merge fields resolved from the case record. Review, then download for signature."
                    actions={
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            void navigator.clipboard?.writeText(rendered)
                            toast.success('Copied to clipboard')
                          }}
                          leadingIcon={<Copy className="h-3.5 w-3.5" />}
                        >
                          Copy
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            const foiCase = db.cases.find((row) => row.id === caseId)
                            downloadTextFile(
                              `${(foiCase?.caseNumber ?? 'letter').replace(/\//g, '-')}-${selected.category}.txt`,
                              rendered,
                            )
                          }}
                          leadingIcon={<Download className="h-3.5 w-3.5" />}
                        >
                          Download
                        </Button>
                      </div>
                    }
                  />
                  <CardBody>
                    <div className="rounded-lg border border-ink-200 bg-white p-6 shadow-sm">
                      <pre className="whitespace-pre-wrap font-serif text-sm leading-relaxed text-ink-800">
                        {rendered}
                      </pre>
                    </div>
                  </CardBody>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        size="lg"
        title={editing?.id ? 'Edit template' : 'New template'}
        description="Use merge tokens so the letter fills itself from the case record."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={persist} isLoading={busy}>
              Save template
            </Button>
          </div>
        }
      >
        {editing ? (
          <div className="space-y-4">
            <Input
              label="Template name"
              value={editing.name}
              onChange={(event) => setEditing({ ...editing, name: event.target.value })}
            />
            <Select
              label="Category"
              value={editing.category}
              options={CATEGORY_ORDER.map((item) => ({ value: item, label: TEMPLATE_CATEGORY_LABELS[item] }))}
              onChange={(event) => setEditing({ ...editing, category: event.target.value as TemplateCategory })}
            />
            <Input
              label="Description"
              hint="Shown in the library so officers pick the right letter."
              value={editing.description}
              onChange={(event) => setEditing({ ...editing, description: event.target.value })}
            />
            <Textarea
              label="Body"
              rows={12}
              value={editing.body}
              onChange={(event) => setEditing({ ...editing, body: event.target.value })}
            />
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
                Available merge tokens
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MERGE_TOKENS.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => setEditing({ ...editing, body: `${editing.body}${token}` })}
                    className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[11px] text-ink-600 hover:bg-brand-100 hover:text-brand-800"
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        title="Delete this template?"
        message={`${pendingDelete?.name ?? ''} will no longer be available for letter generation. Letters already produced are unaffected.`}
        confirmLabel="Delete template"
        destructive
        isBusy={busy}
      />
    </div>
  )
}

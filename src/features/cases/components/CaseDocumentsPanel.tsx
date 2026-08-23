import { useState } from 'react'
import {
  Download,
  Eye,
  FileText,
  History,
  Highlighter,
  ShieldCheck,
  Upload,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Confidentiality, DocumentKind, FoiDocument } from '@/types'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DocumentKindBadge,
  EmptyState,
  FileDrop,
  Input,
  Modal,
  Select,
  Textarea,
  Tooltip,
} from '@/components/ui'
import type { SelectOption } from '@/components/ui'
import { publishDocument, recordAccess, redactDocument, uploadDocument } from '@/mocks/api'
import { reference, usersById } from '@/mocks/db'
import {
  CONFIDENTIALITY_META,
  DOCUMENT_KIND_META,
  OCR_LABELS,
  VIRUS_SCAN_LABELS,
} from '@/lib/constants'
import { formatBytes, formatDateTime, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/AuthContext'
import { useToast } from '@/store/ToastContext'

export interface CaseDocumentsPanelProps {
  caseId: string
  caseNumber: string
  documents: FoiDocument[]
  onChanged: () => void
  readOnly?: boolean
  canRedact?: boolean
  /** Requestors only ever see what has been published to them. */
  publishedOnly?: boolean
}

const KIND_OPTIONS: SelectOption[] = (
  ['request', 'response', 'evidence', 'court_filing', 'correspondence', 'internal_memo'] as DocumentKind[]
).map((kind) => ({ value: kind, label: DOCUMENT_KIND_META[kind].label }))

const CLASS_OPTIONS: SelectOption[] = (
  ['public', 'internal', 'confidential', 'restricted'] as Confidentiality[]
).map((level) => ({ value: level, label: CONFIDENTIALITY_META[level].label }))

/** FR-015, FR-031, FR-032: the document rail on a case file. */
export function CaseDocumentsPanel({
  caseId,
  caseNumber,
  documents,
  onChanged,
  readOnly = false,
  canRedact = false,
  publishedOnly = false,
}: CaseDocumentsPanelProps) {
  const { user } = useAuth()
  const toast = useToast()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [redactTarget, setRedactTarget] = useState<FoiDocument | null>(null)
  const [historyTarget, setHistoryTarget] = useState<FoiDocument | null>(null)
  const [busy, setBusy] = useState(false)

  const [files, setFiles] = useState<File[]>([])
  const [kind, setKind] = useState<DocumentKind>('response')
  const [level, setLevel] = useState<Confidentiality>('internal')
  const [retention, setRetention] = useState(reference.retentionLabels[0]?.label ?? 'Standard - 7 years')
  const [notifyRequestor, setNotifyRequestor] = useState(false)

  const [severances, setSeverances] = useState('3')
  const [grounds, setGrounds] = useState('Section 14 — personal information of a third party')

  const visible = publishedOnly ? documents.filter((doc) => doc.isPublic) : documents

  const doUpload = async () => {
    if (!user || files.length === 0) return
    setBusy(true)
    try {
      for (const file of files) {
        await uploadDocument(
          caseId,
          {
            fileName: file.name,
            fileSize: file.size,
            kind,
            confidentiality: level,
            isPublic: notifyRequestor,
            retentionLabel: retention,
          },
          user.id,
        )
      }
      onChanged()
      toast.success(
        `${files.length} ${files.length === 1 ? 'document' : 'documents'} uploaded`,
        'Each file was virus-scanned and versioned against this case.',
      )
      setFiles([])
      setUploadOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const doRedact = async () => {
    if (!user || !redactTarget) return
    setBusy(true)
    try {
      await redactDocument(
        redactTarget.id,
        { redactionCount: Math.max(1, Number(severances) || 1), grounds },
        user.id,
      )
      onChanged()
      toast.success('Redactions recorded', `A new version of ${redactTarget.fileName} was created.`)
      setRedactTarget(null)
    } finally {
      setBusy(false)
    }
  }

  const doPublish = async (doc: FoiDocument) => {
    if (!user) return
    await publishDocument(doc.id, user.id)
    onChanged()
    toast.success('Published to the requestor', `${doc.fileName} is now downloadable in their portal.`)
  }

  const doDownload = (doc: FoiDocument) => {
    if (!user) return
    recordAccess(doc, user.id, 'download')
    toast.info('Download recorded', `Access to ${doc.fileName} was written to the access log.`)
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Documents"
          description={`${visible.length} ${visible.length === 1 ? 'file' : 'files'} on ${caseNumber}. Every download is logged.`}
          icon={<FileText className="h-4 w-4" />}
          actions={
            readOnly ? null : (
              <Button size="sm" onClick={() => setUploadOpen(true)} leadingIcon={<Upload className="h-3.5 w-3.5" />}>
                Upload
              </Button>
            )
          }
        />
        <CardBody>
          {visible.length === 0 ? (
            <EmptyState
              compact
              icon={<FileText className="h-5 w-5" />}
              title="No documents yet"
              description={
                publishedOnly
                  ? 'Documents appear here once HYPREP publishes its response.'
                  : 'Upload the request letter, evidence and the signed response as the case progresses.'
              }
            />
          ) : (
            <ul className="divide-y divide-ink-200/70">
              {visible.map((doc) => {
                const uploader = usersById.get(doc.uploadedBy)
                return (
                  <li key={doc.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/documents/${doc.id}`}
                            className="truncate text-sm font-semibold text-ink-900 hover:text-brand-700 hover:underline"
                          >
                            {doc.fileName}
                          </Link>
                          <DocumentKindBadge kind={doc.kind} size="sm" />
                          {doc.isRedacted ? (
                            <Badge tone="warning" size="sm">
                              {doc.redactionCount} severances
                            </Badge>
                          ) : null}
                          {doc.isPublic ? (
                            <Badge tone="success" size="sm">
                              Published
                            </Badge>
                          ) : null}
                          {doc.virusScan !== 'clean' ? (
                            <Badge tone={doc.virusScan === 'infected' ? 'danger' : 'neutral'} size="sm">
                              {VIRUS_SCAN_LABELS[doc.virusScan]}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-2xs text-ink-500">
                          Version {doc.version} · {formatBytes(doc.fileSize)} ·{' '}
                          {CONFIDENTIALITY_META[doc.confidentiality].label} · {OCR_LABELS[doc.ocr]} · uploaded by{' '}
                          {uploader?.name ?? 'System'} {formatRelative(doc.createdAt)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <Tooltip content="Open in the viewer">
                          <Link
                            to={`/documents/${doc.id}`}
                            aria-label={`Preview ${doc.fileName}`}
                            className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
                          >
                            <Eye aria-hidden className="h-4 w-4" />
                          </Link>
                        </Tooltip>
                        <Tooltip content="Download (logged)">
                          <button
                            type="button"
                            onClick={() => doDownload(doc)}
                            aria-label={`Download ${doc.fileName}`}
                            className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
                          >
                            <Download aria-hidden className="h-4 w-4" />
                          </button>
                        </Tooltip>
                        {doc.versions.length > 1 ? (
                          <Tooltip content={`${doc.versions.length} versions`}>
                            <button
                              type="button"
                              onClick={() => setHistoryTarget(doc)}
                              aria-label={`Version history for ${doc.fileName}`}
                              className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
                            >
                              <History aria-hidden className="h-4 w-4" />
                            </button>
                          </Tooltip>
                        ) : null}
                        {canRedact && !readOnly ? (
                          <Tooltip content="Apply redactions">
                            <button
                              type="button"
                              onClick={() => setRedactTarget(doc)}
                              aria-label={`Redact ${doc.fileName}`}
                              className="rounded-md p-1.5 text-ink-500 transition-colors hover:bg-gold-100 hover:text-gold-700"
                            >
                              <Highlighter aria-hidden className="h-4 w-4" />
                            </button>
                          </Tooltip>
                        ) : null}
                        {!readOnly && !doc.isPublic && doc.kind === 'response' ? (
                          <Button size="sm" variant="outline" onClick={() => doPublish(doc)}>
                            Publish
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-2xs text-ink-400">
                      Retention: {doc.retentionLabel} · checksum {doc.checksum}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload documents"
        description="Files are virus-scanned, checksummed and versioned. Re-uploading the same filename creates a new version."
        footer={
          <>
            <Button variant="ghost" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button isLoading={busy} disabled={files.length === 0} onClick={doUpload}>
              Upload {files.length > 0 ? `${files.length} file${files.length === 1 ? '' : 's'}` : ''}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FileDrop
            files={files}
            onChange={setFiles}
            multiple
            maxSizeMb={25}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.zip"
            hint="PDF, Word, Excel, images or a ZIP bundle, up to 25 MB each."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Document type"
              options={KIND_OPTIONS}
              value={kind}
              onChange={(event) => setKind(event.target.value as DocumentKind)}
            />
            <Select
              label="Classification"
              options={CLASS_OPTIONS}
              value={level}
              onChange={(event) => setLevel(event.target.value as Confidentiality)}
            />
            <Select
              label="Retention schedule"
              options={reference.retentionLabels.map((item) => ({ value: item.label, label: item.label }))}
              value={retention}
              onChange={(event) => setRetention(event.target.value)}
            />
            <div className="flex items-end">
              <label className="flex items-start gap-2 text-sm text-ink-700">
                <input
                  type="checkbox"
                  checked={notifyRequestor}
                  onChange={(event) => setNotifyRequestor(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                <span>
                  Publish to the requestor
                  <span className="block text-2xs text-ink-500">
                    They are emailed and the file appears in their portal.
                  </span>
                </span>
              </label>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(redactTarget)}
        onClose={() => setRedactTarget(null)}
        title="Apply redactions"
        description={redactTarget ? `A new version of ${redactTarget.fileName} will be created.` : ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRedactTarget(null)}>
              Cancel
            </Button>
            <Button isLoading={busy} onClick={doRedact}>
              Record redactions
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Number of severances"
            type="number"
            min={1}
            value={severances}
            onChange={(event) => setSeverances(event.target.value)}
          />
          <Textarea
            label="Grounds relied upon"
            rows={3}
            value={grounds}
            onChange={(event) => setGrounds(event.target.value)}
            hint="Cite the section of the Freedom of Information Act 2011 for each severance."
          />
          <p className="flex items-start gap-2 rounded-lg bg-gold-50 p-3 text-xs text-gold-800">
            <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            The unredacted original is retained under legal hold and remains available to auditors.
          </p>
        </div>
      </Modal>

      <Modal
        open={Boolean(historyTarget)}
        onClose={() => setHistoryTarget(null)}
        title="Version history"
        description={historyTarget?.fileName}
      >
        <ol className="space-y-3">
          {[...(historyTarget?.versions ?? [])].reverse().map((entry) => (
            <li
              key={entry.version}
              className={cn(
                'rounded-lg border p-3',
                entry.version === historyTarget?.version
                  ? 'border-brand-300 bg-brand-50/60'
                  : 'border-ink-200 bg-white',
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink-900">Version {entry.version}</span>
                <span className="text-2xs text-ink-500">{formatDateTime(entry.createdAt)}</span>
              </div>
              <p className="mt-1 text-xs text-ink-700">{entry.changeNote}</p>
              <p className="mt-1 text-2xs text-ink-500">
                {usersById.get(entry.uploadedBy)?.name ?? 'System'} · {formatBytes(entry.fileSize)} · checksum{' '}
                {entry.checksum}
              </p>
            </li>
          ))}
        </ol>
      </Modal>
    </>
  )
}

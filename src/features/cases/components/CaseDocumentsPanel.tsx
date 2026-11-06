import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../../convex/_generated/api'
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
import { usePublishDocument, useDocumentFile, useRedactDocument, useUploadDocument } from '@/api/documents'
import { useData } from '@/store/DataContext'
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
  const { user, can } = useAuth()
  const setLegalHold = useMutation(api.mutations.documents.setLegalHold)
  const [holdTarget, setHoldTarget] = useState<FoiDocument | null>(null)
  const [holdReason, setHoldReason] = useState('')
  const { reference, usersById } = useData()
  const liveReference = reference ?? { retentionLabels: [] }
  const uploadDocument = useUploadDocument()
  const redactDocument = useRedactDocument()
  const publishDocument = usePublishDocument()
  const getFile = useDocumentFile()
  const toast = useToast()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [redactTarget, setRedactTarget] = useState<FoiDocument | null>(null)
  const [historyTarget, setHistoryTarget] = useState<FoiDocument | null>(null)
  const [busy, setBusy] = useState(false)

  const [files, setFiles] = useState<File[]>([])
  const [kind, setKind] = useState<DocumentKind>('response')
  const [level, setLevel] = useState<Confidentiality>('internal')
  const [retention, setRetention] = useState('7 years')

  const [severances, setSeverances] = useState('3')
  const [disclosureFile, setDisclosureFile] = useState<File | null>(null)
  const [confirmedRemoval, setConfirmedRemoval] = useState(false)
  const [releaseError, setReleaseError] = useState('')
  const [grounds, setGrounds] = useState('Section 14 — personal information of a third party')

  const visible = publishedOnly ? documents.filter((doc) => doc.isPublic) : documents

  const doUpload = async () => {
    if (!user || files.length === 0) return
    setBusy(true)
    try {
      for (const file of files) {
        await uploadDocument(caseId, file, {
            kind,
            confidentiality: level,
            isPublic: false,
            retentionLabel: retention,
        })
      }
      onChanged()
      toast.success(
        `${files.length} ${files.length === 1 ? 'document' : 'documents'} uploaded`,
        'Files are queued for virus scanning. They cannot be opened until the checks pass.',
      )
      setFiles([])
      setUploadOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const doRedact = async () => {
    if (!user || !redactTarget || !disclosureFile) return
    setReleaseError('')
    setBusy(true)
    try {
      await redactDocument(redactTarget.id, Math.max(1, Number(severances) || 1), grounds, disclosureFile, confirmedRemoval)
      onChanged()
      toast.success('Disclosure copy saved', 'The file must pass a virus scan before it can be published.')
      setRedactTarget(null)
      setDisclosureFile(null)
      setConfirmedRemoval(false)
    } catch (failure) {
      setReleaseError(failure instanceof Error ? failure.message : 'The disclosure copy could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const doPublish = async (doc: FoiDocument) => {
    if (!user) return
    await publishDocument(doc.id)
    onChanged()
    toast.success('Published to the requestor', `${doc.fileName} is now downloadable in their portal.`)
  }

  const doDownload = async (doc: FoiDocument) => {
    if (!user) return
    try {
      const file = await getFile(doc.id)
      const response = await fetch(file.url)
      if (!response.ok) throw new Error('Download failed or access expired.')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a'); link.href = url; link.download = file.filename; link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('File downloaded', 'Access was recorded in the audit trail.')
    } catch (error) { toast.error('Download failed', error instanceof Error ? error.message : 'Please try again.') }
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
                      {can('document:retention') && !readOnly ? <Button size="sm" variant="outline" onClick={() => { setHoldTarget(doc); setHoldReason('') }}>{doc.legalHold ? 'Release legal hold' : 'Place legal hold'}</Button> : null}
                      Retention: {doc.retentionLabel} · checksum {doc.checksum}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal open={Boolean(holdTarget)} onClose={() => setHoldTarget(null)} title={holdTarget?.legalHold ? 'Release legal hold' : 'Place legal hold'} footer={<Button isLoading={busy} disabled={holdReason.trim().length < 10} onClick={async () => {
        if (!holdTarget) return
        setBusy(true)
        try {
          await setLegalHold({ documentId: holdTarget.id as never, enabled: !holdTarget.legalHold, reason: holdReason })
          setHoldTarget(null)
          onChanged()
          toast.success('Legal hold updated', 'The reason is recorded. Releasing a hold does not delete the file.')
        } catch (error) { toast.error('Legal hold not changed', error instanceof Error ? error.message : 'Please try again.') }
        finally { setBusy(false) }
      }}>Confirm change</Button>}>
        <Textarea label="Reason for this change" value={holdReason} onChange={(event) => setHoldReason(event.target.value)} maxLength={1000} />
      </Modal>
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
              options={liveReference.retentionLabels.map((item) => ({ value: item.label, label: item.label }))}
              value={retention}
              onChange={(event) => setRetention(event.target.value)}
            />
            <p className="text-xs text-ink-600">Files are uploaded privately. After scanning and any necessary redactions, use Publish to release an approved response to the requestor.</p>
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
            <Button isLoading={busy} disabled={!disclosureFile || !confirmedRemoval} onClick={doRedact}>
              Save disclosure copy
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Number of items removed"
            type="number"
            min={1}
            value={severances}
            onChange={(event) => setSeverances(event.target.value)}
          />
          <Input label="Permanently edited disclosure PDF" type="file" accept="application/pdf" onChange={(event) => setDisclosureFile(event.target.files?.[0] ?? null)} />
          <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmedRemoval} onChange={(event) => setConfirmedRemoval(event.target.checked)} />I checked that sensitive text, images, metadata and attachments were permanently removed, not just covered.</label>
          {releaseError && <p role="alert" className="text-sm text-red-700">{releaseError}</p>}
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

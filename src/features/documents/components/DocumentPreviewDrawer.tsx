import { Link } from 'react-router-dom'
import { Download, FileText, History, Lock, ScanLine, ShieldCheck } from 'lucide-react'
import type { FoiDocument } from '@/types'
import {
  Badge,
  Button,
  ConfidentialityBadge,
  DocumentKindBadge,
  Drawer,
} from '@/components/ui'
import { DescriptionList } from '@/components/common'
import { recordAccess } from '@/mocks/api'
import { db, userName } from '@/mocks/db'
import { OCR_LABELS, VIRUS_SCAN_LABELS } from '@/lib/constants'
import { formatBytes, formatDate, formatDateTime } from '@/lib/format'
import { useAuth } from '@/store/AuthContext'
import { useToast } from '@/store/ToastContext'

export interface DocumentPreviewDrawerProps {
  document: FoiDocument | null
  onClose: () => void
  canDownload?: boolean
}

/**
 * FR-031: preview without downloading. The prototype renders a representative
 * page frame rather than the file itself, and logs every view for the access log.
 */
export function DocumentPreviewDrawer({ document, onClose, canDownload = false }: DocumentPreviewDrawerProps) {
  const { user } = useAuth()
  const toast = useToast()

  if (!document) return null

  const foiCase = db.cases.find((item) => item.id === document.caseId)

  const download = () => {
    if (!user) return
    recordAccess(document, user.id, 'download')
    toast.info('Download recorded', `${document.fileName} written to the access log.`)
  }

  return (
    <Drawer
      open={Boolean(document)}
      onClose={onClose}
      width="lg"
      title={
        <span className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-600" />
          <span className="truncate">{document.fileName}</span>
        </span>
      }
      description={`${formatBytes(document.fileSize)} · ${document.fileType.toUpperCase()} · version ${document.version}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {canDownload ? (
            <Button onClick={download} leadingIcon={<Download className="h-4 w-4" />}>
              Download
            </Button>
          ) : (
            <Button variant="outline" disabled leadingIcon={<Lock className="h-4 w-4" />}>
              Download restricted
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <DocumentKindBadge kind={document.kind} />
          <ConfidentialityBadge level={document.confidentiality} />
          {document.isRedacted ? <Badge tone="warning">{document.redactionCount} redactions</Badge> : null}
          {document.isPublic ? <Badge tone="success">Released to requestor</Badge> : null}
        </div>

        <div className="overflow-hidden rounded-lg border border-ink-200 bg-ink-50">
          <div className="flex items-center justify-between border-b border-ink-200 bg-white px-3 py-2 text-xs text-ink-500">
            <span>Preview — page 1 of {Math.max(1, Math.round(document.fileSize / 240_000))}</span>
            <span className="inline-flex items-center gap-1">
              <ScanLine className="h-3.5 w-3.5" />
              {OCR_LABELS[document.ocr]}
            </span>
          </div>
          <div className="space-y-2.5 bg-white p-5">
            <div className="mx-auto h-3 w-2/3 rounded bg-ink-200" />
            <div className="mx-auto h-2 w-1/3 rounded bg-ink-100" />
            <div className="h-px bg-ink-100" />
            {Array.from({ length: 9 }, (_, index) => {
              const redacted = document.isRedacted && (index === 2 || index === 5 || index === 6)
              return (
                <div
                  key={index}
                  className={
                    redacted
                      ? 'h-2.5 rounded bg-ink-800'
                      : 'h-2.5 rounded bg-ink-100'
                  }
                  style={{ width: `${redacted ? 45 + index * 3 : 70 + ((index * 7) % 28)}%` }}
                />
              )
            })}
            {document.isRedacted ? (
              <p className="pt-2 text-[11px] italic text-ink-500">
                Blacked-out passages are severed under the Freedom of Information Act 2011. Each severance is
                recorded against a ground in the redaction schedule.
              </p>
            ) : null}
          </div>
        </div>

        <DescriptionList
          columns={1}
          items={[
            {
              label: 'Case',
              value: foiCase ? (
                <Link
                  to={`/cases/${foiCase.id}?tab=documents`}
                  className="font-medium text-brand-700 hover:underline"
                >
                  {foiCase.caseNumber} — {foiCase.subject}
                </Link>
              ) : (
                '—'
              ),
            },
            { label: 'Uploaded by', value: `${userName(document.uploadedBy)} · ${formatDateTime(document.createdAt)}` },
            { label: 'Virus scan', value: VIRUS_SCAN_LABELS[document.virusScan] },
            { label: 'Checksum (SHA-256 head)', value: <span className="font-mono text-xs">{document.checksum}</span> },
            { label: 'Retention label', value: document.retentionLabel },
            { label: 'Retain until', value: formatDate(document.retainUntil) },
          ]}
        />

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-800">
            <History className="h-4 w-4 text-ink-400" />
            Version history ({document.versions.length})
          </p>
          <ul className="space-y-2">
            {[...document.versions].reverse().map((entry) => (
              <li key={entry.version} className="rounded-lg border border-ink-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-800">Version {entry.version}</span>
                  <span className="text-xs text-ink-500">{formatDateTime(entry.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-xs text-ink-600">{entry.changeNote}</p>
                <p className="mt-0.5 text-xs text-ink-400">
                  {userName(entry.uploadedBy)} · {formatBytes(entry.fileSize)} ·{' '}
                  <span className="font-mono">{entry.checksum}</span>
                </p>
              </li>
            ))}
          </ul>
        </div>

        <p className="flex items-start gap-1.5 text-xs text-ink-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Views, downloads and prints are written to the document access log against your account.
        </p>
      </div>
    </Drawer>
  )
}

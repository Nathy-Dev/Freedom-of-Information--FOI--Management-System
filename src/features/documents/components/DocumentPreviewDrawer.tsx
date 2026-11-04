import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileText, History, Lock, ScanLine, ShieldCheck } from 'lucide-react'
import type { FoiDocument } from '@/types'
import { Badge, Button, ConfidentialityBadge, DocumentKindBadge, Drawer } from '@/components/ui'
import { DescriptionList } from '@/components/common'
import { useRecordDocumentAccess } from '@/api/documents'
import { OCR_LABELS, VIRUS_SCAN_LABELS } from '@/lib/constants'
import { formatBytes, formatDate, formatDateTime } from '@/lib/format'
import { useToast } from '@/store/ToastContext'
import { useData } from '@/store/DataContext'

export interface DocumentPreviewDrawerProps {
  document: FoiDocument | null
  onClose: () => void
  canDownload?: boolean
}

/** FR-031: preview the live file URL and record access against the signed-in user. */
export function DocumentPreviewDrawer({ document, onClose, canDownload = false }: DocumentPreviewDrawerProps) {
  const { cases, usersById } = useData()
  const recordAccess = useRecordDocumentAccess()
  const toast = useToast()

  useEffect(() => {
    if (document) void recordAccess(document.id, 'view')
  }, [document, recordAccess])

  if (!document) return null

  const foiCase = cases.find((item) => item.id === document.caseId)
  const uploadedBy = usersById.get(document.uploadedBy)?.name ?? document.uploadedBy

  const download = () => {
    void recordAccess(document.id, 'download')
    if (document.url) window.open(document.url, '_blank', 'noopener,noreferrer')
    toast.info('Download recorded', `${document.fileName} written to the access log.`)
  }

  return (
    <Drawer
      open={Boolean(document)}
      onClose={onClose}
      width="lg"
      title={<span className="flex items-center gap-2"><FileText className="h-4 w-4 text-brand-600" /><span className="truncate">{document.fileName}</span></span>}
      description={`${formatBytes(document.fileSize)} · ${document.fileType.toUpperCase()} · version ${document.version}`}
      footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Close</Button>{canDownload ? <Button onClick={download} leadingIcon={<Download className="h-4 w-4" />}>Download</Button> : <Button variant="outline" disabled leadingIcon={<Lock className="h-4 w-4" />}>Download restricted</Button>}</div>}
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
            <span>Live file preview</span>
            <span className="inline-flex items-center gap-1"><ScanLine className="h-3.5 w-3.5" />{OCR_LABELS[document.ocr]}</span>
          </div>
          <div className="bg-white p-3">
            {document.url && document.fileType.toLowerCase().includes('pdf') ? (
              <iframe title={`Preview of ${document.fileName}`} src={document.url} className="h-[32rem] w-full" />
            ) : document.url && document.fileType.toLowerCase().startsWith('image/') ? (
              <img src={document.url} alt={document.fileName} className="mx-auto max-h-[32rem] max-w-full object-contain" />
            ) : document.url ? (
              <a href={document.url} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-700 hover:underline">Open the stored file in a new tab</a>
            ) : (
              <p className="text-sm text-ink-500">A preview URL is not available for this file.</p>
            )}
            {document.isRedacted ? <p className="pt-2 text-[11px] italic text-ink-500">Redactions are applied to the stored disclosure version and recorded in the redaction schedule.</p> : null}
          </div>
        </div>

        <DescriptionList columns={1} items={[
          { label: 'Case', value: foiCase ? <Link to={`/cases/${foiCase.id}?tab=documents`} className="font-medium text-brand-700 hover:underline">{foiCase.caseNumber} — {foiCase.subject}</Link> : '—' },
          { label: 'Uploaded by', value: `${uploadedBy} · ${formatDateTime(document.createdAt)}` },
          { label: 'Virus scan', value: VIRUS_SCAN_LABELS[document.virusScan] },
          { label: 'Checksum (SHA-256 head)', value: <span className="font-mono text-xs">{document.checksum}</span> },
          { label: 'Retention label', value: document.retentionLabel },
          { label: 'Retain until', value: formatDate(document.retainUntil) },
        ]} />

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-800"><History className="h-4 w-4 text-ink-400" />Version history ({document.versions.length})</p>
          <ul className="space-y-2">{[...document.versions].reverse().map((entry) => <li key={entry.version} className="rounded-lg border border-ink-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold text-ink-800">Version {entry.version}</span><span className="text-xs text-ink-500">{formatDateTime(entry.createdAt)}</span></div><p className="mt-0.5 text-xs text-ink-600">{entry.changeNote}</p><p className="mt-0.5 text-xs text-ink-400">{usersById.get(entry.uploadedBy)?.name ?? entry.uploadedBy} · {formatBytes(entry.fileSize)} · <span className="font-mono">{entry.checksum}</span></p></li>)}</ul>
        </div>

        <p className="flex items-start gap-1.5 text-xs text-ink-500"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />Views, downloads and prints are written to the document access log against your account.</p>
      </div>
    </Drawer>
  )
}

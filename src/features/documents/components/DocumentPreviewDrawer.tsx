import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, FileText, History, Lock, ScanLine, ShieldCheck } from 'lucide-react'
import type { FoiDocument } from '@/types'
import { Badge, Button, ConfidentialityBadge, DocumentKindBadge, Drawer } from '@/components/ui'
import { DescriptionList } from '@/components/common'
import { useDocumentFile } from '@/api/documents'
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
  const getFile = useDocumentFile()
  const toast = useToast()
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [fileError, setFileError] = useState('')
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFileUrl(null)
    setFileError('')
    if (document && ['pdf', 'png', 'jpg', 'jpeg'].includes(document.fileType.toLowerCase())) {
      void getFile(document.id, true).then((file) => { if (!cancelled) setFileUrl(file.url) }).catch((error) => { if (!cancelled) setFileError(error instanceof Error ? error.message : 'Preview unavailable.') })
    }
    return () => { cancelled = true }
  }, [document?.id, document?.version, document?.virusScan, getFile])

  if (!document) return null

  const foiCase = cases.find((item) => item.id === document.caseId)
  const uploadedBy = usersById.get(document.uploadedBy)?.name ?? document.uploadedBy

  const download = async () => {
    setDownloading(true)
    try {
      const file = await getFile(document.id)
      const response = await fetch(file.url)
      if (!response.ok) throw new Error('Download failed or access expired.')
      const url = URL.createObjectURL(await response.blob())
      const link = globalThis.document.createElement('a'); link.href = url; link.download = file.filename; link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      toast.success('Download ready', 'The file was downloaded and access was recorded.')
    } catch (error) { toast.error('Download failed', error instanceof Error ? error.message : 'Please try again.') }
    finally { setDownloading(false) }
  }

  return (
    <Drawer
      open={Boolean(document)}
      onClose={onClose}
      width="lg"
      title={<span className="flex items-center gap-2"><FileText className="h-4 w-4 text-brand-600" /><span className="truncate">{document.fileName}</span></span>}
      description={`${formatBytes(document.fileSize)} · ${document.fileType.toUpperCase()} · version ${document.version}`}
      footer={<div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Close</Button>{canDownload ? <Button onClick={download} isLoading={downloading} leadingIcon={<Download className="h-4 w-4" />}>Download</Button> : <Button variant="outline" disabled leadingIcon={<Lock className="h-4 w-4" />}>Download restricted</Button>}</div>}
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
            {fileUrl && document.fileType.toLowerCase().includes('pdf') ? (
              <iframe title={`Preview of ${document.fileName}`} src={fileUrl} sandbox="allow-same-origin" referrerPolicy="no-referrer" className="h-[32rem] w-full" />
            ) : fileUrl && ['png', 'jpg', 'jpeg'].includes(document.fileType.toLowerCase()) ? (
              <img src={fileUrl} alt={document.fileName} className="mx-auto max-h-[32rem] max-w-full object-contain" />
            ) : fileUrl ? (
              <a href={fileUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-700 hover:underline">Open the stored file in a new tab</a>
            ) : (
              <p className="text-sm text-ink-500">{fileError || 'Use Download for office files, or reopen this preview after its link expires.'}</p>
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

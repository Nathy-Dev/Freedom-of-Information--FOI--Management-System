import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Eye, FileArchive, FileText, Filter, HardDrive, ScanLine, ShieldCheck } from 'lucide-react'
import type { DocumentKind, FoiDocument } from '@/types'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ChoiceChip,
  ConfidentialityBadge,
  DocumentKindBadge,
  EmptyState,
  Pagination,
  SearchInput,
  SkeletonTable,
  StatCard,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui'
import { PageHeader } from '@/components/common'
import { DocumentPreviewDrawer } from './components/DocumentPreviewDrawer'
import { listDocuments } from '@/mocks/api'
import { db, userName } from '@/mocks/db'
import { DOCUMENT_KIND_META, OCR_LABELS } from '@/lib/constants'
import { formatBytes, formatDate, formatRelative } from '@/lib/format'
import { useAsync, useDebounced } from '@/hooks/useAsync'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'

const KIND_ORDER: DocumentKind[] = [
  'request',
  'response',
  'evidence',
  'court_filing',
  'correspondence',
  'internal_memo',
]

/** FR-031/FR-033: the document library across every case in the user's scope. */
export function DocumentsPage() {
  const { can } = useAuth()
  const { version } = useData()

  const [term, setTerm] = useState('')
  const [kinds, setKinds] = useState<DocumentKind[]>([])
  const [redactedOnly, setRedactedOnly] = useState(false)
  const [page, setPage] = useState(1)
  const { documentId } = useParams()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<FoiDocument | null>(
    () => (documentId ? (db.documents.find((doc) => doc.id === documentId) ?? null) : null),
  )

  /** Closing the drawer drops the deep-link segment so the URL stays honest. */
  function closePreview() {
    setSelected(null)
    if (documentId) navigate('/documents', { replace: true })
  }

  const debounced = useDebounced(term, 250)

  const result = useAsync(
    () =>
      listDocuments({
        q: debounced,
        kinds: kinds.length ? kinds : undefined,
        redactedOnly: redactedOnly || undefined,
        page,
        pageSize: 15,
      }),
    [debounced, kinds, redactedOnly, page, version],
  )

  const stats = useMemo(() => {
    const rows = db.documents
    return {
      total: rows.length,
      published: rows.filter((doc) => doc.isPublic).length,
      redacted: rows.filter((doc) => doc.isRedacted).length,
      scanned: rows.filter((doc) => doc.ocr === 'complete').length,
      bytes: rows.reduce((sum, doc) => sum + doc.fileSize, 0),
      legalHold: rows.filter((doc) => doc.retentionLabel.startsWith('Legal hold')).length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const toggleKind = (kind: DocumentKind) =>
    setKinds((current) => {
      setPage(1)
      return current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]
    })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Documents"
        description="Every attachment across the case register: versioned, scanned for malware and held to a retention label."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Documents held"
          value={stats.total}
          hint={formatBytes(stats.bytes)}
          icon={<FileArchive className="h-5 w-5" />}
          tone="brand"
        />
        <StatCard
          label="Released to requestors"
          value={stats.published}
          hint="Published response packs"
          icon={<Eye className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Redacted"
          value={stats.redacted}
          hint="Severances recorded"
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="OCR complete"
          value={stats.scanned}
          hint={`${stats.legalHold} under legal hold`}
          icon={<ScanLine className="h-5 w-5" />}
          tone="info"
        />
      </div>

      <Card>
        <CardHeader
          title="Library"
          description={`${result.data?.total ?? 0} document${(result.data?.total ?? 0) === 1 ? '' : 's'} match the current filters.`}
          actions={
            <SearchInput
              value={term}
              onChange={(value) => {
                setTerm(value)
                setPage(1)
              }}
              placeholder="Search file names"
              className="w-full sm:w-72"
            />
          }
        />
        <CardBody className="space-y-3 border-b border-ink-100">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">
              <Filter className="h-3.5 w-3.5" />
              Type
            </span>
            {KIND_ORDER.map((kind) => (
              <ChoiceChip
                key={kind}
                selected={kinds.includes(kind)}
                dot={DOCUMENT_KIND_META[kind].dot}
                onClick={() => toggleKind(kind)}
              >
                {DOCUMENT_KIND_META[kind].label}
              </ChoiceChip>
            ))}
            <ChoiceChip
              selected={redactedOnly}
              onClick={() => {
                setRedactedOnly((current) => !current)
                setPage(1)
              }}
            >
              Redacted only
            </ChoiceChip>
            {kinds.length || redactedOnly || term ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setKinds([])
                  setRedactedOnly(false)
                  setTerm('')
                  setPage(1)
                }}
              >
                Reset
              </Button>
            ) : null}
          </div>
        </CardBody>

        <CardBody className="p-0">
          {result.isLoading && !result.data ? (
            <SkeletonTable rows={8} />
          ) : (result.data?.rows.length ?? 0) === 0 ? (
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="No documents match"
              description="Adjust the search term or clear the type filters to widen the results."
            />
          ) : (
            <TableWrap>
              <Table>
                <Thead>
                  <Tr>
                    <Th>File</Th>
                    <Th>Case</Th>
                    <Th>Type</Th>
                    <Th>Classification</Th>
                    <Th>Version</Th>
                    <Th>Retention</Th>
                    <Th>Uploaded</Th>
                    <Th className="text-right">Action</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {result.data?.rows.map((doc) => {
                    const foiCase = db.cases.find((item) => item.id === doc.caseId)
                    return (
                      <Tr key={doc.id}>
                        <Td>
                          <button
                            type="button"
                            onClick={() => setSelected(doc)}
                            className="flex max-w-xs items-start gap-2 text-left"
                          >
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-ink-800 hover:text-brand-700">
                                {doc.fileName}
                              </span>
                              <span className="block text-xs text-ink-500">
                                {formatBytes(doc.fileSize)} · {doc.fileType.toUpperCase()} ·{' '}
                                {OCR_LABELS[doc.ocr]}
                              </span>
                            </span>
                          </button>
                        </Td>
                        <Td className="whitespace-nowrap">
                          {foiCase ? (
                            <Link
                              to={`/cases/${foiCase.id}?tab=documents`}
                              className="font-mono text-xs font-semibold text-brand-700 hover:underline"
                            >
                              {foiCase.caseNumber}
                            </Link>
                          ) : (
                            '—'
                          )}
                        </Td>
                        <Td><DocumentKindBadge kind={doc.kind} /></Td>
                        <Td>
                          <div className="flex flex-wrap items-center gap-1">
                            <ConfidentialityBadge level={doc.confidentiality} />
                            {doc.isRedacted ? <Badge tone="warning">{doc.redactionCount} redactions</Badge> : null}
                            {doc.isPublic ? <Badge tone="success">Released</Badge> : null}
                          </div>
                        </Td>
                        <Td className="whitespace-nowrap text-sm text-ink-600">v{doc.version}</Td>
                        <Td className="whitespace-nowrap">
                          <span className="text-xs text-ink-600">{doc.retentionLabel}</span>
                          <span className="block text-xs text-ink-400">until {formatDate(doc.retainUntil)}</span>
                        </Td>
                        <Td className="whitespace-nowrap">
                          <span className="text-xs text-ink-600">{userName(doc.uploadedBy)}</span>
                          <span className="block text-xs text-ink-400">{formatRelative(doc.createdAt)}</span>
                        </Td>
                        <Td className="text-right">
                          <Button variant="outline" size="sm" onClick={() => setSelected(doc)}>
                            Preview
                          </Button>
                        </Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
        {result.data && result.data.pageCount > 1 ? (
          <Pagination
            page={result.data.page}
            total={result.data.total}
            pageSize={result.data.pageSize}
            label="documents"
            onPageChange={setPage}
          />
        ) : null}
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-ink-500">
        <HardDrive className="h-3.5 w-3.5" />
        Files are encrypted at rest in the production deployment. This prototype stores only mock metadata.
      </p>

      <DocumentPreviewDrawer
        document={selected}
        onClose={closePreview}
        canDownload={can('document:download')}
      />
    </div>
  )
}

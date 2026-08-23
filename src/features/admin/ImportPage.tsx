import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Columns3,
  Download,
  FileSpreadsheet,
  RotateCcw,
  Upload,
  UploadCloud,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Progress,
  Select,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui'
import type { SelectOption } from '@/components/ui'
import { PageHeader } from '@/components/common'
import {
  IMPORT_FIELDS,
  SAMPLE_CSV,
  commitImport,
  parseCsv,
  suggestMapping,
  validateRows,
} from '@/mocks/importApi'
import type { ImportFieldKey, ImportSummary, ParsedCsv, ValidationResult } from '@/mocks/importApi'
import { formatBytes, formatNumber } from '@/lib/format'
import { downloadTextFile } from '@/lib/utils'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'

type Step = 1 | 2 | 3 | 4

const STEPS: Array<{ step: Step; label: string; hint: string }> = [
  { step: 1, label: 'Upload file', hint: 'Choose a CSV exported from the legacy register' },
  { step: 2, label: 'Map columns', hint: 'Match each column to a case field' },
  { step: 3, label: 'Review', hint: 'Check what will import and what will be rejected' },
  { step: 4, label: 'Import', hint: 'Open a case for every accepted row' },
]

const FIELD_OPTIONS: SelectOption[] = [
  { value: '', label: '— Do not import —' },
  ...IMPORT_FIELDS.map((field) => ({
    value: field.key,
    label: field.required ? `${field.label} (required)` : field.label,
  })),
]

const REQUIRED_KEYS = IMPORT_FIELDS.filter((field) => field.required).map((field) => field.key)

export function ImportPage() {
  const { user, can, isReadOnly } = useAuth()
  const { refresh } = useData()
  const toast = useToast()

  const [step, setStep] = useState<Step>(1)
  const [fileName, setFileName] = useState('')
  const [fileSize, setFileSize] = useState(0)
  const [parsed, setParsed] = useState<ParsedCsv | null>(null)
  const [mapping, setMapping] = useState<Record<string, ImportFieldKey | ''>>({})
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [progress, setProgress] = useState(0)
  const [isImporting, setIsImporting] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  const canImport = can('import:bulk') && !isReadOnly

  const missingRequired = useMemo(() => {
    const mapped = new Set(Object.values(mapping).filter(Boolean))
    return REQUIRED_KEYS.filter((key) => !mapped.has(key))
  }, [mapping])

  const rowIssues = useMemo(() => {
    if (!result) return new Map<number, ValidationResult['issues']>()
    const map = new Map<number, ValidationResult['issues']>()
    result.issues.forEach((issue) => {
      if (issue.rowIndex < 0) return
      const list = map.get(issue.rowIndex) ?? []
      list.push(issue)
      map.set(issue.rowIndex, list)
    })
    return map
  }, [result])

  function loadText(text: string, name: string, size: number) {
    const next = parseCsv(text)
    if (next.headers.length === 0 || next.rows.length === 0) {
      toast.error('Nothing to import', 'The file has no header row or no data rows.')
      return
    }
    setParsed(next)
    setMapping(suggestMapping(next.headers))
    setFileName(name)
    setFileSize(size)
    setResult(null)
    setSummary(null)
    setProgress(0)
    setStep(2)
    toast.success('File read', `${formatNumber(next.rows.length)} data rows found in ${name}.`)
  }

  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    loadText(text, file.name, file.size)
    event.target.value = ''
  }

  function useSample() {
    loadText(SAMPLE_CSV, 'hyprep-foi-sample-import.csv', SAMPLE_CSV.length)
  }

  function validate() {
    if (!parsed) return
    const next = validateRows(parsed, mapping)
    setResult(next)
    setStep(3)
    if (next.errorCount > 0) {
      toast.warning(
        `${next.errorCount} issue${next.errorCount === 1 ? '' : 's'} found`,
        'Rows with errors are excluded; the rest can still be imported.',
      )
    } else {
      toast.success('Validation passed', `${formatNumber(next.validCount)} rows are ready to import.`)
    }
  }

  async function runImport() {
    if (!user || !result || result.validCount === 0) return
    setIsImporting(true)
    setStep(4)
    setProgress(0)
    try {
      const outcome = await commitImport(result.valid, user.id, (done, total) => {
        setProgress(Math.round((done / total) * 100))
      })
      setSummary(outcome)
      refresh()
      toast.success(
        `${formatNumber(outcome.created)} cases opened`,
        'Each imported request has been acknowledged and is now in the register.',
      )
    } finally {
      setIsImporting(false)
    }
  }

  function restart() {
    setStep(1)
    setParsed(null)
    setMapping({})
    setResult(null)
    setSummary(null)
    setFileName('')
    setFileSize(0)
    setProgress(0)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bulk import"
        description="Load a backlog of FOI requests from the legacy register. Every accepted row opens a real case with its statutory clock running."
        icon={<UploadCloud className="h-5 w-5" />}
        breadcrumbs={[{ label: 'Administration' }, { label: 'Bulk import' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              leadingIcon={<Download className="h-4 w-4" />}
              onClick={() => downloadTextFile('hyprep-foi-import-template.csv', SAMPLE_CSV, 'text/csv')}
            >
              Download template
            </Button>
            {step > 1 ? (
              <Button variant="secondary" leadingIcon={<RotateCcw className="h-4 w-4" />} onClick={restart}>
                Start over
              </Button>
            ) : null}
          </div>
        }
      />

      <ol className="grid gap-2 sm:grid-cols-4">
        {STEPS.map((item) => {
          const isDone = step > item.step
          const isCurrent = step === item.step
          return (
            <li
              key={item.step}
              className={
                isCurrent
                  ? 'rounded-lg border border-brand-400 bg-brand-50 p-3'
                  : isDone
                    ? 'rounded-lg border border-brand-200 bg-white p-3'
                    : 'rounded-lg border border-ink-200 bg-white p-3'
              }
            >
              <div className="flex items-center gap-2">
                <span
                  className={
                    isDone
                      ? 'flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-2xs font-bold text-white'
                      : isCurrent
                        ? 'flex h-5 w-5 items-center justify-center rounded-full bg-brand-700 text-2xs font-bold text-white'
                        : 'flex h-5 w-5 items-center justify-center rounded-full bg-ink-200 text-2xs font-bold text-ink-600'
                  }
                >
                  {isDone ? '✓' : item.step}
                </span>
                <p className={isCurrent ? 'text-sm font-semibold text-brand-900' : 'text-sm font-semibold text-ink-800'}>
                  {item.label}
                </p>
              </div>
              <p className="mt-1 pl-7 text-xs text-ink-500">{item.hint}</p>
            </li>
          )
        })}
      </ol>

      {!canImport ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<UploadCloud className="h-6 w-6" />}
              title="Bulk import is restricted"
              description="Only accounts with the bulk import permission can load records into the register. Ask a Super-Admin to run the import or grant the permission."
            />
          </CardBody>
        </Card>
      ) : step === 1 ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Choose a CSV file" description="The first row must contain column headings." />
            <CardBody className="space-y-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink-300 bg-ink-50 px-4 py-10 text-center transition hover:border-brand-400 hover:bg-brand-50">
                <Upload className="h-7 w-7 text-ink-400" />
                <span className="text-sm font-semibold text-ink-800">Click to choose a CSV file</span>
                <span className="text-xs text-ink-500">Maximum 5,000 rows per file · UTF-8 encoding</span>
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={onFileChange} />
              </label>
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-ink-200" />
                <span className="text-2xs uppercase tracking-wide text-ink-400">or</span>
                <span className="h-px flex-1 bg-ink-200" />
              </div>
              <Button variant="secondary" leadingIcon={<FileSpreadsheet className="h-4 w-4" />} onClick={useSample} fullWidth>
                Load the three-row sample file
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Before you import" />
            <CardBody className="space-y-2 text-xs leading-relaxed text-ink-600">
              <p>
                <strong className="text-ink-800">Subject, description, requestor name and email</strong> are required.
                Rows missing any of them are rejected and reported, never silently dropped.
              </p>
              <p>
                Unknown departments, priorities and formats fall back to a safe default and are flagged as warnings.
              </p>
              <p>
                Each accepted row opens a case, issues an acknowledgement to the requestor and writes an entry to the
                audit trail against your account.
              </p>
              <p>Semicolons separate multiple tags inside a single cell.</p>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {canImport && step === 2 && parsed ? (
        <Card>
          <CardHeader
            title="Map columns to case fields"
            description={`${fileName} · ${formatBytes(fileSize)} · ${formatNumber(parsed.rows.length)} data rows`}
            actions={
              <Button
                leadingIcon={<Columns3 className="h-4 w-4" />}
                trailingIcon={<ArrowRight className="h-4 w-4" />}
                onClick={validate}
                disabled={missingRequired.length > 0}
              >
                Validate rows
              </Button>
            }
          />
          <CardBody className="space-y-3">
            {missingRequired.length > 0 ? (
              <div className="flex items-start gap-2 rounded-lg border border-crest-300 bg-crest-50 px-3 py-2 text-sm text-crest-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Map a column to{' '}
                  {missingRequired
                    .map((key) => IMPORT_FIELDS.find((field) => field.key === key)?.label ?? key)
                    .join(', ')}{' '}
                  before validating.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>All required fields are mapped. Column names were matched automatically — adjust any that are wrong.</span>
              </div>
            )}

            <TableWrap>
              <Table>
                <Thead>
                  <Tr>
                    <Th>CSV column</Th>
                    <Th>First value</Th>
                    <Th>Maps to</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {parsed.headers.map((header, index) => (
                    <Tr key={`${header}-${index}`}>
                      <Td className="font-mono text-xs font-medium text-ink-900">{header || `(column ${index + 1})`}</Td>
                      <Td className="max-w-xs truncate text-xs text-ink-500" title={parsed.rows[0]?.[index] ?? ''}>
                        {parsed.rows[0]?.[index] || <span className="text-ink-300">empty</span>}
                      </Td>
                      <Td>
                        <Select
                          options={FIELD_OPTIONS}
                          value={mapping[header] ?? ''}
                          onChange={(event) =>
                            setMapping((prev) => ({ ...prev, [header]: event.target.value as ImportFieldKey | '' }))
                          }
                          size="sm"
                          containerClassName="w-64"
                          label={`Field for ${header}`}
                        />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          </CardBody>
        </Card>
      ) : null}

      {canImport && step === 3 && parsed && result ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <Card>
              <CardBody className="space-y-1">
                <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Rows in file</p>
                <p className="text-xl font-semibold tabular-nums text-ink-900">{formatNumber(parsed.rows.length)}</p>
              </CardBody>
            </Card>
            <Card className="border-brand-200">
              <CardBody className="space-y-1">
                <p className="text-2xs font-semibold uppercase tracking-wide text-brand-700">Will import</p>
                <p className="text-xl font-semibold tabular-nums text-brand-800">{formatNumber(result.validCount)}</p>
              </CardBody>
            </Card>
            <Card className={result.errorCount > 0 ? 'border-crest-200' : undefined}>
              <CardBody className="space-y-1">
                <p className="text-2xs font-semibold uppercase tracking-wide text-crest-700">Errors</p>
                <p className="text-xl font-semibold tabular-nums text-crest-800">{formatNumber(result.errorCount)}</p>
              </CardBody>
            </Card>
            <Card className={result.warningCount > 0 ? 'border-gold-200' : undefined}>
              <CardBody className="space-y-1">
                <p className="text-2xs font-semibold uppercase tracking-wide text-gold-700">Warnings</p>
                <p className="text-xl font-semibold tabular-nums text-gold-800">{formatNumber(result.warningCount)}</p>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Row-by-row review"
              description="Errors exclude a row entirely. Warnings import with the substituted value shown."
              actions={
                <div className="flex items-center gap-2">
                  <Button variant="ghost" onClick={() => setStep(2)}>
                    Back to mapping
                  </Button>
                  <Button
                    leadingIcon={<UploadCloud className="h-4 w-4" />}
                    onClick={runImport}
                    disabled={result.validCount === 0}
                  >
                    Import {formatNumber(result.validCount)} rows
                  </Button>
                </div>
              }
            />
            <CardBody className="p-0">
              <TableWrap className="max-h-[28rem]">
                <Table>
                  <Thead>
                    <Tr>
                      <Th className="w-16">Row</Th>
                      <Th>Subject</Th>
                      <Th>Requestor</Th>
                      <Th>Outcome</Th>
                      <Th>Issues</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {parsed.rows.map((row, index) => {
                      const issues = rowIssues.get(index) ?? []
                      const hasError = issues.some((issue) => issue.severity === 'error')
                      const subjectColumn = parsed.headers.findIndex((header) => mapping[header] === 'subject')
                      const nameColumn = parsed.headers.findIndex((header) => mapping[header] === 'requestorName')
                      const emailColumn = parsed.headers.findIndex((header) => mapping[header] === 'requestorEmail')
                      return (
                        <Tr key={index} className={hasError ? 'bg-crest-50/40' : undefined}>
                          <Td className="tabular-nums text-2xs text-ink-500">{index + 2}</Td>
                          <Td className="max-w-xs truncate text-ink-800" title={row[subjectColumn] ?? ''}>
                            {row[subjectColumn] || <span className="text-ink-300">empty</span>}
                          </Td>
                          <Td className="text-xs text-ink-600">
                            <p>{row[nameColumn] || '—'}</p>
                            <p className="mt-0.5 text-2xs text-ink-400">{row[emailColumn] || '—'}</p>
                          </Td>
                          <Td>
                            {hasError ? (
                              <Badge tone="danger">Rejected</Badge>
                            ) : issues.length > 0 ? (
                              <Badge tone="warning">Imports with changes</Badge>
                            ) : (
                              <Badge tone="success">Ready</Badge>
                            )}
                          </Td>
                          <Td className="space-y-0.5">
                            {issues.length === 0 ? (
                              <span className="text-2xs text-ink-400">—</span>
                            ) : (
                              issues.map((issue, issueIndex) => (
                                <p
                                  key={issueIndex}
                                  className={
                                    issue.severity === 'error'
                                      ? 'text-2xs leading-relaxed text-crest-700'
                                      : 'text-2xs leading-relaxed text-gold-700'
                                  }
                                >
                                  <span className="font-semibold">{issue.field}:</span> {issue.message}
                                </p>
                              ))
                            )}
                          </Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
              </TableWrap>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {canImport && step === 4 ? (
        <Card>
          <CardHeader
            title={isImporting ? 'Importing…' : 'Import complete'}
            description={
              isImporting
                ? 'Each row is written as a case, acknowledged and logged. Leaving this page cancels the remaining rows.'
                : 'Every accepted row is now a live case with its statutory response clock running.'
            }
          />
          <CardBody className="space-y-4">
            <Progress
              value={progress}
              label={isImporting ? 'Writing cases' : 'Finished'}
              showValue
              size="md"
              barClassName="bg-brand-600"
            />

            {summary ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
                    <p className="text-2xs font-semibold uppercase tracking-wide text-brand-700">Cases opened</p>
                    <p className="text-xl font-semibold tabular-nums text-brand-900">{formatNumber(summary.created)}</p>
                  </div>
                  <div className="rounded-lg border border-ink-200 p-3">
                    <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Skipped</p>
                    <p className="text-xl font-semibold tabular-nums text-ink-800">{formatNumber(summary.skipped)}</p>
                  </div>
                  <div className="rounded-lg border border-ink-200 p-3">
                    <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Rejected at validation</p>
                    <p className="text-xl font-semibold tabular-nums text-ink-800">
                      {formatNumber((parsed?.rows.length ?? 0) - (result?.validCount ?? 0))}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-ink-800">New case numbers</p>
                  <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-ink-200 p-3">
                    {summary.caseNumbers.map((caseNumber) => (
                      <Badge key={caseNumber} tone="brand" className="font-mono text-2xs">
                        {caseNumber}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-ink-200 pt-4">
                  <ButtonLink to="/cases" leadingIcon={<ArrowRight className="h-4 w-4" />}>
                    Open the case register
                  </ButtonLink>
                  <Button variant="secondary" leadingIcon={<RotateCcw className="h-4 w-4" />} onClick={restart}>
                    Import another file
                  </Button>
                  <Link to="/audit" className="text-sm font-medium text-brand-700 underline-offset-2 hover:underline">
                    View this import in the audit trail
                  </Link>
                </div>
              </>
            ) : null}
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}

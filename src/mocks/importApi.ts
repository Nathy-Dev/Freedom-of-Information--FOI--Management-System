import type { CasePriority, CaseSource, Confidentiality, ResponseFormat } from '@/types'
import { delay } from '@/lib/utils'
import { departmentNames } from './data/reference'
import { createCase } from './api'
import { reference } from './db'

/** The case fields a CSV column can be mapped onto (FR-044). */
export const IMPORT_FIELDS = [
  { key: 'subject', label: 'Subject', required: true },
  { key: 'description', label: 'Request description', required: true },
  { key: 'requestorName', label: 'Requestor name', required: true },
  { key: 'requestorEmail', label: 'Requestor email', required: true },
  { key: 'requestorPhone', label: 'Requestor phone', required: false },
  { key: 'requestorOrganization', label: 'Requestor organisation', required: false },
  { key: 'department', label: 'Responsible department', required: false },
  { key: 'priority', label: 'Priority', required: false },
  { key: 'confidentiality', label: 'Confidentiality', required: false },
  { key: 'responseFormat', label: 'Response format', required: false },
  { key: 'source', label: 'Source channel', required: false },
  { key: 'tags', label: 'Tags (semicolon separated)', required: false },
  { key: 'dateSubmitted', label: 'Date received', required: false },
] as const

export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]['key']

export interface ParsedCsv {
  headers: string[]
  rows: string[][]
}

/** Minimal RFC-4180 aware parser: enough for quoted fields and embedded commas. */
export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field.trim())
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field.trim())
      field = ''
      if (row.some((c) => c.length > 0)) rows.push(row)
      row = []
    } else {
      field += char
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim())
    if (row.some((c) => c.length > 0)) rows.push(row)
  }

  const [headers = [], ...body] = rows
  return { headers, rows: body }
}

/** Suggests a mapping by fuzzy-matching each CSV header against a field label. */
export function suggestMapping(headers: string[]): Record<string, ImportFieldKey | ''> {
  const normalise = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '')
  const mapping: Record<string, ImportFieldKey | ''> = {}

  headers.forEach((header) => {
    const key = normalise(header)
    const match = IMPORT_FIELDS.find(
      (field) => normalise(field.key) === key || normalise(field.label).includes(key) || key.includes(normalise(field.key)),
    )
    mapping[header] = match ? match.key : ''
  })

  return mapping
}

export interface RowIssue {
  rowIndex: number
  field: string
  message: string
  severity: 'error' | 'warning'
}

export interface ValidationResult {
  valid: Record<ImportFieldKey, string>[]
  issues: RowIssue[]
  validCount: number
  errorCount: number
  warningCount: number
}

const PRIORITIES: CasePriority[] = ['low', 'medium', 'high', 'critical']
const CONFIDENTIALITIES: Confidentiality[] = ['public', 'internal', 'confidential', 'restricted']
const FORMATS: ResponseFormat[] = ['electronic', 'hard_copy', 'inspection', 'certified_copy']
const SOURCES: CaseSource[] = ['portal', 'email', 'walk_in', 'post', 'csv_import']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Validation runs before anything is written, so the reviewer sees exactly which
 * rows will import and why the rest were rejected.
 */
export function validateRows(
  parsed: ParsedCsv,
  mapping: Record<string, ImportFieldKey | ''>,
): ValidationResult {
  const issues: RowIssue[] = []
  const valid: Record<ImportFieldKey, string>[] = []

  const columnFor = (field: ImportFieldKey) =>
    parsed.headers.findIndex((header) => mapping[header] === field)

  IMPORT_FIELDS.filter((f) => f.required).forEach((field) => {
    if (columnFor(field.key) === -1) {
      issues.push({
        rowIndex: -1,
        field: field.key,
        message: `No column is mapped to the required field "${field.label}".`,
        severity: 'error',
      })
    }
  })

  if (issues.some((i) => i.rowIndex === -1)) {
    return { valid, issues, validCount: 0, errorCount: issues.length, warningCount: 0 }
  }

  parsed.rows.forEach((row, rowIndex) => {
    const record = {} as Record<ImportFieldKey, string>
    parsed.headers.forEach((header, columnIndex) => {
      const field = mapping[header]
      if (field) record[field] = row[columnIndex] ?? ''
    })

    const rowIssues: RowIssue[] = []
    const fail = (field: string, message: string) =>
      rowIssues.push({ rowIndex, field, message, severity: 'error' })
    const warn = (field: string, message: string) =>
      rowIssues.push({ rowIndex, field, message, severity: 'warning' })

    if (!record.subject) fail('subject', 'Subject is empty.')
    if (!record.description) fail('description', 'Request description is empty.')
    if (!record.requestorName) fail('requestorName', 'Requestor name is empty.')
    if (!record.requestorEmail) fail('requestorEmail', 'Requestor email is empty.')
    else if (!EMAIL.test(record.requestorEmail)) fail('requestorEmail', `"${record.requestorEmail}" is not a valid email address.`)

    if (record.department && !departmentNames.includes(record.department)) {
      warn('department', `"${record.department}" is not a known department; the row will be filed under Legal Unit.`)
      record.department = 'Legal Unit'
    }
    if (record.priority && !PRIORITIES.includes(record.priority as CasePriority)) {
      warn('priority', `"${record.priority}" is not a recognised priority; medium will be used.`)
      record.priority = 'medium'
    }
    if (record.confidentiality && !CONFIDENTIALITIES.includes(record.confidentiality as Confidentiality)) {
      warn('confidentiality', `"${record.confidentiality}" is not recognised; internal will be used.`)
      record.confidentiality = 'internal'
    }
    if (record.responseFormat && !FORMATS.includes(record.responseFormat as ResponseFormat)) {
      warn('responseFormat', `"${record.responseFormat}" is not recognised; electronic will be used.`)
      record.responseFormat = 'electronic'
    }
    if (record.source && !SOURCES.includes(record.source as CaseSource)) {
      warn('source', `"${record.source}" is not recognised; csv_import will be used.`)
      record.source = 'csv_import'
    }
    if (record.dateSubmitted && Number.isNaN(new Date(record.dateSubmitted).getTime())) {
      warn('dateSubmitted', `"${record.dateSubmitted}" could not be read as a date; today will be used.`)
      record.dateSubmitted = ''
    }

    issues.push(...rowIssues)
    if (!rowIssues.some((i) => i.severity === 'error')) valid.push(record)
  })

  return {
    valid,
    issues,
    validCount: valid.length,
    errorCount: issues.filter((i) => i.severity === 'error').length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
  }
}

export interface ImportSummary {
  created: number
  skipped: number
  caseNumbers: string[]
}

/** Commits the validated rows, opening a real case for each one. */
export async function commitImport(
  rows: Record<ImportFieldKey, string>[],
  actorId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportSummary> {
  const caseNumbers: string[] = []
  let skipped = 0

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i]!
    await delay(40)

    // Reuse an existing requestor account where the email already exists.
    const existing = reference.users.find(
      (u) => u.email.toLowerCase() === row.requestorEmail.toLowerCase(),
    )

    try {
      const created = await createCase(
        {
          subject: row.subject,
          description: row.description,
          department: row.department || 'Legal Unit',
          priority: (row.priority as CasePriority) || 'medium',
          confidentiality: (row.confidentiality as Confidentiality) || 'internal',
          responseFormat: (row.responseFormat as ResponseFormat) || 'electronic',
          source: (row.source as CaseSource) || 'csv_import',
          tags: row.tags ? row.tags.split(';').map((t) => t.trim()).filter(Boolean) : [],
          requestorId: existing?.id ?? 'usr-021',
          requestor: {
            name: row.requestorName,
            email: row.requestorEmail,
            phone: row.requestorPhone || undefined,
            organization: row.requestorOrganization || undefined,
            isJournalist: false,
          },
        },
        actorId,
      )
      caseNumbers.push(created.caseNumber)
    } catch {
      skipped += 1
    }

    onProgress?.(i + 1, rows.length)
  }

  return { created: caseNumbers.length, skipped, caseNumbers }
}

/** Downloadable starter file shown on the import screen. */
export const SAMPLE_CSV = [
  'subject,description,requestor_name,requestor_email,requestor_organization,department,priority,confidentiality,tags',
  '"Bodo remediation contract awards","Request for the schedule of contracts awarded for remediation works at Bodo, including sums and contractors.","Ngozi Adeyemi","ngozi.adeyemi@homef.org","Health of Mother Earth Foundation","Procurement","high","internal","Contracts;Remediation"',
  '"Water borehole completion reports","All completion reports for potable water boreholes delivered in Ogale in 2025.","Tunde Bakare","tunde.bakare@premiumtimesng.com","Premium Times","Water & Sanitation","medium","public","Water;Media Enquiry"',
  '"Soil sampling laboratory results","Laboratory analysis certificates for soil samples taken at K-Dere between January and June 2026.","Blessing Eze","blessing.eze@serap.org.ng","SERAP","Monitoring & Evaluation","medium","internal","Environmental Data"',
].join('\n')

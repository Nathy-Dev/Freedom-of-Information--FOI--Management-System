import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { CasePriority, CaseSource, Confidentiality, ResponseFormat } from '@/types'

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
export interface ParsedCsv { headers: string[]; rows: string[][] }
export interface RowIssue { rowIndex: number; field: string; message: string; severity: 'error' | 'warning' }
export interface ValidationResult { valid: Record<ImportFieldKey, string>[]; issues: RowIssue[]; validCount: number; errorCount: number; warningCount: number }
export interface ImportSummary { created: number; skipped: number; caseNumbers: string[] }

export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1 } else inQuotes = false
      } else field += char
      continue
    }
    if (char === '"') inQuotes = true
    else if (char === ',') { row.push(field.trim()); field = '' }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field.trim()); field = ''
      if (row.some((cell) => cell.length > 0)) rows.push(row)
      row = []
    } else field += char
  }
  if (field.length > 0 || row.length > 0) { row.push(field.trim()); if (row.some((cell) => cell.length > 0)) rows.push(row) }
  const [headers = [], ...body] = rows
  return { headers, rows: body }
}

export function suggestMapping(headers: string[]): Record<string, ImportFieldKey | ''> {
  const normalise = (value: string) => value.toLowerCase().replace(/[^a-z]/g, '')
  return Object.fromEntries(headers.map((header) => {
    const key = normalise(header)
    const match = IMPORT_FIELDS.find((field) => normalise(field.key) === key || normalise(field.label).includes(key) || key.includes(normalise(field.key)))
    return [header, match?.key ?? '']
  }))
}

const PRIORITIES: CasePriority[] = ['low', 'medium', 'high', 'critical']
const CONFIDENTIALITIES: Confidentiality[] = ['public', 'internal', 'confidential', 'restricted']
const FORMATS: ResponseFormat[] = ['electronic', 'hard_copy', 'inspection', 'certified_copy']
const SOURCES: CaseSource[] = ['portal', 'email', 'walk_in', 'post', 'csv_import']
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateRows(parsed: ParsedCsv, mapping: Record<string, ImportFieldKey | ''>, departmentNames: string[] = []): ValidationResult {
  const issues: RowIssue[] = []
  const valid: Record<ImportFieldKey, string>[] = []
  const columnFor = (field: ImportFieldKey) => parsed.headers.findIndex((header) => mapping[header] === field)
  IMPORT_FIELDS.filter((field) => field.required).forEach((field) => {
    if (columnFor(field.key) === -1) issues.push({ rowIndex: -1, field: field.key, message: `No column is mapped to the required field "${field.label}".`, severity: 'error' })
  })
  if (issues.some((issue) => issue.rowIndex === -1)) return { valid, issues, validCount: 0, errorCount: issues.length, warningCount: 0 }
  parsed.rows.forEach((row, rowIndex) => {
    const record = {} as Record<ImportFieldKey, string>
    parsed.headers.forEach((header, columnIndex) => { const field = mapping[header]; if (field) record[field] = row[columnIndex] ?? '' })
    const rowIssues: RowIssue[] = []
    const fail = (field: string, message: string) => rowIssues.push({ rowIndex, field, message, severity: 'error' })
    const warn = (field: string, message: string) => rowIssues.push({ rowIndex, field, message, severity: 'warning' })
    if (!record.subject) fail('subject', 'Subject is empty.')
    if (!record.description) fail('description', 'Request description is empty.')
    if (!record.requestorName) fail('requestorName', 'Requestor name is empty.')
    if (!record.requestorEmail) fail('requestorEmail', 'Requestor email is empty.')
    else if (!EMAIL.test(record.requestorEmail)) fail('requestorEmail', `"${record.requestorEmail}" is not a valid email address.`)
    if (record.department && departmentNames.length > 0 && !departmentNames.includes(record.department)) { warn('department', `"${record.department}" is not a known department; the row will be filed under Legal Unit.`); record.department = 'Legal Unit' }
    if (record.priority && !PRIORITIES.includes(record.priority as CasePriority)) { warn('priority', `"${record.priority}" is not recognised; medium will be used.`); record.priority = 'medium' }
    if (record.confidentiality && !CONFIDENTIALITIES.includes(record.confidentiality as Confidentiality)) { warn('confidentiality', `"${record.confidentiality}" is not recognised; internal will be used.`); record.confidentiality = 'internal' }
    if (record.responseFormat && !FORMATS.includes(record.responseFormat as ResponseFormat)) { warn('responseFormat', `"${record.responseFormat}" is not recognised; electronic will be used.`); record.responseFormat = 'electronic' }
    if (record.source && !SOURCES.includes(record.source as CaseSource)) { warn('source', `"${record.source}" is not recognised; csv_import will be used.`); record.source = 'csv_import' }
    if (record.dateSubmitted && Number.isNaN(new Date(record.dateSubmitted).getTime())) { warn('dateSubmitted', `"${record.dateSubmitted}" could not be read as a date; today will be used.`); record.dateSubmitted = '' }
    issues.push(...rowIssues)
    if (!rowIssues.some((issue) => issue.severity === 'error')) valid.push(record)
  })
  return { valid, issues, validCount: valid.length, errorCount: issues.filter((issue) => issue.severity === 'error').length, warningCount: issues.filter((issue) => issue.severity === 'warning').length }
}

export function useCommitImport() {
  const mutate = useMutation(api.mutations.import.commit)
  return (fileName: string, rows: Record<ImportFieldKey, string>[]) => mutate({ fileName, rows })
}


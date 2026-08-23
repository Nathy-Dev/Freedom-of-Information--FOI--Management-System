import type { Confidentiality, DocumentKind, FoiCase, FoiDocument, OcrStatus } from '@/types'
import { pick, seededRandom } from '@/lib/utils'
import { relativeIso } from './reference'

const RETENTION = ['Standard - 7 years', 'Standard - 7 years', 'Legal hold - indefinite', 'Permanent - archival', 'Short - 3 years']

/** Realistic attachment names keyed by the role the document plays on a case. */
const NAME_BANK: Record<DocumentKind, string[]> = {
  request: [
    'FOI-Request-Letter-Signed.pdf',
    'FOI-Application-Form.pdf',
    'Requestor-Identification.pdf',
    'Schedule-of-Records-Sought.docx',
  ],
  response: [
    'HYPREP-FOI-Response-Letter.pdf',
    'Response-Annexure-A-Data-Extract.xlsx',
    'Response-Annexure-B-Schedules.pdf',
    'Determination-Notice.pdf',
    'Partial-Disclosure-Response.pdf',
  ],
  evidence: [
    'Site-Sampling-Results.xlsx',
    'Laboratory-Analysis-Certificate.pdf',
    'Field-Inspection-Photographs.zip',
    'Contract-Award-Schedule.xlsx',
    'Payment-Voucher-Bundle.pdf',
    'Borehole-Completion-Report.pdf',
  ],
  court_filing: [
    'Originating-Summons.pdf',
    'Counter-Affidavit.pdf',
    'Written-Address-Respondent.pdf',
    'Exhibit-Bundle-Volume-1.pdf',
    'Hearing-Notice.pdf',
  ],
  correspondence: [
    'Acknowledgement-Letter.pdf',
    'Request-for-Clarification.pdf',
    'Extension-Notice-Section-6.pdf',
    'Internal-Referral-Memo.pdf',
    'Email-Thread-Requestor.pdf',
  ],
  internal_memo: [
    'Legal-Opinion-Exemption-Analysis.docx',
    'Triage-Assessment-Note.docx',
    'Redaction-Schedule.xlsx',
    'Departmental-Search-Certificate.pdf',
  ],
}

function extensionOf(fileName: string) {
  return fileName.split('.').pop()!.toLowerCase()
}

function checksum(rand: () => number) {
  return Array.from({ length: 12 }, () => Math.floor(rand() * 16).toString(16)).join('')
}

/** Which document kinds a case has depends on how far it progressed. */
function kindsFor(status: FoiCase['status'], rand: () => number): DocumentKind[] {
  const kinds: DocumentKind[] = ['request', 'correspondence']
  if (status !== 'filed') kinds.push('internal_memo')
  if (rand() > 0.45) kinds.push('evidence')
  if (['responded', 'closed', 'rejected', 'appeal', 'escalated'].includes(status)) kinds.push('response')
  if (status === 'appeal') kinds.push('court_filing')
  if (rand() > 0.8) kinds.push('evidence')
  return kinds
}

export function buildDocuments(cases: FoiCase[], staffIds: string[]): FoiDocument[] {
  const rand = seededRandom(88131)
  const documents: FoiDocument[] = []
  let counter = 0

  cases.forEach((foiCase) => {
    const submittedMs = new Date(foiCase.dateSubmitted).getTime()
    const ageDays = Math.max(1, Math.round((Date.now() - submittedMs) / 86_400_000))

    kindsFor(foiCase.status, rand).forEach((kind, indexInCase) => {
      counter += 1
      const fileName = pick(rand, NAME_BANK[kind])
      const ext = extensionOf(fileName)
      const scanned = ext === 'pdf' && rand() > 0.55

      // Documents accrue over the life of the case, request first.
      const offset = Math.max(0, ageDays - Math.round((indexInCase / 6) * ageDays))

      const isResponse = kind === 'response'
      const confidentiality: Confidentiality =
        kind === 'internal_memo'
          ? 'internal'
          : kind === 'court_filing'
            ? 'confidential'
            : isResponse
              ? foiCase.confidentiality
              : foiCase.confidentiality === 'restricted'
                ? 'restricted'
                : rand() > 0.6
                  ? 'internal'
                  : foiCase.confidentiality

      const isRedacted = isResponse && (foiCase.confidentiality === 'confidential' || foiCase.confidentiality === 'restricted') && rand() > 0.35
      const versionCount = isResponse && rand() > 0.5 ? 2 + Math.floor(rand() * 2) : 1
      const fileSize = Math.round((40 + rand() * 5600) * 1024)

      const ocr: OcrStatus = !scanned
        ? 'not_required'
        : rand() > 0.9
          ? 'processing'
          : rand() > 0.95
            ? 'failed'
            : 'complete'

      const versions = Array.from({ length: versionCount }, (_, v) => ({
        version: v + 1,
        uploadedBy: pick(rand, staffIds),
        createdAt: relativeIso(-(offset + (versionCount - v - 1) * 2), 10 + v, 20),
        fileSize: Math.round(fileSize * (0.82 + v * 0.09)),
        checksum: checksum(rand),
        changeNote:
          v === 0
            ? 'Initial upload'
            : pick(rand, [
                'Redactions applied under section 14 (personal information)',
                'Annexure page numbering corrected',
                'Signed copy substituted for draft',
                'Third-party consultation outcome incorporated',
              ]),
      }))

      documents.push({
        id: `doc-${String(counter).padStart(5, '0')}`,
        caseId: foiCase.id,
        fileName,
        fileType: ext,
        fileSize: versions[versions.length - 1]!.fileSize,
        url: `/mock-storage/${foiCase.caseNumber.replace(/\//g, '-')}/${fileName}`,
        uploadedBy: versions[versions.length - 1]!.uploadedBy,
        isPublic: isResponse && foiCase.confidentiality === 'public' && foiCase.status !== 'filed',
        version: versionCount,
        checksum: versions[versions.length - 1]!.checksum,
        kind,
        confidentiality,
        isRedacted,
        redactionCount: isRedacted ? 1 + Math.floor(rand() * 14) : 0,
        virusScan: rand() > 0.97 ? 'pending' : 'clean',
        ocr,
        retentionLabel:
          foiCase.status === 'appeal' ? 'Legal hold - indefinite' : pick(rand, RETENTION),
        retainUntil: relativeIso(365 * 7 - offset),
        versions,
        createdAt: versions[versions.length - 1]!.createdAt,
      })
    })
  })

  return documents
}

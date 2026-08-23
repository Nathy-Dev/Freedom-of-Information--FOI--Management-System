import type { CasePriority, CaseSource, CaseStatus, FoiCase, ResponseFormat, User } from '@/types'
import { pick, seededRandom } from '@/lib/utils'
import { PERIOD_QUALIFIERS, SITE_QUALIFIERS, SUBJECT_SEEDS } from './subjects'
import { relativeDate, relativeIso } from './reference'

const CASE_COUNT = 96
const SOURCES: CaseSource[] = ['portal', 'portal', 'portal', 'email', 'walk_in', 'post', 'csv_import']
const FORMATS: ResponseFormat[] = ['electronic', 'electronic', 'electronic', 'hard_copy', 'inspection', 'certified_copy']

/**
 * Age profile drives the status mix so dashboards show a believable pipeline:
 * fresh requests sit in triage, mid-age requests are answered or contested,
 * and old requests are concluded. A deliberate slice is left open past its
 * statutory due date so the SLA warnings and overdue queues have content.
 */
interface Cohort {
  share: number
  ageDays: [number, number]
  statuses: CaseStatus[]
}

const COHORTS: Cohort[] = [
  { share: 0.13, ageDays: [0, 4], statuses: ['filed', 'filed', 'in_review'] },
  { share: 0.14, ageDays: [4, 9], statuses: ['in_review', 'in_review', 'pending_info', 'responded'] },
  // Deliberately breaching: open well past the 7-day statutory window.
  { share: 0.11, ageDays: [9, 26], statuses: ['in_review', 'pending_info', 'escalated'] },
  { share: 0.16, ageDays: [12, 60], statuses: ['responded', 'closed', 'closed', 'appeal'] },
  { share: 0.14, ageDays: [60, 140], statuses: ['closed', 'closed', 'rejected', 'appeal'] },
  { share: 0.32, ageDays: [140, 420], statuses: ['closed', 'closed', 'closed', 'rejected'] },
]

function buildDescription(subject: string, requestorOrg: string) {
  return [
    `Pursuant to sections 1, 2 and 4 of the Freedom of Information Act 2011, I request access to records held by the Hydrocarbon Pollution Remediation Project concerning ${lowerFirst(subject)}.`,
    `Specifically, I request all documents, correspondence, schedules, spreadsheets and reports in HYPREP's custody that relate to this subject, including any annexures and supporting data.`,
    `Where any part of the records is considered exempt, I request that the exempt portions be severed and the remainder released in accordance with section 18 of the Act, together with a statement of the grounds for the severance.`,
    `This request is made on behalf of ${requestorOrg} in the public interest. Kindly acknowledge receipt and advise of the applicable fee, if any, for reproduction.`,
  ].join('\n\n')
}

function lowerFirst(value: string) {
  return value.charAt(0).toLowerCase() + value.slice(1)
}

function priorityFor(rand: () => number, confidentiality: string, tags: string[]): CasePriority {
  if (tags.includes('Ministerial Interest')) return 'critical'
  if (tags.includes('Litigation Risk')) return rand() > 0.4 ? 'high' : 'critical'
  if (confidentiality === 'restricted') return 'high'
  const roll = rand()
  if (roll > 0.86) return 'high'
  if (roll > 0.34) return 'medium'
  return 'low'
}

interface BuildArgs {
  requestors: User[]
  legalStaff: User[]
}

export function buildCases({ requestors, legalStaff }: BuildArgs): FoiCase[] {
  const rand = seededRandom(20260430)
  const cases: FoiCase[] = []

  // Expand the cohort shares into a concrete, deterministic status/age plan.
  const plan: Array<{ age: number; status: CaseStatus }> = []
  COHORTS.forEach((cohort) => {
    const count = Math.round(cohort.share * CASE_COUNT)
    for (let i = 0; i < count; i += 1) {
      const [min, max] = cohort.ageDays
      plan.push({
        age: Math.round(min + rand() * (max - min)),
        status: pick(rand, cohort.statuses),
      })
    }
  })
  plan.sort((a, b) => b.age - a.age)

  plan.forEach((slot, index) => {
    const seed = SUBJECT_SEEDS[index % SUBJECT_SEEDS.length]!
    const [baseSubject, department, baseTags, confidentiality] = seed

    // After one full pass over the bank, vary the topic by site or period.
    const cycle = Math.floor(index / SUBJECT_SEEDS.length)
    const subject =
      cycle === 0
        ? baseSubject
        : cycle === 1
          ? `${baseSubject} (${pick(rand, SITE_QUALIFIERS)} axis)`
          : `${baseSubject} for ${pick(rand, PERIOD_QUALIFIERS)}`

    const requestor = pick(rand, requestors)
    const status = slot.status
    const submittedDaysAgo = slot.age

    // A minority of requests attract the section 6 seven-day extension.
    const extended = rand() > 0.82
    const dueDays = extended ? 14 : 7

    const isConcluded = status === 'closed' || status === 'rejected'
    const isResolved = isConcluded || status === 'responded'

    // Resolution lands inside the window most of the time; the remainder breaches.
    const onTime = rand() > 0.24
    const responseDay = onTime
      ? Math.max(1, Math.round(dueDays * (0.35 + rand() * 0.6)))
      : dueDays + 1 + Math.round(rand() * 12)
    const respondedDaysAgo = Math.max(0, submittedDaysAgo - Math.min(responseDay, submittedDaysAgo))

    const tags = [...baseTags]
    if (rand() > 0.88) tags.push('Media Enquiry')
    if (requestor.organization.includes('Premium Times') || requestor.organization.includes('Sahara')) {
      if (!tags.includes('Media Enquiry')) tags.push('Media Enquiry')
    }
    if (status === 'appeal' && !tags.includes('Litigation Risk')) tags.push('Litigation Risk')

    const assignee =
      status === 'filed' && rand() > 0.45 ? null : pick(rand, legalStaff)

    const number = String(CASE_COUNT - index).padStart(4, '0')
    const submittedYear = new Date(relativeIso(-submittedDaysAgo)).getFullYear()

    cases.push({
      id: `case-${number}`,
      caseNumber: `HYPREP/FOI/${submittedYear}/${number}`,
      requestorId: requestor.id,
      requestor: {
        name: requestor.name,
        email: requestor.email,
        phone: requestor.phone,
        organization: requestor.organization,
        isJournalist: /Premium Times|Sahara|TheCable/.test(requestor.organization),
      },
      subject,
      description: buildDescription(subject, requestor.organization),
      assignedTo: assignee ? assignee.id : null,
      assignedTeamId: assignee?.teamId ?? null,
      status,
      priority: priorityFor(rand, confidentiality, tags),
      confidentiality,
      responseFormat: pick(rand, FORMATS),
      source: pick(rand, SOURCES),
      tags,
      department,
      dateSubmitted: relativeIso(-submittedDaysAgo, 9, 30),
      statutoryDueDate: relativeDate(-submittedDaysAgo + dueDays),
      dateClosed: isConcluded ? relativeIso(-Math.max(0, respondedDaysAgo - 1), 16, 0) : null,
      closureReason: isConcluded
        ? status === 'rejected'
          ? 'Exemption applied and communicated'
          : 'Response issued and acknowledged'
        : undefined,
      outcomeCode: isConcluded
        ? status === 'rejected'
          ? pick(rand, ['Refused - exempt', 'Refused - records not held'])
          : pick(rand, ['Granted in full', 'Granted in part', 'Granted in part', 'Transferred to another institution'])
        : undefined,
      linkedCaseIds: [],
      isAppeal: false,
      respondedAt: isResolved ? relativeIso(-respondedDaysAgo, 14, 15) : undefined,
      documentCount: 0,
      noteCount: 0,
      courtDateCount: 0,
      createdAt: relativeIso(-submittedDaysAgo, 9, 30),
      updatedAt: relativeIso(-Math.max(0, Math.round(respondedDaysAgo * rand())), 11, 0),
    })
  })

  linkRelatedCases(cases, seededRandom(771))
  return cases
}

/** FR-024: link cases sharing a requestor or a subject stem. */
function linkRelatedCases(cases: FoiCase[], rand: () => number) {
  const byRequestor = new Map<string, FoiCase[]>()
  cases.forEach((c) => {
    const list = byRequestor.get(c.requestorId) ?? []
    list.push(c)
    byRequestor.set(c.requestorId, list)
  })

  byRequestor.forEach((group) => {
    for (let i = 0; i + 1 < group.length; i += 2) {
      if (rand() > 0.55) continue
      const a = group[i]!
      const b = group[i + 1]!
      a.linkedCaseIds.push(b.id)
      b.linkedCaseIds.push(a.id)
    }
  })
}

import type { CaseNote, CaseTask, FoiCase, TaskStatus } from '@/types'
import { pick, seededRandom } from '@/lib/utils'
import { relativeIso } from './reference'

const INTERNAL_NOTES = [
  'Search certificate returned by the department. Records located in the registry; awaiting scanning before review.',
  'Recommend partial disclosure. Contract sums are releasable; contractor bank details must be severed under section 14.',
  'Requestor called to ask about progress. Advised that a determination will issue before the statutory due date.',
  'Third-party consultation issued to the contractor under section 12(1)(c). Awaiting their representations.',
  'Volume is substantial (roughly 340 pages). Consider invoking the section 6 extension and notifying the requestor.',
  'Cross-reference with the earlier request from the same organisation; substantially the same records are involved.',
  'Head of Legal has approved the draft response. Awaiting the Coordinator signature before publication.',
  'Fee assessment for reproduction is waived given the modest page count and the public-interest character of the request.',
  'Exemption analysis complete. Sections 11 and 15 do not apply; the commercial confidentiality claim under section 15(1)(a) is weak.',
  'Escalating: the department has not responded to two internal reminders and the deadline is now at risk.',
  'Requestor has indicated an intention to appeal if the refusal stands. Litigation team notified.',
  'Redaction schedule prepared and reviewed. 14 severances applied, each mapped to a ground under the Act.',
  'Data extract supplied by Monitoring & Evaluation reconciles with the published quarterly figures.',
  'Advised the requestor that part of the records is held by NOSDRA and that portion is being transferred under section 5.',
  'Note for file: hard-copy inspection arranged at the Port Harcourt office for next week.',
]

const PUBLIC_NOTES = [
  'Your request has been received and assigned to the Legal Unit for processing. You will be notified as soon as a determination is made.',
  'We are consulting an affected third party before deciding on release. This may take a few additional days.',
  'The records you requested have been released in part. Severed portions are identified in the response letter with the applicable grounds.',
  'We require a clarification to process your request: please confirm the period and the specific sites you are interested in.',
  'Your request has been transferred in part to the National Oil Spill Detection and Response Agency, which holds the remaining records.',
]

const TASK_STATUSES: TaskStatus[] = ['open', 'open', 'in_progress', 'blocked', 'done']

const TASK_TITLES = [
  'Draft determination letter for review',
  'Complete exemption analysis',
  'Obtain departmental search certificate',
  'Prepare redaction schedule',
  'Issue third-party consultation notice',
  'Reconcile data extract with published figures',
  'Obtain Coordinator signature on response',
  'File counter-affidavit at the registry',
  'Brief external counsel on the appeal',
  'Schedule hard-copy inspection with requestor',
  'Upload signed response and publish to requestor',
  'Confirm fee waiver with Finance',
]

export function buildNotes(cases: FoiCase[], staffIds: string[]): CaseNote[] {
  const rand = seededRandom(45219)
  const notes: CaseNote[] = []
  let counter = 0

  cases.forEach((foiCase) => {
    const ageDays = Math.max(
      1,
      Math.round((Date.now() - new Date(foiCase.dateSubmitted).getTime()) / 86_400_000),
    )
    const target = foiCase.status === 'filed' ? Math.floor(rand() * 2) : 1 + Math.floor(rand() * 4)

    for (let i = 0; i < target; i += 1) {
      counter += 1
      const isPublic = rand() > 0.72
      const offset = Math.max(0, ageDays - Math.round((i / Math.max(target, 1)) * ageDays * 0.9))
      const author = foiCase.assignedTo && rand() > 0.3 ? foiCase.assignedTo : pick(rand, staffIds)
      const mentions = !isPublic && rand() > 0.72 ? [pick(rand, staffIds)] : []

      notes.push({
        id: `note-${String(counter).padStart(5, '0')}`,
        caseId: foiCase.id,
        userId: author,
        type: isPublic ? 'public' : 'internal',
        content: isPublic ? pick(rand, PUBLIC_NOTES) : pick(rand, INTERNAL_NOTES),
        mentions,
        attachmentIds: [],
        isPinned: !isPublic && i === 0 && rand() > 0.82,
        createdAt: relativeIso(-offset, 8 + Math.floor(rand() * 9), 15),
      })
    }
  })

  return notes
}

export function buildTasks(cases: FoiCase[], staffIds: string[]): CaseTask[] {
  const rand = seededRandom(60712)
  const tasks: CaseTask[] = []
  let counter = 0

  const OPEN = ['filed', 'in_review', 'pending_info', 'escalated', 'appeal']

  cases.forEach((foiCase) => {
    const isOpen = OPEN.includes(foiCase.status)
    // Concluded cases keep a short history of completed tasks; live cases carry real work.
    const target = isOpen ? 1 + Math.floor(rand() * 3) : rand() > 0.7 ? 1 : 0

    for (let i = 0; i < target; i += 1) {
      counter += 1
      const status: TaskStatus = isOpen
        ? pick(rand, TASK_STATUSES)
        : 'done'
      const dueOffset = isOpen ? Math.round(rand() * 9) - 3 : -Math.round(rand() * 40) - 2

      tasks.push({
        id: `task-${String(counter).padStart(5, '0')}`,
        caseId: foiCase.id,
        title: pick(rand, TASK_TITLES),
        assigneeId: foiCase.assignedTo ?? pick(rand, staffIds),
        dueDate: relativeIso(dueOffset, 17, 0),
        status,
        createdBy: pick(rand, staffIds),
        createdAt: relativeIso(dueOffset - 4, 9, 0),
      })
    }
  })

  return tasks
}

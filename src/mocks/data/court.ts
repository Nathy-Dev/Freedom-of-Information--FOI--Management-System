import type { CourtDate, CourtDateStatus, FoiCase, HearingType } from '@/types'
import { pick, seededRandom } from '@/lib/utils'
import { courts, relativeDate, relativeIso } from './reference'

const JUDGES = [
  'Hon. Justice A. O. Nwaruh',
  'Hon. Justice E. A. Obile',
  'Hon. Justice T. G. Ringim',
  'Hon. Justice I. E. Ekwo',
  'Hon. Justice D. U. Okorowo',
  'Hon. Justice B. F. M. Nyako',
  'Hon. Justice S. B. Belgore',
]

const HEARING_TYPES: HearingType[] = [
  'mention',
  'mention',
  'motion',
  'hearing',
  'hearing',
  'adoption_of_address',
  'judgment',
  'pre_trial',
]

const PAST_STATUSES: CourtDateStatus[] = ['held', 'held', 'adjourned', 'cancelled']

const TIMES = ['09:00', '09:00', '09:30', '10:00', '10:00', '11:00', '11:30', '12:00', '14:00']

const OUTCOMES = [
  'Matter mentioned. Adjourned for hearing of the motion on notice at the request of the applicant.',
  'Motion for extension of time granted. Respondent to file its counter-affidavit within 14 days.',
  'Hearing part-heard. Applicant closed its case; matter adjourned for the defence.',
  'Court ordered HYPREP to release the schedule of contract awards, with contractor account details severed.',
  'Application dismissed for want of diligent prosecution. Costs of N50,000 awarded against the applicant.',
  'Parties reported settlement talks. Matter adjourned sine die with liberty to relist.',
  'Judgment delivered: the refusal was upheld in part; HYPREP to release the non-exempt portions within 21 days.',
  'Adjourned on the application of counsel to the respondent owing to a bereavement.',
  'Court directed the parties to file and exchange written addresses within 21 and 14 days respectively.',
]

const NOTES_BANK = [
  'Lead counsel to appear with the paralegal. Certified true copies of the determination letter required.',
  'Ensure the exhibit bundle is paginated and bound before the date. Registry closes filings at 15:00.',
  'External counsel briefed. Travel and per diem approved by the Head of Legal Unit.',
  'Requestor is represented by SERAP counsel. Expect an application for accelerated hearing.',
  'Confirm the case file is complete: originating process, counter-affidavit and written address.',
  'Court has directed personal appearance of the FOI Desk Officer to speak to the search certificate.',
]

/**
 * Court dates attach to contested matters: appeals, escalations and a slice of
 * refusals that proceeded to judicial review under section 20 of the FOI Act.
 */
export function buildCourtDates(cases: FoiCase[], counselIds: string[]): CourtDate[] {
  const rand = seededRandom(31007)
  const dates: CourtDate[] = []
  let counter = 0
  let suitSeq = 40

  const litigious = cases.filter(
    (c) =>
      c.status === 'appeal' ||
      c.status === 'escalated' ||
      ((c.status === 'rejected' || c.status === 'closed') && c.tags.includes('Litigation Risk') && rand() > 0.45),
  )

  litigious.forEach((foiCase) => {
    suitSeq += 1
    const court = pick(rand, courts)
    const judge = pick(rand, JUDGES)
    const year = new Date(foiCase.dateSubmitted).getFullYear()
    const suitNumber = `FHC/PH/CS/${suitSeq}/${year}`

    // Two to four appearances per matter: past ones are resolved, future ones listed.
    const sittings = 2 + Math.floor(rand() * 3)
    // First appearance roughly three weeks after the determination.
    let offset = -Math.max(
      4,
      Math.round((Date.now() - new Date(foiCase.dateSubmitted).getTime()) / 86_400_000) - 21,
    )

    for (let i = 0; i < sittings; i += 1) {
      counter += 1
      const isPast = offset < 0
      const isLast = i === sittings - 1

      const status: CourtDateStatus = isPast
        ? pick(rand, PAST_STATUSES)
        : 'scheduled'

      const hearingType = isLast && !isPast && rand() > 0.7 ? 'judgment' : pick(rand, HEARING_TYPES)

      dates.push({
        id: `crtd-${String(counter).padStart(4, '0')}`,
        caseId: foiCase.id,
        suitNumber,
        date: relativeDate(offset),
        time: pick(rand, TIMES),
        durationMinutes: pick(rand, [30, 45, 60, 60, 90, 120]),
        courtId: court.id,
        courtName: `${court.name}, ${court.division}`,
        location: court.address,
        judge,
        hearingType,
        status,
        counselIds: [pick(rand, counselIds), ...(rand() > 0.6 ? ['usr-020'] : [])],
        notes: pick(rand, NOTES_BANK),
        outcome: status === 'held' || status === 'adjourned' ? pick(rand, OUTCOMES) : null,
        nextActionDue: status === 'adjourned' ? relativeDate(offset + 21) : null,
        reminderLeadDays: pick(rand, [[7, 2, 1], [14, 7, 1], [3, 1]]),
        createdBy: pick(rand, counselIds),
        createdAt: relativeIso(offset - 18, 11, 0),
      })

      offset += 21 + Math.round(rand() * 25)
    }
  })

  // Guarantee a populated "this week" and "next 30 days" calendar for the demo.
  const upcomingCount = dates.filter((d) => new Date(d.date) >= new Date()).length
  if (upcomingCount < 6) {
    const extra = litigious.slice(0, 6 - upcomingCount)
    extra.forEach((foiCase, i) => {
      counter += 1
      const court = pick(rand, courts)
      dates.push({
        id: `crtd-${String(counter).padStart(4, '0')}`,
        caseId: foiCase.id,
        suitNumber: `FHC/PH/CS/${90 + i}/${new Date().getFullYear()}`,
        date: relativeDate(1 + i * 2),
        time: pick(rand, TIMES),
        durationMinutes: 60,
        courtId: court.id,
        courtName: `${court.name}, ${court.division}`,
        location: court.address,
        judge: pick(rand, JUDGES),
        hearingType: pick(rand, HEARING_TYPES),
        status: 'scheduled',
        counselIds: [pick(rand, counselIds)],
        notes: pick(rand, NOTES_BANK),
        outcome: null,
        nextActionDue: null,
        reminderLeadDays: [7, 2, 1],
        createdBy: pick(rand, counselIds),
        createdAt: relativeIso(-10, 11, 0),
      })
    })
  }

  return dates.sort((a, b) => a.date.localeCompare(b.date))
}

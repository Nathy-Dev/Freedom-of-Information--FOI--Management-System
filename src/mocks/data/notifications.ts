import type {
  AppNotification,
  CaseTask,
  CourtDate,
  FoiCase,
  NotificationChannel,
  NotificationKind,
  User,
} from '@/types'
import { pick, seededRandom } from '@/lib/utils'
import { computeSla } from '@/lib/sla'
import { formatDate } from '@/lib/format'
import { relativeIso } from './reference'

const CHANNELS: Record<NotificationKind, NotificationChannel[]> = {
  case_assigned: ['in_app', 'email'],
  status_changed: ['in_app', 'email'],
  response_uploaded: ['in_app', 'email'],
  due_soon: ['in_app', 'email'],
  overdue: ['in_app', 'email', 'sms'],
  court_reminder: ['in_app', 'email', 'sms'],
  mention: ['in_app'],
  task_assigned: ['in_app', 'email'],
  admin_alert: ['in_app', 'email'],
  appeal_filed: ['in_app', 'email'],
}

interface Args {
  cases: FoiCase[]
  courtDates: CourtDate[]
  tasks: CaseTask[]
  users: User[]
  userName: (id: string) => string
}

/**
 * FR-040/FR-041: the notification centre is derived from live state, so what a
 * user sees in the bell matches what the dashboards and queues are telling them.
 */
export function buildNotifications({ cases, courtDates, tasks, users, userName }: Args): AppNotification[] {
  const rand = seededRandom(52189)
  const items: AppNotification[] = []
  let counter = 0

  const staffIds = users
    .filter((u) => ['legal', 'clerk', 'admin', 'super_admin'].includes(u.roleId))
    .map((u) => u.id)

  const push = (
    userId: string,
    kind: NotificationKind,
    title: string,
    body: string,
    link: string,
    at: string,
    readBias = 0.55,
  ) => {
    counter += 1
    items.push({
      id: `ntf-${String(counter).padStart(5, '0')}`,
      userId,
      kind,
      title,
      body,
      link,
      at,
      isRead: rand() > readBias,
      channels: CHANNELS[kind],
    })
  }

  // SLA pressure — the notifications an officer most needs to see.
  cases.forEach((foiCase) => {
    const sla = computeSla(foiCase)
    const owner = foiCase.assignedTo
    if (!owner) return

    if (sla.state === 'overdue') {
      push(
        owner,
        'overdue',
        `Overdue: ${foiCase.caseNumber}`,
        `The statutory response deadline of ${formatDate(foiCase.statutoryDueDate)} has passed. ${sla.label}.`,
        `/cases/${foiCase.id}`,
        relativeIso(-Math.min(3, Math.abs(sla.daysRemaining)), 6, 5),
        0.25,
      )
      // The Head of Legal Unit is copied on every breach.
      push(
        'usr-004',
        'overdue',
        `Breach escalation: ${foiCase.caseNumber}`,
        `${userName(owner)} has a request past its statutory date. ${sla.label}.`,
        `/cases/${foiCase.id}`,
        relativeIso(-Math.min(3, Math.abs(sla.daysRemaining)), 6, 10),
        0.4,
      )
    } else if (sla.state === 'due_soon') {
      push(
        owner,
        'due_soon',
        `Due soon: ${foiCase.caseNumber}`,
        `${sla.label}. Statutory date ${formatDate(foiCase.statutoryDueDate)}.`,
        `/cases/${foiCase.id}`,
        relativeIso(0, 7, 0),
        0.3,
      )
    }
  })

  // Court reminders for hearings inside the next 14 days.
  const now = Date.now()
  courtDates.forEach((court) => {
    const days = Math.round((new Date(court.date).getTime() - now) / 86_400_000)
    if (court.status !== 'scheduled' || days < 0 || days > 14) return

    court.counselIds.forEach((counselId) => {
      push(
        counselId,
        'court_reminder',
        `Hearing in ${days === 0 ? 'today' : days === 1 ? '1 day' : `${days} days`}: ${court.suitNumber}`,
        `${court.hearingType.replace(/_/g, ' ')} at ${court.courtName} on ${formatDate(court.date)} at ${court.time} before ${court.judge}.`,
        `/court/${court.id}`,
        relativeIso(-1, 6, 30),
        0.3,
      )
    })
  })

  // Recent assignments, appeals and responses across the live caseload.
  cases
    .filter((c) => ['filed', 'in_review', 'pending_info', 'escalated', 'appeal'].includes(c.status))
    .slice(0, 40)
    .forEach((foiCase) => {
      if (foiCase.assignedTo && rand() > 0.45) {
        push(
          foiCase.assignedTo,
          'case_assigned',
          `Assigned to you: ${foiCase.caseNumber}`,
          `${foiCase.subject} — statutory date ${formatDate(foiCase.statutoryDueDate)}.`,
          `/cases/${foiCase.id}`,
          relativeIso(-Math.round(rand() * 6), 9, 20),
        )
      }

      if (foiCase.status === 'appeal') {
        push(
          'usr-004',
          'appeal_filed',
          `Appeal lodged: ${foiCase.caseNumber}`,
          `${foiCase.requestor.name} of ${foiCase.requestor.organization} has challenged the determination under section 20 of the Act.`,
          `/cases/${foiCase.id}`,
          relativeIso(-Math.round(rand() * 10), 11, 0),
          0.35,
        )
      }

      if (rand() > 0.82) {
        push(
          pick(rand, staffIds),
          'mention',
          `You were mentioned on ${foiCase.caseNumber}`,
          'Please confirm whether the section 12 third-party consultation has been issued.',
          `/cases/${foiCase.id}`,
          relativeIso(-Math.round(rand() * 5), 14, 40),
          0.5,
        )
      }
    })

  // Requestor-facing notifications for their own submissions.
  cases
    .filter((c) => c.respondedAt)
    .slice(0, 30)
    .forEach((foiCase) => {
      push(
        foiCase.requestorId,
        'response_uploaded',
        `Response available: ${foiCase.caseNumber}`,
        `A determination has been issued on your request concerning ${foiCase.subject}.`,
        `/my-requests/${foiCase.id}`,
        foiCase.respondedAt!,
        0.6,
      )
    })

  // Open tasks due within the week.
  tasks
    .filter((t) => t.status !== 'done')
    .slice(0, 25)
    .forEach((task) => {
      push(
        task.assigneeId,
        'task_assigned',
        task.title,
        `Due ${formatDate(task.dueDate)}. Assigned by ${userName(task.createdBy)}.`,
        `/cases/${task.caseId}`,
        task.createdAt,
        0.5,
      )
    })

  // Administrative alerts for privileged roles.
  const ADMIN_ALERTS: Array<[string, string, string]> = [
    [
      'SMTP relay degraded',
      'Outbound email is queuing. 14 notifications are pending delivery; the relay is being investigated by ICT.',
      '/system/monitoring',
    ],
    [
      'Nightly backup completed',
      'Encrypted backup verified and replicated off-site. Archive size 2.4 GB.',
      '/system/backups',
    ],
    [
      'Five failed sign-in attempts',
      'An account was temporarily locked after five consecutive failed attempts from 197.210.53.62.',
      '/audit/access',
    ],
    [
      'Retention purge pending approval',
      '38 documents have reached the end of their retention period and are awaiting approval for disposal.',
      '/system/retention',
    ],
    [
      'Bulk import completed with warnings',
      '412 of 420 rows imported. 8 rows were rejected for an invalid requestor email address.',
      '/import',
    ],
    [
      'Virus scan queue backlog',
      '3 uploaded documents are still awaiting a scan result and are quarantined until the scan completes.',
      '/documents',
    ],
  ]

  ADMIN_ALERTS.forEach(([title, body, link], index) => {
    ;['usr-001', 'usr-002'].forEach((admin) => {
      push(admin, 'admin_alert', title, body, link, relativeIso(-index - 1, 5, 45), 0.4)
    })
  })

  return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

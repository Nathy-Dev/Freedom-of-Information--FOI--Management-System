import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Building2,
  CalendarClock,
  FileSignature,
  Gavel,
  LifeBuoy,
  Mail,
  Phone,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import {
  Badge,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  SearchInput,
  Tabs,
} from '@/components/ui'
import type { TabItem } from '@/components/ui'
import { PageHeader } from '@/components/common'
import { TIMEZONE_LABEL } from '@/lib/format'
import { reference } from '@/mocks/db'
import { useAuth } from '@/store/AuthContext'

type HelpTab = 'guides' | 'statute' | 'faq' | 'contact'

const TABS: Array<TabItem<HelpTab>> = [
  { key: 'guides', label: 'Quick start', icon: <Sparkles className="h-4 w-4" /> },
  { key: 'statute', label: 'The FOI Act', icon: <Scale className="h-4 w-4" /> },
  { key: 'faq', label: 'FAQ', icon: <BookOpen className="h-4 w-4" /> },
  { key: 'contact', label: 'Contact', icon: <LifeBuoy className="h-4 w-4" /> },
]

interface Guide {
  title: string
  description: string
  to: string
  cta: string
  icon: JSX.Element
  audience: string
}

const GUIDES: Guide[] = [
  {
    title: 'Submit an FOI request',
    description:
      'Complete the four-step intake form: your details, what you are asking for, the format you want the records in, and a review before you file. You receive a case number and an acknowledgement immediately.',
    to: '/requests/new',
    cta: 'Start a request',
    icon: <FileSignature className="h-5 w-5" />,
    audience: 'Requestors & external stakeholders',
  },
  {
    title: 'Work a case to conclusion',
    description:
      'Open a case to see the full timeline, upload response documents with versioning, add internal notes, record the determination and close it against an outcome code.',
    to: '/cases',
    cta: 'Open the case list',
    icon: <Building2 className="h-5 w-5" />,
    audience: 'Legal Unit staff & clerks',
  },
  {
    title: 'Clear the review queue',
    description:
      'Unassigned and awaiting-decision requests collect in the review queue. Triage by priority and SLA, assign to an officer or a team, and escalate anything at risk of breaching the statutory window.',
    to: '/review-queue',
    cta: 'Go to the queue',
    icon: <ShieldCheck className="h-5 w-5" />,
    audience: 'Head of Legal Unit',
  },
  {
    title: 'Keep the court diary',
    description:
      'Record hearings against a suit number, set reminder lead times, and capture the outcome and the next action after each sitting. Month, week, day and list views share one dataset.',
    to: '/court',
    cta: 'Open the diary',
    icon: <Gavel className="h-5 w-5" />,
    audience: 'Litigation counsel',
  },
  {
    title: 'Report on compliance',
    description:
      'Run the standard statutory reports or build your own: pick a data source, choose columns, group and filter, then export to CSV or schedule it to arrive by email.',
    to: '/reports',
    cta: 'See reports',
    icon: <CalendarClock className="h-5 w-5" />,
    audience: 'Management & auditors',
  },
  {
    title: 'Find anything, fast',
    description:
      'Global search spans cases, documents, people and hearings. Results respect your permissions — you only ever see what your role allows.',
    to: '/search',
    cta: 'Search the system',
    icon: <Search className="h-5 w-5" />,
    audience: 'Everyone',
  },
]

interface Provision {
  section: string
  heading: string
  text: string
}

const PROVISIONS: Provision[] = [
  {
    section: 'Section 1',
    heading: 'Right of access',
    text: 'Every person has a right of access to records in the custody of a public institution, whether or not the record contains information about that person. An applicant need not demonstrate any specific interest in the information sought.',
  },
  {
    section: 'Section 2',
    heading: 'Proactive publication',
    text: 'A public institution must record, keep and widely disseminate information about its structure, functions, decisions, contracts and spending, and must update that information at least annually.',
  },
  {
    section: 'Section 4',
    heading: 'Seven days to respond',
    text: 'Where information is requested, the institution shall within seven days after the application either grant access, or give written notice that access is refused together with the grounds relied upon.',
  },
  {
    section: 'Section 5',
    heading: 'Transfer of a request',
    text: 'Where the record is held by another public institution, the request shall be transferred within three days and the applicant notified of the transfer.',
  },
  {
    section: 'Section 6',
    heading: 'Extension of time',
    text: 'The seven-day period may be extended by a further period of not more than seven days where the request is for a large number of records, or where consultations outside the institution are necessary. The applicant must be notified in writing.',
  },
  {
    section: 'Sections 11 – 17',
    heading: 'Exemptions',
    text: 'Access may be denied for defence and international affairs, law enforcement and investigations, personal information, third-party trade secrets and commercial confidences, professional privileges (including legal practitioner–client privilege), course-of-business records and certain research material.',
  },
  {
    section: 'Section 18',
    heading: 'Severance',
    text: 'Where a record contains both exempt and non-exempt material, the exempt portions shall be severed and the remainder released. Every severance recorded in this system is mapped to the ground relied upon.',
  },
  {
    section: 'Section 20',
    heading: 'Judicial review',
    text: 'An applicant who has been denied access may apply to the Federal High Court for a review of the decision within thirty days after the notice of denial.',
  },
  {
    section: 'Section 29',
    heading: 'Annual report to the Attorney-General',
    text: 'Each public institution shall submit to the Attorney-General of the Federation, not later than 1 February each year, a report covering the preceding year: requests received, granted, refused, the sections relied upon and the average handling time.',
  },
]

interface Faq {
  question: string
  answer: string
  tags: string[]
}

const FAQS: Faq[] = [
  {
    question: 'How is the statutory due date calculated?',
    answer:
      'The clock starts on the day the request is received and runs for seven calendar days, per section 4 of the FOI Act 2011. Where a section 6 extension is granted the due date moves out by a further seven days and the case shows an "extended" marker. All timers are evaluated in the Africa/Lagos timezone.',
    tags: ['SLA', 'Section 4', 'Section 6'],
  },
  {
    question: 'Who can see internal notes?',
    answer:
      'Internal notes are visible only to holders of the note:read:internal permission — Legal Unit staff, the Head of Legal Unit, administrators and auditors. Requestors see only notes explicitly shared with them, which are labelled "shared with requestor" when written.',
    tags: ['Permissions', 'Notes'],
  },
  {
    question: 'Can I withdraw or edit a request after filing?',
    answer:
      'A filed request cannot be edited, because the text of the request forms part of the statutory record. You can add a clarification note to the case, or ask the FOI desk to withdraw it — the withdrawal and its reason are both written to the audit trail.',
    tags: ['Requestors', 'Audit'],
  },
  {
    question: 'Why can I not download a document?',
    answer:
      'Downloads require the document:download permission and are blocked for read-only roles. Confidential and restricted documents additionally require that you are assigned to the case. Every view, download and print attempt — successful or denied — is recorded in the access log.',
    tags: ['Documents', 'Access logs'],
  },
  {
    question: 'What happens when a case goes overdue?',
    answer:
      'The case turns red across every list and dashboard, an overdue notification fires to the assignee and the Head of Legal Unit, and an SLA breach event is written to the case timeline. Overdue cases are counted in the monthly compliance report and in the section 29 annual return.',
    tags: ['SLA', 'Notifications'],
  },
  {
    question: 'Is this the live system?',
    answer:
      'No. This is a frontend prototype for review. All cases, people, documents and hearings are realistic mock data generated in the browser; nothing is saved to a server and changes reset when you reload the page.',
    tags: ['Prototype'],
  },
]

const CONTACTS = [
  {
    label: 'FOI Desk Officer',
    name: 'Legal Unit, HYPREP',
    email: 'foi@hyprep.gov.ng',
    phone: '+234 (0) 803 000 0101',
    note: 'Requests, acknowledgements, fee assessments and progress enquiries.',
  },
  {
    label: 'Head of Legal Unit',
    name: 'Office of the Head of Legal',
    email: 'legal@hyprep.gov.ng',
    phone: '+234 (0) 803 000 0102',
    note: 'Determinations, exemption decisions, escalations and appeals.',
  },
  {
    label: 'System administrator',
    name: 'ICT Unit',
    email: 'ict-support@hyprep.gov.ng',
    phone: '+234 (0) 803 000 0110',
    note: 'Accounts, passwords, two-factor enrolment and access requests.',
  },
]

/** FR-062: in-product guidance, statutory reference and support routes. */
export function HelpPage() {
  const { role, isAuthenticated } = useAuth()
  const [tab, setTab] = useState<HelpTab>('guides')
  const [term, setTerm] = useState('')

  const needle = term.trim().toLowerCase()

  const guides = useMemo(
    () =>
      needle
        ? GUIDES.filter((guide) =>
            `${guide.title} ${guide.description} ${guide.audience}`.toLowerCase().includes(needle),
          )
        : GUIDES,
    [needle],
  )

  const provisions = useMemo(
    () =>
      needle
        ? PROVISIONS.filter((item) =>
            `${item.section} ${item.heading} ${item.text}`.toLowerCase().includes(needle),
          )
        : PROVISIONS,
    [needle],
  )

  const faqs = useMemo(
    () =>
      needle
        ? FAQS.filter((item) =>
            `${item.question} ${item.answer} ${item.tags.join(' ')}`.toLowerCase().includes(needle),
          )
        : FAQS,
    [needle],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Help & guidance"
        description="How to use the FOI Management System, what the Freedom of Information Act 2011 requires, and who to contact."
        icon={<LifeBuoy className="h-5 w-5" />}
        breadcrumbs={[{ label: 'Help & guidance' }]}
        actions={
          <div className="w-full sm:w-72">
            <SearchInput
              value={term}
              onChange={setTerm}
              placeholder="Search guidance, sections, FAQs…"
              label="Search help"
            />
          </div>
        }
      />

      <Card className="border-brand-200 bg-brand-50/70">
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Scale className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
            <div>
              <p className="text-sm font-semibold text-brand-900">
                Freedom of Information Act 2011 — seven days to respond
              </p>
              <p className="mt-0.5 text-xs text-brand-800">
                HYPREP must grant access or give written reasons for refusal within seven days of receiving a request.
                All deadlines in this system are counted in {TIMEZONE_LABEL}.
              </p>
            </div>
          </div>
          {isAuthenticated && role ? <Badge tone="brand">Signed in as {role.name}</Badge> : null}
        </CardBody>
      </Card>

      <Tabs tabs={TABS} active={tab} onChange={setTab} label="Help sections" />

      {tab === 'guides' ? (
        guides.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No guidance matched"
            description={`Nothing in the quick-start guides mentions “${term}”. Try the FOI Act tab or the FAQ.`}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {guides.map((guide) => (
              <Card key={guide.title} className="flex flex-col">
                <CardBody className="flex flex-1 flex-col gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    {guide.icon}
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ink-900">{guide.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-600">{guide.description}</p>
                  </div>
                  <p className="text-2xs font-medium uppercase tracking-wide text-ink-400">{guide.audience}</p>
                  <ButtonLink to={guide.to} variant="secondary" size="sm">
                    {guide.cta}
                  </ButtonLink>
                </CardBody>
              </Card>
            ))}
          </div>
        )
      ) : null}

      {tab === 'statute' ? (
        provisions.length === 0 ? (
          <EmptyState
            icon={<Scale className="h-6 w-6" />}
            title="No provision matched"
            description={`No section summary mentions “${term}”.`}
          />
        ) : (
          <div className="space-y-3">
            <Card>
              <CardHeader
                title="Freedom of Information Act 2011 — the provisions this system enforces"
                description="Summaries for orientation only. The Act itself governs; consult the Head of Legal Unit on any contested question."
              />
              <CardBody className="divide-y divide-ink-100 p-0">
                {provisions.map((item) => (
                  <div key={item.section} className="flex flex-col gap-1.5 p-4 sm:flex-row sm:gap-4">
                    <div className="sm:w-40 sm:shrink-0">
                      <Badge tone="brand">{item.section}</Badge>
                      <p className="mt-1.5 text-xs font-semibold text-ink-800">{item.heading}</p>
                    </div>
                    <p className="text-sm leading-relaxed text-ink-600">{item.text}</p>
                  </div>
                ))}
              </CardBody>
            </Card>
          </div>
        )
      ) : null}

      {tab === 'faq' ? (
        faqs.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-6 w-6" />}
            title="No answer matched"
            description={`No FAQ mentions “${term}”. Try the contact tab and we will answer directly.`}
          />
        ) : (
          <div className="space-y-3">
            {faqs.map((item) => (
              <Card key={item.question}>
                <CardBody>
                  <p className="text-sm font-semibold text-ink-900">{item.question}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{item.answer}</p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {item.tags.map((tag) => (
                      <Badge key={tag} tone="neutral">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )
      ) : null}

      {tab === 'contact' ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {CONTACTS.map((contact) => (
              <Card key={contact.label}>
                <CardHeader title={contact.label} description={contact.name} />
                <CardBody className="space-y-2">
                  <p className="text-xs leading-relaxed text-ink-600">{contact.note}</p>
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-2 rounded-lg border border-ink-200 p-2.5 text-xs font-medium text-ink-800 transition-colors hover:border-brand-300 hover:bg-brand-50"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-brand-600" />
                    {contact.email}
                  </a>
                  <a
                    href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`}
                    className="flex items-center gap-2 rounded-lg border border-ink-200 p-2.5 text-xs font-medium text-ink-800 transition-colors hover:border-brand-300 hover:bg-brand-50"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-brand-600" />
                    {contact.phone}
                  </a>
                </CardBody>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader
              title="Where to write"
              description="Hard-copy requests may be delivered by hand or by post during working hours."
            />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Postal address</p>
                <address className="mt-1.5 text-sm not-italic leading-relaxed text-ink-700">
                  The FOI Desk Officer
                  <br />
                  Legal Unit, Hydrocarbon Pollution Remediation Project (HYPREP)
                  <br />
                  Federal Ministry of Environment
                  <br />
                  Port Harcourt, Rivers State
                  <br />
                  Nigeria
                </address>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Office hours</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-700">
                  Monday to Friday, 08:00 – 16:00 ({TIMEZONE_LABEL}), excluding public holidays.
                </p>
                <p className="mt-2 text-xs text-ink-500">
                  Requests received after 16:00, at a weekend or on a public holiday are treated as received on the next
                  working day for the purposes of the section 4 timetable.
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Courts where FOI matters are heard"
              description="Judicial review under section 20 of the Act is commenced at the Federal High Court."
            />
            <CardBody className="p-0">
              <ul className="divide-y divide-ink-100">
                {reference.courts.map((court) => (
                  <li key={court.id} className="flex items-start gap-3 p-4">
                    <Gavel className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900">
                        {court.name} <span className="font-normal text-ink-500">· {court.division}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-ink-500">{court.address}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <p className="text-xs text-ink-500">
            Still stuck? Open the{' '}
            <Link to="/notifications" className="font-medium text-brand-700 underline-offset-2 hover:underline">
              notifications
            </Link>{' '}
            page to check for system messages, or ask your administrator to raise a ticket with the ICT Unit.
          </p>
        </div>
      ) : null}
    </div>
  )
}

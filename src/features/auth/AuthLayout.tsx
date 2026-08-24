import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { BrandLockup, CoatOfArms, FlagRule } from '@/components/common'
import { STATUTORY_RESPONSE_DAYS } from '@/lib/constants'
import { TIMEZONE_LABEL } from '@/lib/format'
import { cn } from '@/lib/utils'

interface PanelClause {
  /**
   * Which section of the Act the clause states, spelled out. A bare `§`
   * glyph is a US citation habit and reads as noise to an applicant.
   */
  section: string
  title: string
  body: string
}

interface AuthPanel {
  headline: string
  lede: string
  /** The instrument the sections below belong to, named above the list. */
  source: string
  clauses: PanelClause[]
}

/**
 * What the green panel recites. Staff screens recite the duties the Legal Unit
 * works under; registration recites the right the applicant is exercising.
 * Every clause is attributed to its section of the Act.
 */
const PANELS: Record<'staff' | 'public', AuthPanel> = {
  staff: {
    headline: 'A single register for the public’s right to know.',
    source: 'Freedom of Information Act 2011',
    lede: 'Requests to the HYPREP Legal Unit are received, acknowledged, reviewed, redacted and determined on one file — with the statutory clock running from the day they arrive.',
    clauses: [
      {
        section: 'Section 4',
        title: `${STATUTORY_RESPONSE_DAYS} days to answer`,
        body: 'The response window opens on receipt. Escalation is raised before it closes, not after.',
      },
      {
        section: 'Section 18',
        title: 'Severance, not silence',
        body: 'Exempt material is redacted passage by passage and the remainder released, with the ground recorded against every cut.',
      },
      {
        section: 'Section 20',
        title: 'Answerable in court',
        body: 'Suit numbers, hearing dates and judgments sit beside the determination they arise from.',
      },
    ],
  },
  public: {
    headline: 'Any person may ask. No reason required.',
    source: 'Freedom of Information Act 2011',
    lede: 'The Freedom of Information Act 2011 gives every person a right of access to records held by a public institution. Registration exists only so the response can be served on you and the file can be traced.',
    clauses: [
      {
        section: 'Section 1',
        title: 'The right of access',
        body: 'An applicant need not demonstrate any specific interest in the information applied for.',
      },
      {
        section: 'Section 4',
        title: 'A determination in writing',
        body: `HYPREP must grant or refuse the request within ${STATUTORY_RESPONSE_DAYS} days of receiving it, and give its reasons for any refusal.`,
      },
      {
        section: 'Section 20',
        title: 'If you are refused',
        body: 'A refusal — or a deemed refusal — may be taken to court for judicial review within 30 days.',
      },
    ],
  },
}

export interface AuthLayoutProps {
  /** Small-caps line above the title: what this sheet is for. */
  eyebrow?: string
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  /** Which set of clauses the green panel recites. */
  panel?: keyof typeof PANELS
  /** Registration needs a wider sheet than sign-in. */
  wide?: boolean
}

/**
 * Shell shared by sign-in, registration and recovery.
 *
 * The left half is dressed as the cover of the register — masthead, recital,
 * then the clauses of the Act the screen operates under, over a ghosted crest.
 * The right half is the sheet you fill in. Only the sheet carries the `h1`, so
 * the heading order holds at every breakpoint even though the panel is hidden
 * below `lg`.
 */
export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
  panel = 'staff',
  wide,
}: AuthLayoutProps) {
  const { headline, lede, source, clauses } = PANELS[panel]

  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[minmax(0,1.04fr)_minmax(0,1fr)]">
      <aside className="auth-canvas relative hidden overflow-hidden text-white lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:self-start">
        <div aria-hidden className="ledger-rule pointer-events-none absolute inset-0" />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-32 select-none">
          <CoatOfArms
            size="xl"
            className="h-[30rem] w-[30rem] opacity-[0.09] brightness-[1.85] grayscale"
          />
        </div>

        <div className="scrollbar-none relative flex h-full flex-col overflow-y-auto px-10 py-10 xl:px-14 xl:py-12">
          <header className="shrink-0">
            <p className="font-mono text-2xs uppercase tracking-[0.22em] text-brand-200">
              Federal Republic of Nigeria
            </p>
            <div className="mt-4">
              <BrandLockup size="lg" onDark subtitle="Freedom of Information Management System" />
            </div>
            <FlagRule className="mt-5 w-28 ring-1 ring-white/25" />
          </header>

          <div className="my-auto max-w-[31rem] py-12">
            <p className="text-balance font-serif text-[2.125rem] font-semibold leading-[1.14] text-white">
              {headline}
            </p>
            <p className="mt-5 text-sm leading-relaxed text-brand-50">{lede}</p>

            <p className="mt-9 font-mono text-2xs uppercase tracking-[0.18em] text-brand-200">
              Under the {source}
            </p>
            <dl className="mt-3 border-t border-white/15">
              {clauses.map((clause) => (
                <div key={clause.section} className="border-b border-white/15 py-4">
                  <dt className="text-sm font-semibold text-white">{clause.title}</dt>
                  <dd>
                    <p className="mt-1 text-xs leading-relaxed text-brand-100">{clause.body}</p>
                    <p className="mt-2 font-mono text-2xs uppercase tracking-[0.16em] text-brand-200">
                      {clause.section}
                    </p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <footer className="shrink-0 border-t border-white/15 pt-5">
            <p className="flex items-start gap-2 text-xs leading-relaxed text-brand-100">
              <Lock aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Access is logged against your account. Unauthorised access is an offence under the
              Cybercrimes (Prohibition, Prevention, etc.) Act 2015.
            </p>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-2xs uppercase tracking-[0.16em] text-brand-200">
              <span>HYPREP Legal Unit</span>
              <span aria-hidden className="h-2.5 w-px bg-white/30" />
              <span>{TIMEZONE_LABEL}</span>
            </p>
          </footer>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-col bg-white">
        {/* The green panel is hidden below `lg`, so the crest leads in a band instead. */}
        <div className="auth-canvas relative overflow-hidden px-5 py-4 sm:px-8 lg:hidden">
          <div aria-hidden className="ledger-rule pointer-events-none absolute inset-0" />
          <div className="relative flex items-center justify-between gap-4">
            <BrandLockup size="md" onDark subtitle="Freedom of Information Management" />
            <FlagRule className="w-12 shrink-0 ring-1 ring-white/25" />
          </div>
        </div>

        <div className="flex flex-1 justify-center px-5 py-10 sm:px-8 lg:items-center lg:px-12 xl:px-16">
          <div className={cn('w-full', wide ? 'max-w-[33rem]' : 'max-w-[26.5rem]')}>
            <header>
              {eyebrow ? (
                <p className="flex items-center gap-2.5 font-mono text-2xs uppercase tracking-[0.2em] text-brand-700">
                  <span aria-hidden className="h-3 w-0.5 shrink-0 bg-brand-500" />
                  {eyebrow}
                </p>
              ) : null}
              <h1
                className={cn(
                  'text-balance font-serif text-[1.875rem] leading-[1.18] text-ink-900',
                  eyebrow && 'mt-3',
                )}
              >
                {title}
              </h1>
              {description ? (
                <p className="mt-3 text-sm leading-relaxed text-ink-600">{description}</p>
              ) : null}
            </header>

            <div className="mt-8">{children}</div>

            {footer ? <div className="mt-9 border-t border-ink-200 pt-6">{footer}</div> : null}

            <p className="mt-10 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-t border-ink-100 pt-5 text-center text-2xs text-ink-400">
              <span>Federal Republic of Nigeria</span>
              <span aria-hidden>·</span>
              <span>Federal Ministry of Environment</span>
              <span aria-hidden>·</span>
              <span>HYPREP Legal Unit</span>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}

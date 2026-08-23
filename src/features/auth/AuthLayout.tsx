import type { ReactNode } from 'react'
import { ShieldCheck, Scale, Clock4, FileSearch } from 'lucide-react'
import { BrandLockup, FlagRule } from '@/components/common'
import { STATUTORY_RESPONSE_DAYS } from '@/lib/constants'

const HIGHLIGHTS = [
  {
    icon: Clock4,
    title: `${STATUTORY_RESPONSE_DAYS}-day statutory clock`,
    body: 'Every request is timed against section 4 of the Freedom of Information Act 2011, with escalation before the deadline passes.',
  },
  {
    icon: FileSearch,
    title: 'One case file per request',
    body: 'Correspondence, records, redactions, internal notes and court appearances are held together and fully audited.',
  },
  {
    icon: Scale,
    title: 'Litigation ready',
    body: 'Suit numbers, hearing dates and outcomes are tracked alongside the determination they arise from.',
  },
]

/** Split-screen shell shared by sign-in, registration and recovery screens. */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <aside className="auth-canvas relative hidden overflow-hidden px-10 py-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-300/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-700/30 blur-3xl" />
        <BrandLockup size="lg" onDark subtitle="Freedom of Information Management System" />
        <FlagRule className="mt-6 max-w-[9rem]" />

        <div className="relative mt-12 max-w-lg">
          <h1 className="text-balance text-3xl font-semibold leading-tight text-white">
            Statutory FOI compliance for the Hydrocarbon Pollution Remediation Project
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-brand-50">
            A single register for public information requests to the HYPREP Legal Unit — from receipt
            and acknowledgement through review, redaction, response and any litigation that follows.
          </p>
        </div>

        <ul className="relative mt-10 space-y-5">
          {HIGHLIGHTS.map((item) => (
            <li key={item.title} className="flex gap-3.5">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <item.icon aria-hidden className="h-4.5 w-4.5 text-white" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-brand-50">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <p className="relative mt-auto flex items-center gap-2 pt-10 text-[11px] text-brand-100">
          <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
          Access is logged. Unauthorised use is an offence under the Cybercrimes Act 2015.
        </p>
      </aside>

      <main className="flex items-center justify-center bg-white px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden">
            <BrandLockup size="md" subtitle="FOI Management System" />
            <FlagRule className="mt-4 max-w-[7rem]" />
          </div>

          <div className="mt-8 lg:mt-0">
            <h2 className="text-2xl font-semibold text-ink-900">{title}</h2>
            {description ? (
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{description}</p>
            ) : null}
          </div>

          <div className="mt-7">{children}</div>

          {footer ? <div className="mt-7 border-t border-ink-200 pt-5">{footer}</div> : null}

          <p className="mt-10 text-center text-[11px] text-ink-400">
            Federal Republic of Nigeria · Ministry of Environment · HYPREP Legal Unit
          </p>
        </div>
      </main>
    </div>
  )
}

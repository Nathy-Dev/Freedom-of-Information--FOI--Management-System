/**
 * Statutory deadline tracking (FR-017) — server-side port of `src/lib/sla.ts`.
 *
 * The Nigerian Freedom of Information Act 2011 (section 4) gives a public
 * institution 7 working days to respond, extendable by a further 7 days.
 * `statutoryDueDate` on the case is authoritative; this module derives the
 * warning/breach state and progress figures. Pure functions, unit-testable.
 */

export interface SlaState {
  state: "on_track" | "due_soon" | "overdue" | "met" | "breached" | "not_applicable";
  daysRemaining: number;
  daysElapsed: number;
  totalDays: number;
  percentElapsed: number;
  label: string;
}

const RESOLVED_STATUSES = ["responded", "closed", "rejected"] as const;

export function computeSla(
  foiCase: {
    statutoryDueDate: string;
    dateSubmitted: string;
    status: string;
    respondedAt?: string | null;
    dateClosed?: string | null;
  },
  warningThresholdDays = 2,
  now: Date = new Date(),
): SlaState {
  const due = parseDay(foiCase.statutoryDueDate);
  const submitted = parseDay(foiCase.dateSubmitted);
  const totalDays = Math.max(daysBetween(submitted, due), 1);

  const isResolved = RESOLVED_STATUSES.includes(foiCase.status as (typeof RESOLVED_STATUSES)[number]);
  const resolvedAt = foiCase.respondedAt
    ? parseDay(foiCase.respondedAt)
    : foiCase.dateClosed
      ? parseDay(foiCase.dateClosed)
      : null;

  if (isResolved && resolvedAt) {
    const overrun = daysBetween(due, resolvedAt);
    const elapsed = Math.max(daysBetween(submitted, resolvedAt), 0);
    const met = overrun <= 0;
    return {
      state: met ? "met" : "breached",
      daysRemaining: -overrun,
      daysElapsed: elapsed,
      totalDays,
      percentElapsed: clamp(Math.round((elapsed / totalDays) * 100), 0, 100),
      label: met
        ? `Answered ${Math.abs(overrun)} ${Math.abs(overrun) === 1 ? "day" : "days"} inside the deadline`
        : `Answered ${overrun} ${overrun === 1 ? "day" : "days"} late`,
    };
  }

  const daysRemaining = daysBetween(now, due);
  const daysElapsed = Math.max(daysBetween(submitted, now), 0);
  const percentElapsed = clamp(Math.round((daysElapsed / totalDays) * 100), 0, 100);

  let state: SlaState["state"];
  let label: string;
  if (daysRemaining < 0) {
    state = "overdue";
    const late = Math.abs(daysRemaining);
    label = `Overdue by ${late} ${late === 1 ? "day" : "days"}`;
  } else if (daysRemaining === 0) {
    state = "due_soon";
    label = "Due today";
  } else if (daysRemaining <= warningThresholdDays) {
    state = "due_soon";
    label = `Due in ${daysRemaining} ${daysRemaining === 1 ? "day" : "days"}`;
  } else {
    state = "on_track";
    label = `${daysRemaining} days remaining`;
  }

  return { state, daysRemaining, daysElapsed, totalDays, percentElapsed, label };
}

export function isOverdue(
  foiCase: Parameters<typeof computeSla>[0],
  now: Date = new Date(),
) {
  return computeSla(foiCase, 2, now).state === "overdue";
}

export function isDueSoon(
  foiCase: Parameters<typeof computeSla>[0],
  threshold = 2,
  now: Date = new Date(),
) {
  return computeSla(foiCase, threshold, now).state === "due_soon";
}

/** Compliance rate: share of determined cases answered on or before due date. */
export function slaComplianceRate(
  cases: Parameters<typeof computeSla>[0][],
  now: Date = new Date(),
) {
  const determined = cases
    .map((c) => computeSla(c, 2, now))
    .filter((sla) => sla.state === "met" || sla.state === "breached");
  if (!determined.length) return 100;
  const met = determined.filter((sla) => sla.state === "met").length;
  return Math.round((met / determined.length) * 1000) / 10;
}

/** Average calendar days from submission to first response, for resolved cases. */
export function averageResponseDays(
  cases: Parameters<typeof computeSla>[0][],
) {
  const resolved = cases.filter((c) => c.respondedAt || c.dateClosed);
  if (!resolved.length) return 0;
  const total = resolved.reduce((acc, c) => {
    const end = parseDay((c.respondedAt ?? c.dateClosed)!);
    return acc + Math.max(daysBetween(parseDay(c.dateSubmitted), end), 0);
  }, 0);
  return Math.round((total / resolved.length) * 10) / 10;
}

/** Case-aging buckets for the dashboard chart (open cases only). */
export function agingBuckets(
  cases: Parameters<typeof computeSla>[0][],
  now: Date = new Date(),
) {
  const buckets = [
    { bucket: "0-3 days", min: 0, max: 3, count: 0 },
    { bucket: "4-7 days", min: 4, max: 7, count: 0 },
    { bucket: "8-14 days", min: 8, max: 14, count: 0 },
    { bucket: "15-30 days", min: 15, max: 30, count: 0 },
    { bucket: "30+ days", min: 31, max: Number.POSITIVE_INFINITY, count: 0 },
  ];
  cases
    .filter((c) => !(CONCLUDED as readonly string[]).includes(c.status))
    .forEach((c) => {
      const age = Math.max(daysBetween(parseDay(c.dateSubmitted), now), 0);
      const bucket = buckets.find((b) => age >= b.min && age <= b.max);
      if (bucket) bucket.count += 1;
    });
  return buckets.map(({ bucket, count }) => ({ bucket, count }));
}

export const CONCLUDED = ["closed", "rejected"] as const;

/** Add N working days (Mon–Fri) to a date, returning an ISO date string (yyyy-mm-dd). */
export function addWorkingDays(start: Date, days: number): string {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d.toISOString().slice(0, 10);
}

function parseDay(value: string | Date): Date {
  return typeof value === "string" ? new Date(`${value}T00:00:00Z`) : value;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Identifier helpers — case numbers and counters (FR-011).
 */

export interface CounterStore {
  get: (key: string) => Promise<number>;
  set: (key: string, value: number) => Promise<void>;
}

/** Next monotonic value for a named counter. */
export async function nextSequence(counters: CounterStore, prefix: string): Promise<string> {
  const current = await counters.get(prefix);
  const next = current + 1;
  await counters.set(prefix, next);
  return `${prefix}-${next}`;
}

/** HYPREP/FOI/YYYY/NNNN — the format the frontend already renders. */
export async function nextCaseNumber(
  counters: CounterStore,
  now: Date = new Date(),
): Promise<string> {
  const year = now.getFullYear();
  const key = `case:${year}`;
  const current = await counters.get(key);
  const next = current + 1;
  await counters.set(key, next);
  return `HYPREP/FOI/${year}/${String(next).padStart(4, "0")}`;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function isoNow(): string {
  return new Date().toISOString();
}

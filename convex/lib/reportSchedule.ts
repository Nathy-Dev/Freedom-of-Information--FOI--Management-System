export function nextReportRun(cadence: string, from = new Date()): string | undefined {
  if (cadence === "none") return undefined;
  const next = new Date(from);
  next.setUTCHours(5, 0, 0, 0);
  if (cadence === "weekly") {
    next.setUTCDate(next.getUTCDate() + (8 - next.getUTCDay()) % 7);
    if (next <= from) next.setUTCDate(next.getUTCDate() + 7);
  } else {
    next.setUTCDate(1);
    if (cadence === "monthly") {
      if (next <= from) next.setUTCMonth(next.getUTCMonth() + 1);
    } else if (cadence === "quarterly") {
      next.setUTCMonth(Math.floor(next.getUTCMonth() / 3) * 3);
      if (next <= from) next.setUTCMonth(next.getUTCMonth() + 3);
    } else if (cadence === "yearly") {
      next.setUTCMonth(0);
      if (next <= from) next.setUTCFullYear(next.getUTCFullYear() + 1);
    } else throw new Error("Unsupported report schedule.");
  }
  return next.toISOString();
}

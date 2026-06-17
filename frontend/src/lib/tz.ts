export const TZ = "Asia/Kolkata";

export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Noon IST on a YYYY-MM-DD calendar date — stable anchor for date-only math. */
export function istNoonDate(dateStr: string): Date {
  return new Date(`${dateStr}T12:00:00+05:30`);
}

export function offsetDateIST(dateStr: string, days: number): string {
  const d = istNoonDate(dateStr);
  d.setDate(d.getDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

export function fmtDateIST(d: Date | string | number, opts: Omit<Intl.DateTimeFormatOptions, "timeZone"> = {}): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, ...opts }).format(new Date(d as string));
}

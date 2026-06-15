export const TZ = "Asia/Kolkata";

export function todayIST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

export function fmtDateIST(d: Date | string | number, opts: Omit<Intl.DateTimeFormatOptions, "timeZone"> = {}): string {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TZ, ...opts }).format(new Date(d as string));
}

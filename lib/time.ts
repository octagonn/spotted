const minutesPerDay = 1440;

export function dayKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function localDayOfWeek(date: Date, timeZone: string) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

export function hasLocalMidnightCrossed(previous: Date, current: Date, timeZone: string) {
  return dayKey(previous, timeZone) !== dayKey(current, timeZone);
}

export function minutesSinceMidnight(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function isWithinLocalWindow(date: Date, timeZone: string, startMinute: number, endMinute: number) {
  const minute = minutesSinceMidnight(date, timeZone);
  if (startMinute <= endMinute) {
    return minute >= startMinute && minute <= endMinute;
  }
  return minute >= startMinute || minute <= endMinute || endMinute === minutesPerDay;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function timeAgo(iso: string, now: Date = new Date()) {
  const then = new Date(iso).getTime();
  const diffMs = now.getTime() - then;
  if (Number.isNaN(diffMs)) return "";
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}d`;
  const diffWeek = Math.floor(diffDay / 7);
  return `${diffWeek}w`;
}

export function hoursLeft(expiresAtIso: string, now: Date = new Date()) {
  const expires = new Date(expiresAtIso).getTime();
  const remainingMs = Math.max(0, expires - now.getTime());
  return Math.max(0, Math.floor(remainingMs / 3_600_000));
}

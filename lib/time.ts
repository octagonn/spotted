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

// Date-only math. A "local date" is a YYYY-MM-DD string in the trainee's timezone.
// Day N of the academy is day1 + (N - 1) calendar days.

export type LocalDate = string;

const MS_PER_DAY = 86_400_000;

function toUtc(d: LocalDate): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}

function fromUtc(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(d: LocalDate, n: number): LocalDate {
  return fromUtc(toUtc(d) + n * MS_PER_DAY);
}

export function dayOfWeek(d: LocalDate): number {
  return new Date(toUtc(d)).getUTCDay(); // 0 = Sunday
}

export function isWeekend(d: LocalDate): boolean {
  const w = dayOfWeek(d);
  return w === 0 || w === 6;
}

export function isWorkingDay(d: LocalDate, holidays: ReadonlySet<LocalDate>): boolean {
  return !isWeekend(d) && !holidays.has(d);
}

/** Academy day number N maps to a calendar date. Day 1 is the start date. */
export function academyDay(day1: LocalDate, n: number): LocalDate {
  return addDays(day1, n - 1);
}

/** Current date in an IANA timezone as YYYY-MM-DD. */
export function localToday(timezone: string, now: Date = new Date()): LocalDate {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Prior working day on or before d. */
export function onOrBeforeWorkingDay(d: LocalDate, holidays: ReadonlySet<LocalDate>): LocalDate {
  let cur = d;
  while (!isWorkingDay(cur, holidays)) cur = addDays(cur, -1);
  return cur;
}

/** Add n working days (n may be 0). Lands on a working day. */
export function addBusinessDays(d: LocalDate, n: number, holidays: ReadonlySet<LocalDate>): LocalDate {
  let cur = d;
  let left = n;
  while (left > 0) {
    cur = addDays(cur, 1);
    if (isWorkingDay(cur, holidays)) left--;
  }
  return cur;
}

/** Working days elapsed after `from` up to and including `to`. Zero if to <= from. */
export function businessDaysBetween(from: LocalDate, to: LocalDate, holidays: ReadonlySet<LocalDate>): number {
  let count = 0;
  let cur = from;
  while (cur < to) {
    cur = addDays(cur, 1);
    if (isWorkingDay(cur, holidays)) count++;
  }
  return count;
}

export function formatLongDate(d: LocalDate): string {
  return new Date(toUtc(d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

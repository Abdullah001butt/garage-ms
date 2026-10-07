// One date/time format for the whole app, always in UAE time.
// Pages render on the server (UTC), so without an explicit time zone an
// appointment at 10:30 in Dubai would display as 06:30.
const TZ = "Asia/Dubai";

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput) {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 6 Oct 2026 */
export function formatDate(value: DateInput, fallback = "—") {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }) : fallback;
}

/** 6 October 2026 */
export function formatDateLong(value: DateInput, fallback = "—") {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }) : fallback;
}

/** 4:24 PM */
export function formatTime(value: DateInput, fallback = "—") {
  const d = toDate(value);
  return d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ }) : fallback;
}

/** 6 Oct 2026, 4:24 PM */
export function formatDateTime(value: DateInput, fallback = "—") {
  const d = toDate(value);
  return d ? `${formatDate(d)}, ${formatTime(d)}` : fallback;
}

/** Tuesday, 6 October 2026 */
export function formatWeekdayDate(value: DateInput, fallback = "—") {
  const d = toDate(value);
  return d
    ? d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: TZ })
    : fallback;
}

/** October 2026 */
export function formatMonth(value: DateInput, fallback = "—") {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: TZ }) : fallback;
}

/** "3h ago", "2d ago", or the date for anything older than a week. */
export function formatRelative(value: DateInput, fallback = "—") {
  const d = toDate(value);
  if (!d) return fallback;
  const minutes = Math.round((Date.now() - d.getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(d);
}

/** Calendar key (YYYY-MM-DD) in UAE time — for grouping by day. */
export function dayKey(value: DateInput) {
  const d = toDate(value);
  return d ? d.toLocaleDateString("en-CA", { timeZone: TZ }) : "";
}

/** Start/end (ISO) of a calendar day in UAE time (UTC+4, no daylight saving). */
export function uaeDayRange(value: DateInput = new Date()) {
  const key = dayKey(value) || dayKey(new Date());
  const [y, m, d] = key.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d) - 4 * 3600000);
  const end = new Date(start.getTime() + 86400000 - 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** "2026-10-06" + "10:30" entered in a form, read as UAE time → ISO timestamp. */
export function uaeInputToISO(date: string, time: string) {
  const hhmm = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${hhmm}+04:00`).toISOString();
}

/** Values for <input type="date"> / <input type="time"> in UAE time. */
export function uaeInputValues(value: DateInput) {
  const d = toDate(value);
  if (!d) return { date: "", time: "" };
  return {
    date: dayKey(d),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }),
  };
}

/** "AED 6,500.00" — the one money format used across the app. */
export function formatAed(amount: number, digits = 2) {
  const n = Number.isFinite(amount) ? amount : 0;
  const sign = n < 0 ? "−" : "";
  return `${sign}AED ${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

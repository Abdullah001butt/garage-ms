import { dayKey } from "@/lib/format";

export type RangePreset = "today" | "week" | "month" | "last-month" | "quarter" | "year" | "custom";

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "This year" },
];

export type ResolvedRange = {
  preset: RangePreset;
  from: string; // YYYY-MM-DD (UAE calendar day)
  to: string;
  prevFrom: string;
  prevTo: string;
  label: string;
  compareLabel: string;
  days: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toDate(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function toKey(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function addDays(key: string, n: number) {
  const d = toDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return toKey(d);
}
export function daysBetween(a: string, b: string) {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000) + 1;
}
function monthStart(key: string, offset = 0) {
  const d = toDate(key);
  return toKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1)));
}
function monthEnd(key: string, offset = 0) {
  const d = toDate(key);
  return toKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset + 1, 0)));
}
/** Same number of days from an earlier start, but never past that period's end. */
function clampAdd(start: string, length: number, end: string) {
  const candidate = addDays(start, length - 1);
  return candidate > end ? end : candidate;
}
export function shortDate(key: string) {
  const d = toDate(key);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
export function spanLabel(from: string, to: string) {
  if (from === to) return shortDate(from);
  const a = toDate(from);
  const b = toDate(to);
  if (a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
  }
  return `${shortDate(from)} – ${shortDate(to)}${a.getUTCFullYear() !== b.getUTCFullYear() ? ` ${b.getUTCFullYear()}` : ""}`;
}

const isKey = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function resolveRange(params: { range?: string; from?: string; to?: string }, fallback: RangePreset = "month"): ResolvedRange {
  const today = dayKey(new Date());
  const known = RANGE_PRESETS.some((p) => p.value === params.range) || params.range === "custom";
  let preset = (known ? params.range : fallback) as RangePreset;
  if (preset === "custom" && !(isKey(params.from) && isKey(params.to))) preset = fallback;

  let from = today;
  let to = today;
  let prevFrom: string;
  let prevTo: string;
  let compareLabel: string;

  switch (preset) {
    case "today":
      prevFrom = prevTo = addDays(today, -1);
      compareLabel = "vs yesterday";
      break;
    case "week": {
      const dow = (toDate(today).getUTCDay() + 6) % 7; // Monday = 0
      from = addDays(today, -dow);
      prevFrom = addDays(from, -7);
      prevTo = addDays(today, -7);
      compareLabel = "vs last week";
      break;
    }
    case "last-month":
      from = monthStart(today, -1);
      to = monthEnd(today, -1);
      prevFrom = monthStart(today, -2);
      prevTo = monthEnd(today, -2);
      compareLabel = `vs ${MONTHS[toDate(prevFrom).getUTCMonth()]}`;
      break;
    case "quarter": {
      const d = toDate(today);
      const qStartMonth = Math.floor(d.getUTCMonth() / 3) * 3;
      from = toKey(new Date(Date.UTC(d.getUTCFullYear(), qStartMonth, 1)));
      prevFrom = toKey(new Date(Date.UTC(d.getUTCFullYear(), qStartMonth - 3, 1)));
      prevTo = clampAdd(prevFrom, daysBetween(from, to), addDays(from, -1));
      compareLabel = "vs last quarter";
      break;
    }
    case "year": {
      const y = toDate(today).getUTCFullYear();
      from = `${y}-01-01`;
      prevFrom = `${y - 1}-01-01`;
      prevTo = clampAdd(prevFrom, daysBetween(from, to), `${y - 1}-12-31`);
      compareLabel = `vs ${y - 1}`;
      break;
    }
    case "custom": {
      const a = params.from!;
      const b = params.to!;
      from = a <= b ? a : b;
      to = a <= b ? b : a;
      const len = daysBetween(from, to);
      prevTo = addDays(from, -1);
      prevFrom = addDays(from, -len);
      compareLabel = "vs previous period";
      break;
    }
    default: {
      from = monthStart(today);
      prevFrom = monthStart(today, -1);
      prevTo = clampAdd(prevFrom, daysBetween(from, to), monthEnd(today, -1));
      compareLabel = `vs ${spanLabel(prevFrom, prevTo)}`;
    }
  }

  const presetLabel = RANGE_PRESETS.find((p) => p.value === preset)?.label;
  return {
    preset,
    from,
    to,
    prevFrom,
    prevTo,
    label: preset === "custom" ? spanLabel(from, to) : `${presetLabel} · ${spanLabel(from, to)}`,
    compareLabel,
    days: daysBetween(from, to),
  };
}

/** UTC-safe ISO bounds for a span of UAE calendar days (UTC+4), for timestamp columns. */
export function isoBounds(from: string, to: string) {
  return { start: `${from}T00:00:00+04:00`, end: `${to}T23:59:59.999+04:00` };
}

/** Is a timestamp or YYYY-MM-DD date inside [from, to] in UAE days? */
export function inRange(value: string | null | undefined, from: string, to: string) {
  if (!value) return false;
  const key = value.length === 10 ? value : dayKey(value);
  return key >= from && key <= to;
}

/** Sparkline buckets: daily up to ~45 days, otherwise weekly. */
export function buckets(from: string, to: string) {
  const step = daysBetween(from, to) > 45 ? 7 : 1;
  const out: { from: string; to: string }[] = [];
  for (let start = from; start <= to; start = addDays(start, step)) {
    const end = addDays(start, step - 1);
    out.push({ from: start, to: end > to ? to : end });
  }
  return out;
}

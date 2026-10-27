import { monthShort, parseKey, type DateKey } from "@studio/dates";

/** "1 day", "12 days". */
export function daysText(count: number): string {
  return `${count} ${count === 1 ? "day" : "days"}`;
}

/** "12 Oct", "28 Sep – 3 Oct", "30 Dec 2025 – 2 Jan 2026" (years only when they differ). */
export function rangeText(from: DateKey, to: DateKey): string {
  const a = parseKey(from);
  const b = parseKey(to);
  const day = (p: { day: number; month: number }) =>
    `${p.day} ${monthShort(p.month)}`;
  if (from === to) return day(a);
  if (a.year !== b.year) return `${day(a)} ${a.year} – ${day(b)} ${b.year}`;
  if (a.month === b.month) return `${a.day}–${b.day} ${monthShort(a.month)}`;
  return `${day(a)} – ${day(b)}`;
}

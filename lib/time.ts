import { DateTime, IANAZone } from "luxon";

export type LiveStatus = "happening" | "soon" | "upcoming" | "past";

export function resolveZone(requested: string): string {
  return IANAZone.isValidZone(requested) ? requested : "Asia/Seoul";
}

export function parseDayLabel(
  label: string,
  zone: string,
): { date: string; label: string; shortLabel: string } | null {
  const cleaned = label.trim();
  if (!cleaned) return null;
  const parsed = DateTime.fromFormat(cleaned, "cccc, LLLL d, yyyy", {
    zone,
    locale: "en-US",
  });
  if (!parsed.isValid) return null;
  return {
    date: parsed.toISODate() ?? "",
    label: cleaned,
    shortLabel: parsed.setLocale("en-US").toFormat("ccc d LLL"),
  };
}

export function parseClockRange(value: string): { start: string; end: string } | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*[-–—]\s*(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const start = `${match[1].padStart(2, "0")}:${match[2]}`;
  const end = `${match[3].padStart(2, "0")}:${match[4]}`;
  return { start, end };
}

export function toRangeIso(
  date: string,
  start: string,
  end: string,
  zone: string,
): { startIso: string; endIso: string } | null {
  if (!date || !start || !end) return null;
  let startDt = DateTime.fromISO(`${date}T${start}:00`, { zone });
  let endDt = DateTime.fromISO(`${date}T${end}:00`, { zone });
  if (!startDt.isValid || !endDt.isValid) return null;
  if (endDt <= startDt) endDt = endDt.plus({ days: 1 });
  return { startIso: startDt.toISO() ?? "", endIso: endDt.toISO() ?? "" };
}

export function minutesOf(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

export function liveStatus(startIso: string, endIso: string, nowIso: string): LiveStatus {
  if (!startIso || !endIso || !nowIso) return "upcoming";
  const now = DateTime.fromISO(nowIso);
  const start = DateTime.fromISO(startIso);
  const end = DateTime.fromISO(endIso);
  if (!now.isValid || !start.isValid || !end.isValid) return "upcoming";
  if (now >= start && now < end) return "happening";
  if (now < start && start.diff(now).as("minutes") <= 15) return "soon";
  if (now >= end) return "past";
  return "upcoming";
}

export function formatUpdated(iso: string, zone: string): string {
  const parsed = DateTime.fromISO(iso).setZone(zone);
  if (!parsed.isValid) return "";
  return parsed.setLocale("en-US").toFormat("d LLL yyyy, HH:mm");
}

export function formatClock(iso: string, zone: string): string {
  const parsed = DateTime.fromISO(iso).setZone(zone);
  if (!parsed.isValid) return "";
  return parsed.setLocale("en-US").toFormat("cccc, d LLLL yyyy, HH:mm");
}

export function timeRangeLabel(start: string, end: string): string {
  if (!start || !end) return "";
  return `${start}–${end}`;
}

import { DateTime } from "luxon";
import type { AgendaEntry } from "./agenda";
import { personLine } from "./people";
import { timeRangeLabel } from "./time";

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  startIso: string;
  endIso: string;
  timezone: string;
};

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function eventFromEntry(entry: AgendaEntry, origin: string, timezone: string): CalendarEvent | null {
  if (entry.missing || !entry.startIso || !entry.endIso) return null;
  const link = entry.session ? `${origin}/session/${encodeURIComponent(entry.session.number)}` : origin;
  const lines = [
    entry.dateLabel,
    `${timeRangeLabel(entry.start, entry.end)} (${timezone})`,
    entry.location,
  ];
  if (entry.kind === "session" && entry.session) {
    if (entry.session.type) lines.push(entry.session.type);
    if (entry.session.track) lines.push(entry.session.track);
    if (entry.session.cme) lines.push(entry.session.cme);
    if (entry.session.chairs.length) {
      lines.push(`Chairs: ${entry.session.chairs.map((person) => personLine(person)).join("; ")}`);
    }
  }
  if (entry.kind === "presentation" && entry.presentation && entry.session) {
    lines.push(`Session ${entry.session.number}: ${entry.session.title}`);
    lines.push(`Session time ${timeRangeLabel(entry.session.start, entry.session.end)}`);
    if (entry.presentation.participants.length) {
      lines.push(
        entry.presentation.participants
          .map((person) => `${person.role}: ${personLine(person)}`)
          .join("; "),
      );
    }
  }
  lines.push(`Online program: ${link}`);
  lines.push("This calendar event will not update automatically if the program changes.");
  const number = entry.number ? `${entry.number}: ` : "";
  return {
    id: entry.id,
    title: clean(`${number}${entry.title}`),
    description: lines.filter(Boolean).join("\n"),
    location: entry.location,
    startIso: entry.startIso,
    endIso: entry.endIso,
    timezone,
  };
}

export function googleCalendarUrl(event: CalendarEvent): string {
  const start = DateTime.fromISO(event.startIso).setZone(event.timezone);
  const end = DateTime.fromISO(event.endIso).setZone(event.timezone);
  const dates = `${start.toFormat("yyyyMMdd'T'HHmmss")}/${end.toFormat("yyyyMMdd'T'HHmmss")}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates,
    ctz: event.timezone,
    details: event.description,
    location: event.location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookCalendarUrl(event: CalendarEvent): string {
  const start = DateTime.fromISO(event.startIso).setZone(event.timezone);
  const end = DateTime.fromISO(event.endIso).setZone(event.timezone);
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: start.toFormat("yyyy-MM-dd'T'HH:mm:ssZZ"),
    enddt: end.toFormat("yyyy-MM-dd'T'HH:mm:ssZZ"),
    body: event.description,
    location: event.location,
  });
  return `https://outlook.office.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function icsEscape(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\n|\r/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function fold(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 73 && current) {
      parts.push(current);
      current = ` ${char}`;
      bytes = 1 + size;
    } else {
      current += char;
      bytes += size;
    }
  }
  if (current) parts.push(current);
  return parts.join("\r\n");
}

function timezoneBlock(zone: string, sampleIso: string): string {
  const sample = DateTime.fromISO(sampleIso).setZone(zone);
  const offset = sample.toFormat("ZZ").replace(":", "");
  const block = sample.isInDST ? "DAYLIGHT" : "STANDARD";
  const name = sample.offsetNameShort || zone;
  return [
    "BEGIN:VTIMEZONE",
    `TZID:${zone}`,
    `X-LIC-LOCATION:${zone}`,
    `BEGIN:${block}`,
    "DTSTART:19700101T000000",
    `TZOFFSETFROM:${offset}`,
    `TZOFFSETTO:${offset}`,
    `TZNAME:${name}`,
    `END:${block}`,
    "END:VTIMEZONE",
  ].join("\r\n");
}

export function buildIcs(events: CalendarEvent[], calendarName: string): string {
  const usable = events.filter((event) => event.startIso && event.endIso);
  const stamp = DateTime.utc().toFormat("yyyyMMdd'T'HHmmss'Z'");
  const zone = usable[0]?.timezone || "UTC";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//IASLC//WCLC Conference Program//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
    `X-WR-TIMEZONE:${zone}`,
  ];
  if (usable[0]) lines.push(timezoneBlock(zone, usable[0].startIso));
  for (const event of usable) {
    const start = DateTime.fromISO(event.startIso).setZone(event.timezone);
    const end = DateTime.fromISO(event.endIso).setZone(event.timezone);
    const uid = `wclc-${event.id.replace(/[^A-Za-z0-9]+/g, "-")}@conference-program`;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;TZID=${event.timezone}:${start.toFormat("yyyyMMdd'T'HHmmss")}`);
    lines.push(`DTEND;TZID=${event.timezone}:${end.toFormat("yyyyMMdd'T'HHmmss")}`);
    lines.push(`SUMMARY:${icsEscape(event.title)}`);
    lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
    if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

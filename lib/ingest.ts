import Papa from "papaparse";
import { conferenceConfig, timezoneLabel } from "./config";
import { anchorId } from "./anchors";
import { dedupePeople, kindLabel, roleBucket } from "./people";
import { assertNoEmails, stripEmails } from "./privacy";
import { parseClockRange, parseDayLabel, resolveZone, toRangeIso } from "./time";
import type {
  AbstractContent,
  Person,
  Presentation,
  ProgramData,
  ProgramDay,
  RoleBucket,
  Session,
} from "./types";

const ALLOWED = new Set([
  "Abstract.PresentationRoleStatus",
  "Abstract.ControlNumber",
  "Abstract.ProgramStatus",
  "Abstract.ActivityName",
  "Abstract.Title",
  "PrimaryAuthor.FirstName",
  "PrimaryAuthor.LastName",
  "PrimaryAuthor.FirstInstitutionCountry",
  "Account.Country",
  "PrimaryAuthor.FirstInstitutionName",
  "PrimaryAuthor.ContactCountry",
  "Abstract.PresentationNumber",
  "Session.Number",
  "Session.Type",
  "SessionExtraData.CMEInfo",
  "SessionExtraData.SessionTracks",
  "Session.Title",
  "Session.Location",
  "Abstract.PresentationDateRangeEUNumeric",
  "Abstract.PresentationDateRangeUSDayOnly",
  "Abstract.PresentationDateRangeEUTimeOnly",
  "Session.DateRangeUSDayOnly",
  "Session.DateRangeEUTimeOnly",
  "Abstract.AbstractText",
  "Abstract.Abstract",
  "Abstract.Body",
  "Abstract.Background",
  "Abstract.Methods",
  "Abstract.Results",
  "Abstract.Conclusions",
  "Abstract.Url",
  "Abstract.URL",
]);

type Draft = {
  order: number;
  activity: string;
  title: string;
  first: string;
  last: string;
  institution: string;
  country: string;
  presentationNumber: string;
  controlNumber: string;
  sessionNumber: string;
  sessionType: string;
  cme: string;
  track: string;
  sessionTitle: string;
  location: string;
  presentationDayLabel: string;
  presentationTime: string;
  sessionDayLabel: string;
  sessionTime: string;
  abstract: AbstractContent | null;
};

const ROLE_ORDER: RoleBucket[] = ["Chair", "Moderator", "Speaker", "Discussant", "Q&A"];

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\b(moderator|presentation|presenter)\s*:\s*/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameTalk(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (left === right) return true;
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  if (shorter.length < 12) return false;
  return longer.startsWith(`${shorter} `);
}

function chooseTitle(titles: string[], fallback: string): string {
  const unique = [...new Set(titles.map((title) => title.trim()).filter(Boolean))];
  const rich = unique.filter((title) => !/^(chair|co-chair|session chair|session moderator|speaker)$/i.test(title));
  const pool = (rich.length ? rich : unique).sort((a, b) => b.length - a.length);
  return pool[0] || fallback || "Program item";
}

function safeUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed;
}

function abstractFrom(row: Record<string, string>, title: string, number: string): AbstractContent | null {
  const body = [row["Abstract.AbstractText"], row["Abstract.Abstract"], row["Abstract.Body"]]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("\n\n");
  const sections = (
    [
      ["Background", row["Abstract.Background"]],
      ["Methods", row["Abstract.Methods"]],
      ["Results", row["Abstract.Results"]],
      ["Conclusions", row["Abstract.Conclusions"]],
    ] as const
  )
    .map(([heading, text]) => ({ heading, text: (text ?? "").trim() }))
    .filter((section) => section.text);
  const url = safeUrl(row["Abstract.Url"] || row["Abstract.URL"] || "");
  if (!body && sections.length === 0 && !url) return null;
  return {
    number,
    title,
    authors: [],
    body: body || null,
    sections,
    url,
  };
}

function allowedRows(csv: string): Record<string, string>[] {
  const parsed = Papa.parse<Record<string, string>>(csv.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: "greedy",
  });
  if (parsed.data.length === 0) {
    throw new Error("csv_parse_failed");
  }
  return parsed.data.map((row) => {
    const allowed: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const name = key.trim();
      if (!ALLOWED.has(name)) continue;
      if (/email|e-mail|phone|mobile|fax/i.test(name)) continue;
      allowed[name] = stripEmails(String(value ?? "").trim());
    }
    return allowed;
  });
}

function toDraft(row: Record<string, string>, order: number): Draft | null {
  const status = row["Abstract.ProgramStatus"] ?? "";
  if (/withdrawn|rejected|cancelled|canceled|declined/i.test(status)) return null;
  const sessionNumber = row["Session.Number"] ?? "";
  if (!sessionNumber) return null;
  const title = row["Abstract.Title"] ?? "";
  const presentationNumber = row["Abstract.PresentationNumber"] ?? "";
  return {
    order,
    activity: row["Abstract.ActivityName"] ?? "",
    title,
    first: row["PrimaryAuthor.FirstName"] ?? "",
    last: row["PrimaryAuthor.LastName"] ?? "",
    institution: row["PrimaryAuthor.FirstInstitutionName"] ?? "",
    country:
      row["PrimaryAuthor.FirstInstitutionCountry"] ||
      row["PrimaryAuthor.ContactCountry"] ||
      row["Account.Country"] ||
      "",
    presentationNumber,
    controlNumber: row["Abstract.ControlNumber"] ?? "",
    sessionNumber,
    sessionType: row["Session.Type"] ?? "",
    cme: row["SessionExtraData.CMEInfo"] ?? "",
    track: row["SessionExtraData.SessionTracks"] ?? "",
    sessionTitle: row["Session.Title"] ?? "",
    location: row["Session.Location"] ?? "",
    presentationDayLabel: row["Abstract.PresentationDateRangeUSDayOnly"] ?? "",
    presentationTime: row["Abstract.PresentationDateRangeEUTimeOnly"] ?? "",
    sessionDayLabel: row["Session.DateRangeUSDayOnly"] ?? "",
    sessionTime: row["Session.DateRangeEUTimeOnly"] ?? "",
    abstract: abstractFrom(row, title, presentationNumber),
  };
}

function personFrom(row: Draft): Person | null {
  const name = [row.first, row.last].filter(Boolean).join(" ").trim();
  if (!name) return null;
  return {
    name,
    affiliation: row.institution,
    country: row.country,
    role: row.activity || "Participant",
    roleBucket: roleBucket(row.activity),
  };
}

function clusterRows(rows: Draft[]): Draft[][] {
  const groups: Draft[][] = [];
  const byKey = new Map<string, Draft[]>();
  const unnumbered: Draft[] = [];

  const take = (key: string, row: Draft) => {
    const existing = byKey.get(key);
    if (existing) {
      existing.push(row);
      return;
    }
    const created = [row];
    byKey.set(key, created);
    groups.push(created);
  };

  for (const row of rows) {
    if (row.activity.trim().toLowerCase() === "chair") {
      take(`chair|${row.presentationTime}`, row);
      continue;
    }
    if (row.presentationNumber) {
      take(`pn|${row.presentationNumber}`, row);
      continue;
    }
    unnumbered.push(row);
  }

  const clusters: Draft[][] = [];
  for (const row of unnumbered) {
    const title = normalizeTitle(row.title);
    const match = clusters.find(
      (cluster) =>
        cluster[0].presentationTime === row.presentationTime &&
        sameTalk(title, normalizeTitle(cluster[0].title)),
    );
    if (match) match.push(row);
    else clusters.push([row]);
  }
  return [...groups, ...clusters];
}

function timed(dayLabel: string, timeLabel: string, zone: string) {
  const day = parseDayLabel(dayLabel, zone);
  const clock = parseClockRange(timeLabel);
  if (!day || !clock) return null;
  const range = toRangeIso(day.date, clock.start, clock.end, zone);
  if (!range) return null;
  return { ...day, ...clock, ...range };
}

function buildPresentation(sessionId: string, sessionNumber: string, rows: Draft[], zone: string): Presentation | null {
  const sample = rows[0];
  const when =
    timed(sample.presentationDayLabel, sample.presentationTime, zone) ||
    timed(sample.sessionDayLabel, sample.presentationTime, zone);
  const participants = dedupePeople(rows.map(personFrom).filter((person): person is Person => Boolean(person)));
  const title = chooseTitle(
    rows.map((row) => row.title),
    sample.activity,
  );
  const number = rows.map((row) => row.presentationNumber).find(Boolean) ?? "";
  const controls = rows.map((row) => row.controlNumber).filter(Boolean).sort();
  const id = number ? `p:${number}` : `p:${sessionNumber}:${controls[0] || sample.order}`;
  const abstract = rows.map((row) => row.abstract).find((item) => item && (item.body || item.sections.length || item.url)) ?? null;
  if (abstract) {
    abstract.number = number || abstract.number;
    abstract.title = abstract.title || title;
    abstract.authors = participants.map((person) => ({
      name: person.name,
      affiliation: person.affiliation,
      country: person.country,
    }));
  }
  return {
    id,
    number,
    title,
    activity: sample.activity,
    kindLabel: kindLabel(sample.activity, title),
    date: when?.date ?? "",
    dateLabel: when?.label ?? (sample.presentationDayLabel || sample.sessionDayLabel),
    start: when?.start ?? "",
    end: when?.end ?? "",
    startIso: when?.startIso ?? "",
    endIso: when?.endIso ?? "",
    participants,
    abstract,
    sessionId,
  };
}

function uniquePeople(people: Person[]): Person[] {
  return dedupePeople(people);
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "en"),
  );
}

export function canViewAbstract(presentation: { abstract: AbstractContent | null }): boolean {
  const abstract = presentation.abstract;
  if (!abstract) return false;
  if (abstract.body?.trim()) return true;
  if (abstract.sections.some((section) => section.text.trim())) return true;
  return Boolean(abstract.url && /^https?:\/\//i.test(abstract.url));
}

export function mergeAbstracts(
  program: ProgramData,
  abstracts: Record<string, AbstractContent>,
): ProgramData {
  const sessions = program.sessions.map((session) => ({
    ...session,
    presentations: session.presentations.map((presentation) => {
      const incoming = abstracts[presentation.number] || abstracts[presentation.id];
      if (!incoming) return presentation;
      const abstract: AbstractContent = {
        number: stripEmails(incoming.number || presentation.number),
        title: stripEmails(incoming.title || presentation.title),
        authors: (incoming.authors ?? []).map((author) => ({
          name: stripEmails(author.name ?? ""),
          affiliation: stripEmails(author.affiliation ?? ""),
          country: stripEmails(author.country ?? ""),
        })),
        body: incoming.body ? stripEmails(incoming.body) : null,
        sections: (incoming.sections ?? []).map((section) => ({
          heading: stripEmails(section.heading ?? ""),
          text: stripEmails(section.text ?? ""),
        })),
        url: safeUrl(stripEmails(incoming.url ?? "")),
      };
      return { ...presentation, abstract };
    }),
  }));
  const next: ProgramData = {
    ...program,
    sessions,
    meta: {
      ...program.meta,
      hasAbstracts: sessions.some((session) => session.presentations.some((item) => canViewAbstract(item))),
    },
  };
  assertNoEmails(next);
  return next;
}

export function buildProgram(
  csv: string,
  options?: { timezone?: string; updatedAt?: string; source?: "live" | "cache"; refreshIntervalMs?: number },
): ProgramData {
  const zone = resolveZone(options?.timezone || conferenceConfig.timezone);
  const drafts = allowedRows(csv)
    .map((row, index) => toDraft(row, index))
    .filter((row): row is Draft => Boolean(row));

  const grouped = new Map<string, Draft[]>();
  for (const draft of drafts) {
    const list = grouped.get(draft.sessionNumber);
    if (list) list.push(draft);
    else grouped.set(draft.sessionNumber, [draft]);
  }

  const sessions: Session[] = [];
  for (const [sessionNumber, rows] of grouped) {
    const head = rows[0];
    const sessionId = `s:${sessionNumber}`;
    const sessionWhen = timed(head.sessionDayLabel, head.sessionTime, zone);
    const presentations = clusterRows(rows)
      .map((cluster) => buildPresentation(sessionId, sessionNumber, cluster, zone))
      .filter((item): item is Presentation => Boolean(item))
      .sort((a, b) => {
        const left = a.startIso || "9999";
        const right = b.startIso || "9999";
        if (left !== right) return left.localeCompare(right);
        return a.id.localeCompare(b.id);
      });

    const people = rows.map(personFrom).filter((person): person is Person => Boolean(person));
    const chairs = uniquePeople(people.filter((person) => person.roleBucket === "Chair"));
    const moderators = uniquePeople(people.filter((person) => person.roleBucket === "Moderator"));
    const date = sessionWhen?.date || presentations.find((item) => item.date)?.date || "";
    const dateLabel = sessionWhen?.label || presentations.find((item) => item.dateLabel)?.dateLabel || head.sessionDayLabel;
    const start = sessionWhen?.start || presentations.find((item) => item.start)?.start || "";
    const end = sessionWhen?.end || [...presentations].reverse().find((item) => item.end)?.end || "";
    const range = sessionWhen || (date && start && end ? toRangeIso(date, start, end, zone) : null);

    sessions.push({
      id: sessionId,
      number: sessionNumber,
      title: head.sessionTitle,
      type: head.sessionType,
      track: head.track,
      location: head.location,
      cme: head.cme,
      date,
      dateLabel,
      start,
      end,
      startIso: sessionWhen?.startIso || (range && "startIso" in range ? range.startIso : "") || "",
      endIso: sessionWhen?.endIso || (range && "endIso" in range ? range.endIso : "") || "",
      chairs,
      moderators,
      presentations,
    });
  }

  sessions.sort((a, b) => {
    const left = a.startIso || "9999";
    const right = b.startIso || "9999";
    if (left !== right) return left.localeCompare(right);
    return a.number.localeCompare(b.number, "en", { numeric: true });
  });

  const dayMap = new Map<string, ProgramDay>();
  for (const session of sessions) {
    if (!session.date || dayMap.has(session.date)) continue;
    const parsed = parseDayLabel(session.dateLabel, zone);
    dayMap.set(session.date, {
      id: session.date,
      label: session.dateLabel,
      shortLabel: parsed?.shortLabel || session.dateLabel,
    });
  }
  const days = [...dayMap.values()];
  const starts = sessions.map((session) => session.startIso).filter(Boolean).sort();
  const ends = sessions.map((session) => session.endIso).filter(Boolean).sort();
  const roleSet = new Set<RoleBucket>();
  for (const session of sessions) {
    for (const person of [...session.chairs, ...session.moderators]) roleSet.add(person.roleBucket);
    for (const presentation of session.presentations) {
      for (const person of presentation.participants) roleSet.add(person.roleBucket);
    }
  }

  const program: ProgramData = {
    meta: {
      schemaVersion: 1,
      updatedAt: options?.updatedAt || new Date().toISOString(),
      timezone: zone,
      timezoneLabel: timezoneLabel(zone),
      source: options?.source || "live",
      stale: false,
      warning: null,
      refreshIntervalMs: options?.refreshIntervalMs || conferenceConfig.refreshMs,
      sessionCount: sessions.length,
      presentationCount: sessions.reduce((sum, session) => sum + session.presentations.length, 0),
      hasAbstracts: sessions.some((session) => session.presentations.some((item) => canViewAbstract(item))),
      dateRangeLabel:
        days.length === 0
          ? ""
          : days.length === 1
            ? days[0].label
            : `${days[0].label} – ${days[days.length - 1].label}`,
      firstStart: starts[0] ?? null,
      lastEnd: ends[ends.length - 1] ?? null,
    },
    days,
    filters: {
      types: sortedUnique(sessions.map((session) => session.type)),
      tracks: sortedUnique(sessions.map((session) => session.track)),
      locations: sortedUnique(sessions.map((session) => session.location)),
      roles: ROLE_ORDER.filter((role) => roleSet.has(role)),
      cme: sortedUnique(sessions.map((session) => session.cme)),
    },
    sessions,
  };

  assertNoEmails(program);
  return program;
}

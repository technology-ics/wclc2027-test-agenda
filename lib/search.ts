import { anchorId } from "./anchors";
import { liveStatus, timeRangeLabel } from "./time";
import type { FilterState, ProgramData, RoleBucket, SearchHit, Session } from "./types";

function termsOf(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function includesTerm(haystack: string, term: string): boolean {
  return haystack.toLowerCase().includes(term);
}

function numberMatches(number: string, term: string): boolean {
  if (!number || !term) return false;
  const left = number.toLowerCase();
  const right = term.toLowerCase();
  if (right.includes(".")) return left.includes(right);
  return left === right;
}

function blob(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function searchProgram(program: ProgramData, query: string): SearchHit[] {
  const terms = termsOf(query);
  if (terms.length === 0) return [];
  const hits: SearchHit[] = [];

  for (const session of program.sessions) {
    const sessionText = blob([
      session.title,
      session.type,
      session.track,
      session.location,
      session.cme,
      session.dateLabel,
      ...session.chairs.flatMap((person) => [person.name, person.affiliation, person.country, person.role]),
      ...session.moderators.flatMap((person) => [person.name, person.affiliation, person.country, person.role]),
    ]);
    const sessionPeople = [...session.chairs, ...session.moderators];
    const sessionMatch = terms.every(
      (term) => includesTerm(sessionText, term) || numberMatches(session.number, term),
    );
    if (sessionMatch) {
      const matchedPeople = sessionPeople
        .filter((person) => terms.some((term) => person.name.toLowerCase().includes(term)))
        .map((person) => ({ name: person.name, role: person.role }));
      hits.push({
        kind: "session",
        id: session.id,
        sessionId: session.id,
        sessionNumber: session.number,
        number: session.number,
        title: session.title,
        parentTitle: "",
        parentTime: "",
        date: session.date,
        dateLabel: session.dateLabel,
        timeLabel: timeRangeLabel(session.start, session.end),
        location: session.location,
        type: session.type,
        track: session.track,
        cme: session.cme,
        startIso: session.startIso,
        endIso: session.endIso,
        matchedPeople,
        roleBuckets: [...new Set(sessionPeople.map((person) => person.roleBucket))],
        anchor: "",
      });
    }

    for (const presentation of session.presentations) {
      const presentationText = blob([
        presentation.title,
        presentation.activity,
        presentation.kindLabel,
        presentation.abstract?.title,
        presentation.abstract?.body,
        presentation.abstract?.number,
        ...presentation.abstract?.sections.flatMap((section) => [section.heading, section.text]) ?? [],
        ...presentation.participants.flatMap((person) => [person.name, person.affiliation, person.country, person.role]),
      ]);
      const presentationMatch = terms.every(
        (term) => includesTerm(presentationText, term) || numberMatches(presentation.number, term),
      );
      if (!presentationMatch) continue;
      const matchedPeople = presentation.participants
        .filter((person) => terms.some((term) => person.name.toLowerCase().includes(term)))
        .map((person) => ({ name: person.name, role: person.role }));
      hits.push({
        kind: "presentation",
        id: presentation.id,
        sessionId: session.id,
        sessionNumber: session.number,
        number: presentation.number,
        title: presentation.title,
        parentTitle: session.title,
        parentTime: timeRangeLabel(session.start, session.end),
        date: presentation.date || session.date,
        dateLabel: presentation.dateLabel || session.dateLabel,
        timeLabel: timeRangeLabel(presentation.start, presentation.end),
        location: session.location,
        type: session.type,
        track: session.track,
        cme: session.cme,
        startIso: presentation.startIso,
        endIso: presentation.endIso,
        matchedPeople,
        roleBuckets: [...new Set(presentation.participants.map((person) => person.roleBucket))],
        anchor: anchorId(presentation.id),
      });
    }
  }

  return hits.sort((a, b) => {
    const byTime = (a.startIso || "9999").localeCompare(b.startIso || "9999");
    if (byTime !== 0) return byTime;
    const bySession = a.sessionNumber.localeCompare(b.sessionNumber, "en", { numeric: true });
    if (bySession !== 0) return bySession;
    if (a.kind !== b.kind) return a.kind === "session" ? -1 : 1;
    return a.number.localeCompare(b.number, "en", { numeric: true });
  });
}

function includesSelected(selected: string[], value: string): boolean {
  if (selected.length === 0) return true;
  return selected.includes(value);
}

export function sessionMatchesFilters(
  session: Session,
  filters: FilterState,
  options: { bookmarked: boolean; nowIso: string; browseDayId: string | null },
): boolean {
  if (options.browseDayId && session.date !== options.browseDayId) return false;
  if (filters.dayId && session.date !== filters.dayId) return false;
  if (!includesSelected(filters.types, session.type)) return false;
  if (!includesSelected(filters.tracks, session.track)) return false;
  if (!includesSelected(filters.locations, session.location)) return false;
  if (!includesSelected(filters.cme, session.cme)) return false;
  if (filters.roles.length > 0) {
    const buckets = new Set<RoleBucket>([
      ...session.chairs.map((person) => person.roleBucket),
      ...session.moderators.map((person) => person.roleBucket),
      ...session.presentations.flatMap((presentation) => presentation.participants.map((person) => person.roleBucket)),
    ]);
    if (!filters.roles.some((role) => buckets.has(role))) return false;
  }
  if (filters.bookmarkedOnly && !options.bookmarked) return false;
  if (filters.happeningOnly && liveStatus(session.startIso, session.endIso, options.nowIso) !== "happening") {
    return false;
  }
  return true;
}

export function hitMatchesFilters(
  hit: SearchHit,
  filters: FilterState,
  options: { bookmarked: boolean; nowIso: string },
): boolean {
  if (filters.dayId && hit.date !== filters.dayId) return false;
  if (!includesSelected(filters.types, hit.type)) return false;
  if (!includesSelected(filters.tracks, hit.track)) return false;
  if (!includesSelected(filters.locations, hit.location)) return false;
  if (!includesSelected(filters.cme, hit.cme)) return false;
  if (filters.roles.length > 0 && !filters.roles.some((role) => hit.roleBuckets.includes(role))) return false;
  if (filters.bookmarkedOnly && !options.bookmarked) return false;
  if (filters.happeningOnly && liveStatus(hit.startIso, hit.endIso, options.nowIso) !== "happening") {
    return false;
  }
  return true;
}

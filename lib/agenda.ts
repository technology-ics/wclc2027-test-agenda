import { findPresentation, findSession } from "./find";
import type { BookmarkItem, Presentation, ProgramData, Session } from "./types";

export type AgendaEntry = {
  key: string;
  kind: "session" | "presentation";
  id: string;
  session: Session | null;
  presentation: Presentation | null;
  missing: boolean;
  changed: boolean;
  conflict: boolean;
  date: string;
  dateLabel: string;
  start: string;
  end: string;
  startIso: string;
  endIso: string;
  title: string;
  location: string;
  number: string;
  savedTitle: string;
};

function overlaps(left: AgendaEntry, right: AgendaEntry): boolean {
  if (!left.startIso || !right.startIso || !left.endIso || !right.endIso) return false;
  return left.startIso < right.endIso && right.startIso < left.endIso;
}

function sameCommitment(left: AgendaEntry, right: AgendaEntry): boolean {
  if (!left.session || !right.session) return false;
  if (left.kind === "session" && right.kind === "presentation" && right.session.id === left.session.id) return true;
  if (right.kind === "session" && left.kind === "presentation" && left.session.id === right.session.id) return true;
  return false;
}

export function buildAgenda(program: ProgramData | null, items: BookmarkItem[]): AgendaEntry[] {
  const entries: AgendaEntry[] = items.map((item) => {
    if (item.kind === "session") {
      const session = program ? findSession(program, item.id) : undefined;
      if (!session) {
        return {
          key: item.id,
          kind: item.kind,
          id: item.id,
          session: null,
          presentation: null,
          missing: true,
          changed: false,
          conflict: false,
          date: "",
          dateLabel: "",
          start: "",
          end: "",
          startIso: "",
          endIso: "",
          title: item.savedTitle || "Saved session",
          location: "",
          number: "",
          savedTitle: item.savedTitle,
        };
      }
      return {
        key: session.id,
        kind: "session",
        id: session.id,
        session,
        presentation: null,
        missing: false,
        changed: Boolean(
          (item.savedTitle && item.savedTitle !== session.title) ||
            (item.savedStart && item.savedStart !== session.startIso),
        ),
        conflict: false,
        date: session.date,
        dateLabel: session.dateLabel,
        start: session.start,
        end: session.end,
        startIso: session.startIso,
        endIso: session.endIso,
        title: session.title,
        location: session.location,
        number: session.number,
        savedTitle: item.savedTitle,
      };
    }

    const found = program ? findPresentation(program, item.id) : undefined;
    if (!found) {
      return {
        key: item.id,
        kind: "presentation",
        id: item.id,
        session: null,
        presentation: null,
        missing: true,
        changed: false,
        conflict: false,
        date: "",
        dateLabel: "",
        start: "",
        end: "",
        startIso: "",
        endIso: "",
        title: item.savedTitle || "Saved presentation",
        location: "",
        number: "",
        savedTitle: item.savedTitle,
      };
    }
    const { session, presentation } = found;
    return {
      key: presentation.id,
      kind: "presentation",
      id: presentation.id,
      session,
      presentation,
      missing: false,
      changed: Boolean(
        (item.savedTitle && item.savedTitle !== presentation.title) ||
          (item.savedStart && item.savedStart !== presentation.startIso),
      ),
      conflict: false,
      date: presentation.date || session.date,
      dateLabel: presentation.dateLabel || session.dateLabel,
      start: presentation.start,
      end: presentation.end,
      startIso: presentation.startIso,
      endIso: presentation.endIso,
      title: presentation.title,
      location: session.location,
      number: presentation.number,
      savedTitle: item.savedTitle,
    };
  });

  const active = entries.filter((entry) => !entry.missing);
  for (let index = 0; index < active.length; index += 1) {
    for (let other = index + 1; other < active.length; other += 1) {
      if (sameCommitment(active[index], active[other])) continue;
      if (!overlaps(active[index], active[other])) continue;
      active[index].conflict = true;
      active[other].conflict = true;
    }
  }

  return entries.sort((a, b) => {
    if (a.missing !== b.missing) return a.missing ? 1 : -1;
    return (a.startIso || "9999").localeCompare(b.startIso || "9999") || a.title.localeCompare(b.title);
  });
}

export function exportEntries(entries: AgendaEntry[]): AgendaEntry[] {
  const sessionIds = new Set(entries.filter((entry) => entry.kind === "session" && !entry.missing).map((entry) => entry.id));
  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (entry.missing) return false;
    if (entry.kind === "presentation" && entry.session && sessionIds.has(entry.session.id)) return false;
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

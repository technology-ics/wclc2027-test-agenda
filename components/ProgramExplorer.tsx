"use client";

import { useEffect, useMemo, useState } from "react";
import { findSession } from "@/lib/find";
import { hitMatchesFilters, searchProgram, sessionMatchesFilters } from "@/lib/search";
import { timeRangeLabel } from "@/lib/time";
import { emptyFilters, type FilterState, type RoleBucket, type SearchHit, type Session } from "@/lib/types";
import { SessionDetail } from "./SessionDetail";
import { useBookmarks, useClock, useProgram, useSearch } from "./state";
import { Timetable } from "./Timetable";
import { BookmarkButton, Highlight, StatusBadge } from "./widgets";

function filtersActive(filters: FilterState) {
  return Boolean(
    filters.dayId ||
      filters.types.length ||
      filters.tracks.length ||
      filters.locations.length ||
      filters.roles.length ||
      filters.cme.length ||
      filters.bookmarkedOnly ||
      filters.happeningOnly,
  );
}

export function ProgramExplorer() {
  const { program, loading, error } = useProgram();
  const { query } = useSearch();
  const { has } = useBookmarks();
  const { nowIso } = useClock();
  const [browseDay, setBrowseDay] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "timetable">("list");
  const [filters, setFilters] = useState<FilterState>(emptyFilters());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [anchor, setAnchor] = useState("");

  useEffect(() => {
    if (!program || browseDay) return;
    setBrowseDay(program.days[0]?.id ?? null);
  }, [program, browseDay]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const session = params.get("session");
    if (session) setOpenSessionId(session);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("panel-open", Boolean(openSessionId));
    if (!openSessionId) return () => document.body.classList.remove("panel-open");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenSessionId(null);
        setAnchor("");
        const params = new URLSearchParams(window.location.search);
        params.delete("session");
        const search = params.toString();
        window.history.replaceState(null, "", search ? `/?${search}` : "/");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("panel-open");
      document.removeEventListener("keydown", onKey);
    };
  }, [openSessionId]);

  const activeDay = browseDay ?? program?.days[0]?.id ?? null;
  const searching = query.trim().length > 0;
  const hits = useMemo(() => (program && searching ? searchProgram(program, query) : []), [program, searching, query]);
  const visibleHits = useMemo(
    () =>
      hits.filter((hit) =>
        hitMatchesFilters(hit, filters, {
          bookmarked: has(hit.id),
          nowIso,
        }),
      ),
    [hits, filters, has, nowIso],
  );
  const visibleSessions = useMemo(() => {
    if (!program) return [];
    return program.sessions.filter((session) =>
      sessionMatchesFilters(session, filters, {
        browseDayId: searching ? null : activeDay,
        bookmarked: has(session.id) || session.presentations.some((presentation) => has(presentation.id)),
        nowIso,
      }),
    );
  }, [program, filters, searching, browseDay, has, nowIso]);

  function openSession(id: string, nextAnchor = "") {
    setOpenSessionId(id);
    setAnchor(nextAnchor);
    const params = new URLSearchParams(window.location.search);
    const session = program ? findSession(program, id) : undefined;
    params.set("session", session?.number || id);
    const search = params.toString();
    window.history.replaceState(null, "", search ? `/?${search}` : "/");
  }

  function closeSession() {
    setOpenSessionId(null);
    setAnchor("");
    const params = new URLSearchParams(window.location.search);
    params.delete("session");
    const search = params.toString();
    window.history.replaceState(null, "", search ? `/?${search}` : "/");
  }

  const openSessionRecord = program && openSessionId ? findSession(program, openSessionId) : undefined;

  if (loading && !program) {
    return <p className="text-iaslc">Loading the conference program…</p>;
  }
  if (!program) {
    return <p role="alert">{error || "The conference program is unavailable."}</p>;
  }

  return (
    <div>
      {program.meta.stale && program.meta.warning ? (
        <p className="mb-4 rounded-xl border-l-4 border-accent bg-[#fff6ec] px-4 py-3 text-sm" role="status">
          {program.meta.warning}
        </p>
      ) : null}
      {error && program.meta.stale ? null : error ? (
        <p className="mb-4 text-sm text-slate-700" role="status">
          {error}
        </p>
      ) : null}

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Conference days">
        {program.days.map((day) => {
          const selected = !searching && activeDay === day.id;
          return (
            <button
              key={day.id}
              type="button"
              role="tab"
              aria-selected={selected}
              title={day.label}
              disabled={searching}
              onClick={() => setBrowseDay(day.id)}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${
                selected ? "bg-iaslc text-white" : "border border-[#c5d4ea] text-iaslc"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {day.shortLabel}
            </button>
          );
        })}
      </div>
      {searching ? (
        <p className="mb-3 text-sm text-slate-700">Search covers every conference day. Use filters if you want to narrow by day.</p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full border border-[#c5d4ea] p-1" role="group" aria-label="Program view">
          <button
            type="button"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${view === "list" ? "bg-iaslc text-white" : "text-iaslc"}`}
          >
            List
          </button>
          <button
            type="button"
            aria-pressed={view === "timetable"}
            onClick={() => setView("timetable")}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${view === "timetable" ? "bg-iaslc text-white" : "text-iaslc"}`}
          >
            Timetable
          </button>
        </div>
        <button
          type="button"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((value) => !value)}
          className="min-h-11 rounded-full border border-iaslc px-4 text-sm font-semibold text-iaslc"
        >
          Filters
        </button>
        {filtersActive(filters) ? (
          <button type="button" onClick={() => setFilters(emptyFilters())} className="min-h-11 rounded-full px-3 text-sm font-semibold text-iaslc underline">
            Reset filters
          </button>
        ) : null}
        <p className="text-sm text-slate-700" aria-live="polite">
          {searching
            ? `${visibleHits.length} result${visibleHits.length === 1 ? "" : "s"}`
            : `${visibleSessions.length} session${visibleSessions.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {filtersOpen ? (
        <FilterPanel programFilters={program.filters} days={program.days} filters={filters} setFilters={setFilters} />
      ) : null}

      {searching ? (
        <SearchList hits={visibleHits} query={query} nowIso={nowIso} onOpen={openSession} />
      ) : view === "timetable" ? (
        <Timetable sessions={visibleSessions} nowIso={nowIso} onOpen={openSession} />
      ) : (
        <SessionList sessions={visibleSessions} nowIso={nowIso} onOpen={openSession} />
      )}

      {openSessionRecord ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#102038]/40">
          <button type="button" aria-label="Close session details" className="hidden flex-1 sm:block" onClick={closeSession} />
          <div role="dialog" aria-modal="true" aria-label={openSessionRecord.title} className="h-full w-full overflow-hidden bg-white shadow-2xl sm:max-w-xl">
            <SessionDetail
              program={program}
              session={openSessionRecord}
              nowIso={nowIso}
              onClose={closeSession}
              initialAnchor={anchor}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SessionList({
  sessions,
  nowIso,
  onOpen,
}: {
  sessions: Session[];
  nowIso: string;
  onOpen: (id: string) => void;
}) {
  if (sessions.length === 0) {
    return <p className="rounded-xl border border-dashed border-[#c5d4ea] px-4 py-8 text-sm">No sessions match the current day and filters.</p>;
  }
  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <article key={session.id} className="rounded-2xl border border-[#d5dee8] border-l-4 border-l-iaslc bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <button type="button" onClick={() => onOpen(session.id)} className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold text-iaslc">
                {session.number}
                <span className="px-2 text-slate-400" aria-hidden="true">
                  ·
                </span>
                {timeRangeLabel(session.start, session.end)}
              </p>
              <h2 className="mt-1 font-display text-xl font-bold leading-snug text-iaslc">{session.title}</h2>
            </button>
            <BookmarkButton
              compact
              item={{ id: session.id, kind: "session", savedTitle: session.title, savedStart: session.startIso, label: session.title }}
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <StatusBadge startIso={session.startIso} endIso={session.endIso} nowIso={nowIso} />
            <span className="rounded-full bg-[#eef3fb] px-3 py-1">{session.dateLabel}</span>
            <span className="rounded-full bg-[#eef3fb] px-3 py-1">{session.location || "Location not listed"}</span>
            {session.type ? <span className="rounded-full bg-[#e7f6fd] px-3 py-1">{session.type}</span> : null}
            {session.track ? <span className="rounded-full bg-white px-3 py-1 ring-1 ring-[#c5d4ea]">{session.track}</span> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function SearchList({
  hits,
  query,
  nowIso,
  onOpen,
}: {
  hits: SearchHit[];
  query: string;
  nowIso: string;
  onOpen: (sessionId: string, anchor?: string) => void;
}) {
  if (hits.length === 0) {
    return <p className="rounded-xl border border-dashed border-[#c5d4ea] px-4 py-8 text-sm">No sessions or presentations match that search.</p>;
  }
  return (
    <div className="space-y-3">
      {hits.map((hit) => (
        <article key={`${hit.kind}-${hit.id}`} className="rounded-2xl border border-[#d5dee8] bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => onOpen(hit.sessionId, hit.anchor)}
            >
              <p className="text-xs font-bold uppercase tracking-wide text-iaslc">
                {hit.kind === "session" ? "Session" : "Presentation"}
                {hit.number ? ` · ${hit.number}` : ""}
              </p>
              <h2 className="mt-1 text-lg font-semibold leading-snug text-ink">
                <Highlight text={hit.title} query={query} />
              </h2>
              {hit.kind === "presentation" ? (
                <p className="mt-1 text-sm text-slate-700">
                  Session {hit.sessionNumber}: <Highlight text={hit.parentTitle} query={query} />
                  {hit.parentTime ? ` · Session ${hit.parentTime}` : ""}
                </p>
              ) : null}
              {hit.matchedPeople.length > 0 ? (
                <ul className="mt-2 text-sm">
                  {hit.matchedPeople.map((person) => (
                    <li key={`${hit.id}-${person.name}-${person.role}`}>
                      <span className="font-semibold text-iaslc">{person.role}: </span>
                      <Highlight text={person.name} query={query} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </button>
            <BookmarkButton
              compact
              item={{
                id: hit.id,
                kind: hit.kind,
                savedTitle: hit.title,
                savedStart: hit.startIso,
                label: hit.title,
              }}
            />
          </div>
          <div className="mt-3 grid gap-1 text-sm sm:grid-cols-3">
            <p>
              <span className="font-semibold text-iaslc">Date </span>
              {hit.dateLabel}
            </p>
            <p>
              <span className="font-semibold text-iaslc">Time </span>
              {hit.timeLabel}
            </p>
            <p>
              <span className="font-semibold text-iaslc">Location </span>
              {hit.location || "Location not listed"}
            </p>
          </div>
          <div className="mt-2">
            <StatusBadge startIso={hit.startIso} endIso={hit.endIso} nowIso={nowIso} />
          </div>
        </article>
      ))}
    </div>
  );
}

function FilterPanel({
  programFilters,
  days,
  filters,
  setFilters,
}: {
  programFilters: { types: string[]; tracks: string[]; locations: string[]; roles: RoleBucket[]; cme: string[] };
  days: { id: string; label: string }[];
  filters: FilterState;
  setFilters: (value: FilterState) => void;
}) {
  const toggle = (key: "types" | "tracks" | "locations" | "roles" | "cme", value: string) => {
    const current = filters[key] as string[];
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    setFilters({ ...filters, [key]: next });
  };
  return (
    <div className="mb-4 grid gap-4 rounded-2xl border border-[#d5dee8] bg-[#f8fbfe] p-4 md:grid-cols-2 xl:grid-cols-3">
      <CheckGroup label="Day" options={days.map((day) => ({ id: day.id, label: day.label }))} selected={filters.dayId ? [filters.dayId] : []} onToggle={(id) => setFilters({ ...filters, dayId: filters.dayId === id ? null : id })} />
      <CheckGroup label="Session type" options={programFilters.types.map((item) => ({ id: item, label: item }))} selected={filters.types} onToggle={(id) => toggle("types", id)} />
      <CheckGroup label="Scientific track" options={programFilters.tracks.map((item) => ({ id: item, label: item }))} selected={filters.tracks} onToggle={(id) => toggle("tracks", id)} />
      <CheckGroup label="Location" options={programFilters.locations.map((item) => ({ id: item, label: item }))} selected={filters.locations} onToggle={(id) => toggle("locations", id)} />
      <CheckGroup label="Role" options={programFilters.roles.map((item) => ({ id: item, label: item }))} selected={filters.roles} onToggle={(id) => toggle("roles", id)} />
      <CheckGroup label="CME" options={programFilters.cme.map((item) => ({ id: item, label: item }))} selected={filters.cme} onToggle={(id) => toggle("cme", id)} />
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={filters.bookmarkedOnly} onChange={(event) => setFilters({ ...filters, bookmarkedOnly: event.target.checked })} />
        Bookmarked only
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={filters.happeningOnly} onChange={(event) => setFilters({ ...filters, happeningOnly: event.target.checked })} />
        Happening now
      </label>
    </div>
  );
}

function CheckGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold text-iaslc">{label}</legend>
      <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
        {options.map((option) => (
          <label key={option.id} className="flex min-h-8 items-start gap-2 text-sm">
            <input type="checkbox" checked={selected.includes(option.id)} onChange={() => onToggle(option.id)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

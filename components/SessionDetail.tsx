"use client";

import { useEffect, useState } from "react";
import { buildAgenda } from "@/lib/agenda";
import { anchorId } from "@/lib/anchors";
import { eventFromEntry } from "@/lib/calendar";
import { canViewAbstract } from "@/lib/ingest";
import { personLine } from "@/lib/people";
import { timeRangeLabel } from "@/lib/time";
import type { Presentation, ProgramData, Session } from "@/lib/types";
import { BookmarkButton, CalendarMenu, StatusBadge } from "./widgets";

function locationText(location: string) {
  return location || "Location not listed";
}

function eventFor(
  program: ProgramData,
  kind: "session" | "presentation",
  id: string,
) {
  if (typeof window === "undefined") return null;
  const entry = buildAgenda(program, [{ id, kind, savedTitle: "", savedStart: "" }])[0];
  return eventFromEntry(entry, window.location.origin, program.meta.timezone);
}

export function SessionDetail({
  program,
  session,
  nowIso,
  onClose,
  initialAnchor,
}: {
  program: ProgramData;
  session: Session;
  nowIso: string;
  onClose?: () => void;
  initialAnchor?: string;
}) {
  const [abstract, setAbstract] = useState<Presentation | null>(null);

  useEffect(() => {
    if (!initialAnchor) return;
    const node = document.getElementById(initialAnchor);
    node?.scrollIntoView({ block: "start" });
  }, [initialAnchor, session.id]);

  useEffect(() => {
    if (!window.location.hash) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [session.id]);

  return (
    <article className="flex h-full flex-col bg-white">
      <header className="sticky top-0 z-10 border-b border-[#d5dee8] bg-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-iaslc">{session.number}</p>
          {onClose ? (
            <button type="button" onClick={onClose} className="min-h-11 rounded-full px-3 text-sm font-semibold text-iaslc">
              Close
            </button>
          ) : null}
        </div>
        <h2 className="mt-1 font-display text-2xl font-bold leading-tight text-iaslc">{session.title}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge startIso={session.startIso} endIso={session.endIso} nowIso={nowIso} />
          <BookmarkButton
            item={{ id: session.id, kind: "session", savedTitle: session.title, savedStart: session.startIso, label: session.title }}
          />
          <CalendarMenu event={eventFor(program, "session", session.id)} />
        </div>
      </header>
      <div className="space-y-5 overflow-y-auto px-5 py-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-iaslc">When</dt>
            <dd>{session.dateLabel}</dd>
            <dd className="font-medium">{timeRangeLabel(session.start, session.end)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-iaslc">Location</dt>
            <dd>{locationText(session.location)}</dd>
          </div>
          <div>
            <dt className="font-semibold text-iaslc">Session type</dt>
            <dd>{session.type || "Not listed"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-iaslc">Track</dt>
            <dd>{session.track || "Not listed"}</dd>
          </div>
          {session.cme ? (
            <div className="sm:col-span-2">
              <dt className="font-semibold text-iaslc">CME</dt>
              <dd>{session.cme}</dd>
            </div>
          ) : null}
        </dl>
        {session.chairs.length > 0 ? (
          <section>
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-iaslc">Chairs</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {session.chairs.map((person) => (
                <li key={`${person.name}-${person.role}`}>{personLine(person)}</li>
              ))}
            </ul>
          </section>
        ) : null}
        {session.moderators.length > 0 ? (
          <section>
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-iaslc">Moderators</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {session.moderators.map((person) => (
                <li key={`${person.name}-${person.role}`}>{personLine(person)}</li>
              ))}
            </ul>
          </section>
        ) : null}
        <section>
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-iaslc">Presentations</h3>
          <ol className="mt-3 divide-y divide-[#e6eef5] border-y border-[#e6eef5]">
            {session.presentations.map((presentation) => (
              <li key={presentation.id} id={anchorId(presentation.id)} className="scroll-mt-24 py-4">
                <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-iaslc">
                  <span>{timeRangeLabel(presentation.start, presentation.end)}</span>
                  <span className="rounded-full bg-[#e7f6fd] px-2 py-0.5 text-xs">{presentation.kindLabel}</span>
                  {presentation.number ? <span>{presentation.number}</span> : null}
                  <StatusBadge startIso={presentation.startIso} endIso={presentation.endIso} nowIso={nowIso} />
                </div>
                <p className="mt-1 text-base font-medium leading-snug">{presentation.title}</p>
                {presentation.participants.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {presentation.participants.map((person) => (
                      <li key={`${presentation.id}-${person.name}-${person.role}`}>
                        <span className="font-semibold text-ink">{person.role}: </span>
                        {personLine(person)}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <BookmarkButton
                    item={{
                      id: presentation.id,
                      kind: "presentation",
                      savedTitle: presentation.title,
                      savedStart: presentation.startIso,
                      label: presentation.title,
                    }}
                  />
                  <CalendarMenu event={eventFor(program, "presentation", presentation.id)} />
                  {canViewAbstract(presentation) ? (
                    <button
                      type="button"
                      onClick={() => setAbstract(presentation)}
                      className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-[#1a1208]"
                    >
                      View abstract
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
      {abstract?.abstract ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#102038]/50 p-0 sm:items-center sm:p-6" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="abstract-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-iaslc">{abstract.abstract.number || abstract.number}</p>
                <h3 id="abstract-title" className="font-display text-xl font-bold text-iaslc">
                  {abstract.abstract.title || abstract.title}
                </h3>
              </div>
              <button type="button" className="min-h-11 px-3 text-sm font-semibold text-iaslc" onClick={() => setAbstract(null)}>
                Close
              </button>
            </div>
            {abstract.abstract.authors.length > 0 ? (
              <ul className="mt-4 space-y-1 text-sm">
                {abstract.abstract.authors.map((author) => (
                  <li key={`${author.name}-${author.affiliation}`}>{[author.name, author.affiliation, author.country].filter(Boolean).join(", ")}</li>
                ))}
              </ul>
            ) : null}
            {abstract.abstract.body ? <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{abstract.abstract.body}</p> : null}
            {abstract.abstract.sections.map((section) => (
              <section key={section.heading} className="mt-4">
                <h4 className="font-semibold text-iaslc">{section.heading}</h4>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{section.text}</p>
              </section>
            ))}
            {abstract.abstract.url ? (
              <a className="mt-4 inline-flex font-semibold text-iaslc underline" href={abstract.abstract.url} target="_blank" rel="noopener noreferrer">
                Open abstract
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

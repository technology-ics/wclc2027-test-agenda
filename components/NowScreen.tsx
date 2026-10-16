"use client";

import { DateTime } from "luxon";
import { liveStatus } from "@/lib/time";
import { timeRangeLabel } from "@/lib/time";
import { useClock, useProgram } from "./state";
import { BookmarkButton, StatusBadge } from "./widgets";
import Link from "next/link";
import { sessionPath } from "@/lib/anchors";
import { formatClock } from "@/lib/time";

export function NowScreen() {
  const { program, loading } = useProgram();
  const { nowIso, timezone, simulated } = useClock();
  if (loading && !program) return <p className="text-iaslc">Checking the live schedule…</p>;
  if (!program) return <p>The conference program is unavailable.</p>;

  const now = DateTime.fromISO(nowIso);
  const first = program.meta.firstStart ? DateTime.fromISO(program.meta.firstStart) : null;
  const last = program.meta.lastEnd ? DateTime.fromISO(program.meta.lastEnd) : null;
  const happening = program.sessions.filter((session) => liveStatus(session.startIso, session.endIso, nowIso) === "happening");
  const soon = program.sessions.filter((session) => liveStatus(session.startIso, session.endIso, nowIso) === "soon");
  let note = "";
  if (first && now < first) note = "The published conference dates have not started yet.";
  else if (last && now >= last) note = "The published conference dates have ended.";
  else if (happening.length === 0 && soon.length === 0) note = "No sessions are in progress right now.";

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-700">
        Status uses {program.meta.timezoneLabel}. Current conference time: {formatClock(nowIso, timezone)}
        {simulated ? " (simulated)" : ""}. This page refreshes about every minute.
      </p>
      {note ? <p className="rounded-xl bg-[#eef3fb] px-4 py-3 text-sm">{note}</p> : null}
      <SessionGroup title="Happening now" sessions={happening} nowIso={nowIso} empty="Nothing is underway at this time." />
      <SessionGroup title="Starting soon" sessions={soon} nowIso={nowIso} empty="No sessions start within the next 15 minutes." />
    </div>
  );
}

function SessionGroup({
  title,
  sessions,
  nowIso,
  empty,
}: {
  title: string;
  sessions: { id: string; number: string; title: string; dateLabel: string; start: string; end: string; location: string; type: string; startIso: string; endIso: string }[];
  nowIso: string;
  empty: string;
}) {
  return (
    <section>
      <h2 className="font-display text-2xl font-bold text-iaslc">{title}</h2>
      {sessions.length === 0 ? (
        <p className="mt-2 text-sm text-slate-700">{empty}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {sessions.map((session) => (
            <article key={session.id} className="rounded-2xl border border-[#d5dee8] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <StatusBadge startIso={session.startIso} endIso={session.endIso} nowIso={nowIso} />
                  <h3 className="mt-2 font-display text-xl font-bold text-iaslc">
                    <Link href={sessionPath(session.number)}>{session.number}: {session.title}</Link>
                  </h3>
                  <p className="mt-1 text-sm">{session.dateLabel}</p>
                  <p className="text-sm font-semibold">{timeRangeLabel(session.start, session.end)}</p>
                  <p className="text-sm">{session.location || "Location not listed"}</p>
                  {session.type ? <p className="text-sm text-slate-700">{session.type}</p> : null}
                </div>
                <BookmarkButton
                  item={{ id: session.id, kind: "session", savedTitle: session.title, savedStart: session.startIso, label: session.title }}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

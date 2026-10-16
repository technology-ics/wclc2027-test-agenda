"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildAgenda } from "@/lib/agenda";
import { sessionPath } from "@/lib/anchors";
import { timeRangeLabel } from "@/lib/time";
import { useBookmarks, useProgram } from "./state";

export function AgendaScreen() {
  const { program, loading } = useProgram();
  const { items, remove, ready } = useBookmarks();
  const [message, setMessage] = useState("");
  const entries = useMemo(() => buildAgenda(program, items), [program, items]);
  const conflicts = entries.some((entry) => entry.conflict);
  const groups = new Map<string, typeof entries>();
  for (const entry of entries) {
    const key = entry.missing ? "No longer in the program" : entry.dateLabel || "Unscheduled";
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }

  async function download(kind: "pdf" | "ics") {
    setMessage("");
    const response = await fetch(kind === "pdf" ? "/api/pdf/agenda" : "/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!response.ok) {
      setMessage(kind === "pdf" ? "The agenda PDF could not be created." : "The calendar file could not be created.");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = kind === "pdf" ? "WCLC-My-Agenda.pdf" : "WCLC-My-Agenda.ics";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!ready || (loading && !program)) return <p className="text-iaslc">Loading your agenda…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => download("pdf")} className="min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-[#1a1208]">
          Download My Agenda (PDF)
        </button>
        <button type="button" onClick={() => download("ics")} className="min-h-11 rounded-full border border-iaslc px-4 text-sm font-semibold text-iaslc">
          Export My Agenda to Calendar
        </button>
      </div>
      <p className="max-w-3xl text-sm leading-6 text-slate-700">
        Saved items stay in this browser on this device. They are not synced to another phone or computer, and no account is required.
        Calendar files and PDFs are a snapshot: they do not update on their own if the program changes.
      </p>
      {message ? <p role="alert">{message}</p> : null}
      {conflicts ? (
        <p className="rounded-xl border-l-4 border-accent bg-[#fff6ec] px-4 py-3 text-sm" role="status">
          Some saved items overlap in time. You can keep both; this is only a reminder.
        </p>
      ) : null}
      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#c5d4ea] px-4 py-8 text-sm">
          Your agenda is empty. Save a session or a single presentation from the program.
        </p>
      ) : (
        [...groups.entries()].map(([label, group]) => (
          <section key={label}>
            <h2 className="font-display text-xl font-bold text-iaslc">{label}</h2>
            <div className="mt-3 space-y-3">
              {group.map((entry) => (
                <article key={entry.key} className="rounded-2xl border border-[#d5dee8] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-iaslc">
                        {entry.kind === "session" ? "Session" : "Presentation"}
                        {entry.number ? ` · ${entry.number}` : ""}
                        {entry.conflict ? " · Schedule overlap" : ""}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold">{entry.title}</h3>
                      {entry.missing ? (
                        <p className="mt-1 text-sm">This saved item is no longer in the program.</p>
                      ) : (
                        <>
                          <p className="mt-1 text-sm">{entry.dateLabel}</p>
                          <p className="text-sm font-medium">{timeRangeLabel(entry.start, entry.end)}</p>
                          <p className="text-sm">{entry.location || "Location not listed"}</p>
                          {entry.kind === "presentation" && entry.session ? (
                            <p className="mt-1 text-sm text-slate-700">
                              In session {entry.session.number}: {entry.session.title} ({timeRangeLabel(entry.session.start, entry.session.end)})
                            </p>
                          ) : null}
                          {entry.changed ? <p className="mt-1 text-sm font-medium text-iaslc">This item has been updated since you saved it.</p> : null}
                        </>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {entry.session ? (
                        <Link className="min-h-11 rounded-full bg-iaslc px-4 py-2 text-center text-sm font-semibold text-white" href={sessionPath(entry.session.number, entry.presentation ? `item-${entry.presentation.id.replace(/[^A-Za-z0-9._-]+/g, "-")}` : undefined)}>
                          Open details
                        </Link>
                      ) : null}
                      <button type="button" onClick={() => remove(entry.id)} className="min-h-11 rounded-full border border-iaslc px-4 text-sm font-semibold text-iaslc">
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

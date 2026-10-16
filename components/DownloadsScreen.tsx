"use client";

import { useState } from "react";
import { useBookmarks, useProgram } from "./state";

export function DownloadsScreen() {
  const { program } = useProgram();
  const { items } = useBookmarks();
  const [message, setMessage] = useState("");

  async function downloadAgenda(kind: "pdf" | "ics") {
    setMessage("");
    const response = await fetch(kind === "pdf" ? "/api/pdf/agenda" : "/api/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!response.ok) {
      setMessage("That download could not be created. Save at least one current program item and try again.");
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

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-2xl border border-[#d5dee8] p-5">
        <h2 className="font-display text-2xl font-bold text-iaslc">Complete program</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          A branded, print-friendly PDF of every session and presentation, using the dates and times in the current program data.
        </p>
        <a href="/api/pdf/program" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-accent px-4 text-sm font-semibold text-[#1a1208]">
          Download Full Program (PDF)
        </a>
        {program?.meta.hasAbstracts ? (
          <a href="/api/pdf/program?abstracts=1" className="mt-3 block text-sm font-semibold text-iaslc underline">
            Download full program with abstracts
          </a>
        ) : (
          <p className="mt-3 text-sm text-slate-700">Abstract text is not included because the current program data does not contain abstract bodies or links.</p>
        )}
      </section>
      <section className="rounded-2xl border border-[#d5dee8] p-5">
        <h2 className="font-display text-2xl font-bold text-iaslc">My Agenda</h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Download only the sessions and presentations saved on this device. A bookmarked presentation is exported on its own, not with every talk in its session.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => downloadAgenda("pdf")} className="min-h-11 rounded-full bg-iaslc px-4 text-sm font-semibold text-white">
            Download My Agenda (PDF)
          </button>
          <button type="button" onClick={() => downloadAgenda("ics")} className="min-h-11 rounded-full border border-iaslc px-4 text-sm font-semibold text-iaslc">
            Export My Agenda to Calendar
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-700">
          {items.length} saved item{items.length === 1 ? "" : "s"}. Calendar imports do not update automatically when the program changes.
        </p>
      </section>
      {message ? (
        <p className="md:col-span-2" role="alert">
          {message}
        </p>
      ) : null}
    </div>
  );
}

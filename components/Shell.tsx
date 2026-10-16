"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatUpdated, liveStatus } from "@/lib/time";
import { DevClock } from "./DevClock";
import { useBookmarks, useClock, useProgram, useSearch } from "./state";
import { Peaks } from "./widgets";

const LINKS = [
  { href: "/", label: "Program" },
  { href: "/agenda", label: "My Agenda" },
  { href: "/now", label: "Happening Now" },
  { href: "/downloads", label: "Downloads" },
];

function titles(pathname: string) {
  if (pathname.startsWith("/agenda")) return "My Agenda";
  if (pathname.startsWith("/now")) return "Happening Now";
  if (pathname.startsWith("/downloads")) return "Downloads";
  if (pathname.startsWith("/session")) return "Session details";
  return "Conference Program";
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { program } = useProgram();
  const { count } = useBookmarks();
  const { query, setQuery } = useSearch();
  const { nowIso } = useClock();
  const happening = program?.sessions.some(
    (session) => liveStatus(session.startIso, session.endIso, nowIso) === "happening",
  );

  return (
    <>
      <header className="border-b border-[#d5dee8] bg-white">
        <div className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 overflow-hidden px-4 py-4 xl:pr-52">
          <Peaks className="pointer-events-none absolute bottom-0 right-2 hidden h-16 w-44 opacity-30 xl:block" />
          <Link href="/" aria-label="WCLC 2027 home" className="shrink-0 rounded-md">
            <img
              src="/brand/wclc-2027-logo.png"
              alt="IASLC 2027 World Conference on Lung Cancer, September 11–14, 2027, Denver, CO, USA"
              className="h-14 w-auto sm:h-16"
            />
          </Link>
          <div className="min-w-[12rem] flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">IASLC World Conference on Lung Cancer</p>
            <h1 className="font-display text-3xl font-bold leading-none text-iaslc sm:text-4xl">{titles(pathname)}</h1>
            {program?.meta.dateRangeLabel ? (
              <p className="mt-1 text-sm text-slate-700">
                {program.meta.dateRangeLabel}
                <span className="px-1" aria-hidden="true">
                  ·
                </span>
                Times in {program.meta.timezoneLabel}
              </p>
            ) : null}
          </div>
        </div>
        <div className="sticky top-0 z-40 border-t border-[#e6eef5] bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3">
            <label className="block">
              <span className="sr-only">Search the conference program</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                type="search"
                placeholder="Search sessions, presentations, speakers, tracks, or numbers"
                className="w-full rounded-full border-2 border-iaslc px-5 py-3 text-base text-ink placeholder:text-slate-500"
              />
            </label>
            <nav aria-label="Program" className="flex gap-2 overflow-x-auto pb-1">
              {LINKS.map((link) => {
                const current = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold ${
                      current ? "bg-iaslc text-white" : "border border-[#c5d4ea] text-iaslc"
                    }`}
                  >
                    {link.label}
                    {link.href === "/agenda" && count > 0 ? (
                      <span className={`rounded-full px-2 py-0.5 text-xs ${current ? "bg-white text-iaslc" : "bg-[#e7f6fd] text-iaslc"}`}>
                        {count}
                      </span>
                    ) : null}
                    {link.href === "/now" && happening ? (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-[#1a1208]">Live</span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>
      <div className="h-1 bg-gradient-to-r from-iaslc via-azul to-accent" aria-hidden="true" />
      <main id="content" className="mx-auto min-h-[60vh] max-w-7xl px-4 py-6">
        {children}
      </main>
      <footer className="border-t border-[#d5dee8] px-4 py-6 text-sm text-slate-700">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <p>
            {program
              ? `Program data updated ${formatUpdated(program.meta.updatedAt, program.meta.timezone)} ${program.meta.timezoneLabel}.`
              : "Program data has not loaded yet."}
          </p>
          <p>{program?.meta.sessionCount ?? 0} sessions</p>
        </div>
      </footer>
      <DevClock />
    </>
  );
}

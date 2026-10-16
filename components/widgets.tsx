"use client";

import { useEffect, useId, useRef, useState } from "react";
import { googleCalendarUrl, outlookCalendarUrl, type CalendarEvent } from "@/lib/calendar";
import { liveStatus, type LiveStatus } from "@/lib/time";
import type { BookmarkItem } from "@/lib/types";
import { useBookmarks } from "./state";

export function Highlight({ text, query }: { text: string; query: string }) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (!text || terms.length === 0) return <>{text}</>;
  const pattern = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "ig");
  const parts = text.split(pattern);
  const exact = new RegExp(`^(?:${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`, "i");
  return (
    <>
      {parts.map((part, index) =>
        exact.test(part) ? (
          <mark key={`${part}-${index}`}>{part}</mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

export function StatusBadge({ startIso, endIso, nowIso }: { startIso: string; endIso: string; nowIso: string }) {
  const status: LiveStatus = liveStatus(startIso, endIso, nowIso);
  if (status === "happening") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-iaslc px-2 py-0.5 text-xs font-semibold text-white">
        Happening now
      </span>
    );
  }
  if (status === "soon") {
    return (
      <span className="inline-flex items-center rounded-full border-2 border-iaslc px-2 py-0.5 text-xs font-semibold text-iaslc">
        Starting soon
      </span>
    );
  }
  return null;
}

export function BookmarkButton({
  item,
  compact = false,
}: {
  item: BookmarkItem & { label: string };
  compact?: boolean;
}) {
  const { has, toggle } = useBookmarks();
  const saved = has(item.id);
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${item.label} from My Agenda` : `Save ${item.label} to My Agenda`}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggle(item);
      }}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold ${
        saved
          ? "border-[#1a1208] bg-accent text-[#1a1208]"
          : "border-iaslc bg-white text-iaslc hover:bg-[#eef3fb]"
      }`}
    >
      <BookmarkIcon filled={saved} />
      {compact ? <span className="sr-only">{saved ? "Saved" : "Save"}</span> : saved ? "Saved" : "Save"}
    </button>
  );
}

export function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"}>
      <path
        d="M7 4.5h10A1.5 1.5 0 0 1 18.5 6v14L12 16.5 5.5 20V6A1.5 1.5 0 0 1 7 4.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function CalendarMenu({ event }: { event: CalendarEvent | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  if (!event) return null;
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(eventClick) => {
          eventClick.preventDefault();
          eventClick.stopPropagation();
          setOpen((value) => !value);
        }}
        className="inline-flex min-h-11 items-center justify-center rounded-full border border-iaslc px-3 text-sm font-semibold text-iaslc hover:bg-[#eef3fb]"
      >
        Add to calendar
      </button>
      {open ? (
        <div id={menuId} className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-[#d5dee8] bg-white p-2 shadow-lg">
          <a className="block rounded-lg px-3 py-2 text-sm font-medium text-iaslc hover:bg-[#eef3fb]" href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
            Add to Google Calendar
          </a>
          <a className="block rounded-lg px-3 py-2 text-sm font-medium text-iaslc hover:bg-[#eef3fb]" href={outlookCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
            Add to Outlook / Microsoft 365
          </a>
          <a className="block rounded-lg px-3 py-2 text-sm font-medium text-iaslc hover:bg-[#eef3fb]" href={`/api/calendar?kind=${event.id.startsWith("s:") ? "session" : "presentation"}&id=${encodeURIComponent(event.id)}`}>
            Download calendar event (.ics)
          </a>
          <p className="px-3 py-2 text-xs leading-5 text-slate-700">
            Apple Calendar opens the .ics file. Imported events do not update automatically if the program changes.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function Peaks({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 220 90" aria-hidden="true">
      <polygon points="10,90 55,18 95,90" fill="#203D7C" />
      <polygon points="70,90 125,6 175,90" fill="#16A1DC" />
      <polygon points="145,90 190,30 220,90" fill="#EA8723" />
    </svg>
  );
}

"use client";

import { minutesOf, timeRangeLabel } from "@/lib/time";
import type { Session } from "@/lib/types";
import { BookmarkButton, StatusBadge } from "./widgets";

export function Timetable({
  sessions,
  nowIso,
  onOpen,
}: {
  sessions: Session[];
  nowIso: string;
  onOpen: (sessionId: string) => void;
}) {
  const timed = sessions.filter((session) => session.start && session.end);
  if (timed.length === 0) {
    return <p className="text-sm text-slate-700">No timed sessions are available for this view.</p>;
  }
  const origin = Math.min(...timed.map((session) => minutesOf(session.start)));
  const finish = Math.max(...timed.map((session) => minutesOf(session.end)));
  const pxPerMin = 2.15;
  const height = Math.max((finish - origin) * pxPerMin, 240);
  const rooms: string[] = [];
  for (const session of [...timed].sort((a, b) => a.start.localeCompare(b.start))) {
    const room = session.location || "Location not listed";
    if (!rooms.includes(room)) rooms.push(room);
  }

  const hours: number[] = [];
  for (let minute = origin - (origin % 30); minute <= finish; minute += 30) hours.push(minute);

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#d5dee8]">
      <div className="flex min-w-max">
        <div className="sticky left-0 z-20 w-16 shrink-0 border-r border-[#d5dee8] bg-white">
          <div className="h-16 border-b border-[#d5dee8]" />
          <div className="relative" style={{ height }}>
            {hours.map((minute) => (
              <div
                key={minute}
                className="absolute left-0 right-0 px-1 text-xs font-semibold text-iaslc"
                style={{ top: (minute - origin) * pxPerMin }}
              >
                {`${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`}
              </div>
            ))}
          </div>
        </div>
        {rooms.map((room) => {
          const inRoom = timed.filter((session) => (session.location || "Location not listed") === room);
          return (
            <div key={room} className="w-64 shrink-0 border-r border-[#e6eef5]">
              <div className="flex h-16 items-end border-b border-[#d5dee8] bg-white px-2 pb-2 text-xs font-semibold leading-4 text-iaslc">
                {room}
              </div>
              <div
                className="relative"
                style={{
                  height,
                  backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent ${30 * pxPerMin - 1}px, #e6eef5 ${30 * pxPerMin}px)`,
                }}
              >
                {inRoom.map((session) => {
                  const top = (minutesOf(session.start) - origin) * pxPerMin;
                  const cardHeight = Math.max((minutesOf(session.end) - minutesOf(session.start)) * pxPerMin - 4, 52);
                  return (
                    <div key={session.id} className="absolute left-1 right-1" style={{ top, height: cardHeight }}>
                      <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-lg border border-[#c5d4ea] border-l-4 border-l-iaslc bg-white p-2 shadow-sm">
                        <button
                          type="button"
                          onClick={() => onOpen(session.id)}
                          className="min-h-0 min-w-0 flex-1 overflow-hidden text-left"
                        >
                          <span className="block text-xs font-semibold text-iaslc">
                            {session.number} · {timeRangeLabel(session.start, session.end)}
                          </span>
                          <span className="mt-1 line-clamp-4 block break-words text-sm font-semibold leading-snug text-ink">{session.title}</span>
                          <span className="mt-1 block text-[11px] text-slate-700">{session.type}</span>
                        </button>
                        <div className="mt-1 flex items-center justify-between gap-1">
                          <StatusBadge startIso={session.startIso} endIso={session.endIso} nowIso={nowIso} />
                          <BookmarkButton
                            compact
                            item={{
                              id: session.id,
                              kind: "session",
                              savedTitle: session.title,
                              savedStart: session.startIso,
                              label: session.title,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

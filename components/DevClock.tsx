"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { formatClock } from "@/lib/time";
import { useClock, useProgram } from "./state";

export function DevClock() {
  const enabled = process.env.NODE_ENV === "development";
  const { program } = useProgram();
  const { nowIso, timezone, simulated, setSimulated, clearSimulated } = useClock();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setReady(true), []);
  if (!enabled || !ready) return null;
  const firstDay = program?.days[0]?.id;
  const localValue = DateTime.fromISO(nowIso).setZone(timezone).toFormat("yyyy-MM-dd'T'HH:mm");

  if (!open) {
    return (
      <button
        type="button"
        className="fixed bottom-3 right-3 z-50 rounded-full border-2 border-dashed border-iaslc bg-white px-3 py-2 text-xs font-semibold text-iaslc shadow-lg"
        onClick={() => setOpen(true)}
      >
        Dev time
      </button>
    );
  }

  return (
    <aside className="fixed bottom-3 right-3 z-50 w-80 max-w-[calc(100%-1.5rem)] rounded-xl border-2 border-dashed border-iaslc bg-white p-3 text-xs shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-iaslc">Developer time simulation</p>
        <button type="button" className="font-semibold text-iaslc" onClick={() => setOpen(false)}>
          Hide
        </button>
      </div>
      <p className="mt-1 text-slate-700">Visible only while the site is running in development. Delegates do not see this control.</p>
      <p className="mt-2 font-medium">{simulated ? `Simulated: ${formatClock(nowIso, timezone)}` : `Live clock: ${formatClock(nowIso, timezone)}`}</p>
      <label className="mt-2 block">
        <span className="sr-only">Simulated conference date and time</span>
        <input
          type="datetime-local"
          value={localValue}
          onChange={(event) => {
            const next = DateTime.fromISO(event.target.value, { zone: timezone });
            if (next.isValid) setSimulated(next.toISO() ?? "");
          }}
          className="w-full rounded-lg border border-[#c5d4ea] px-2 py-2"
        />
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full bg-iaslc px-3 py-2 font-semibold text-white"
          onClick={() => {
            if (!firstDay) return;
            const next = DateTime.fromISO(`${firstDay}T10:00:00`, { zone: timezone });
            if (next.isValid && next.toISO()) setSimulated(next.toISO() as string);
          }}
        >
          First day, 10:00
        </button>
        <button type="button" className="rounded-full border border-iaslc px-3 py-2 font-semibold text-iaslc" onClick={clearSimulated}>
          Use real time
        </button>
      </div>
    </aside>
  );
}

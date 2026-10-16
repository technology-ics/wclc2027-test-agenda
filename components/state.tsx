"use client";

import { DateTime } from "luxon";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { BookmarkItem, ProgramData } from "@/lib/types";

const STORAGE_KEY = "wclc-agenda-v1";

type ProgramContextValue = {
  program: ProgramData | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

type BookmarkContextValue = {
  items: BookmarkItem[];
  ready: boolean;
  count: number;
  has: (id: string) => boolean;
  toggle: (item: BookmarkItem) => void;
  remove: (id: string) => void;
};

type ClockContextValue = {
  nowIso: string;
  timezone: string;
  simulated: boolean;
  setSimulated: (iso: string) => void;
  clearSimulated: () => void;
};

type SearchContextValue = {
  query: string;
  setQuery: (value: string) => void;
};

const ProgramContext = createContext<ProgramContextValue | null>(null);
const BookmarkContext = createContext<BookmarkContextValue | null>(null);
const ClockContext = createContext<ClockContextValue | null>(null);
const SearchContext = createContext<SearchContextValue | null>(null);

export function useProgram() {
  const value = useContext(ProgramContext);
  if (!value) throw new Error("Program context missing");
  return value;
}

export function useBookmarks() {
  const value = useContext(BookmarkContext);
  if (!value) throw new Error("Bookmark context missing");
  return value;
}

export function useClock() {
  const value = useContext(ClockContext);
  if (!value) throw new Error("Clock context missing");
  return value;
}

export function useSearch() {
  const value = useContext(SearchContext);
  if (!value) throw new Error("Search context missing");
  return value;
}

function ProgramProvider({ children }: { children: ReactNode }) {
  const [program, setProgram] = useState<ProgramData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    async function load() {
      try {
        const response = await fetch("/api/program", { cache: "no-store" });
        if (!response.ok) throw new Error("unavailable");
        const data = (await response.json()) as ProgramData;
        if (cancelled) return;
        setProgram(data);
        setError(null);
        timer = window.setTimeout(load, Math.max(data.meta.refreshIntervalMs || 300_000, 30_000));
      } catch {
        if (cancelled) return;
        setError("The conference program could not be loaded. Showing the last copy if one is available.");
        timer = window.setTimeout(load, 60_000);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  const value = useMemo(() => ({ program, loading, error, reload }), [program, loading, error, reload]);
  return <ProgramContext.Provider value={value}>{children}</ProgramContext.Provider>;
}

function BookmarkProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BookmarkItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as BookmarkItem[];
        if (Array.isArray(parsed)) {
          setItems(
            parsed.filter(
              (item) =>
                item &&
                typeof item.id === "string" &&
                (item.kind === "session" || item.kind === "presentation") &&
                !item.id.includes("@"),
            ),
          );
        }
      }
    } catch {
      setItems([]);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, ready]);

  const has = useCallback((id: string) => items.some((item) => item.id === id), [items]);
  const toggle = useCallback((item: BookmarkItem) => {
    setItems((current) => {
      if (current.some((saved) => saved.id === item.id)) return current.filter((saved) => saved.id !== item.id);
      return [...current, item];
    });
  }, []);
  const remove = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const value = useMemo(
    () => ({ items, ready, count: items.length, has, toggle, remove }),
    [items, ready, has, toggle, remove],
  );
  return <BookmarkContext.Provider value={value}>{children}</BookmarkContext.Provider>;
}

function ClockProvider({ children }: { children: ReactNode }) {
  const { program } = useProgram();
  const timezone = program?.meta.timezone || "Asia/Seoul";
  const allowSim = process.env.NODE_ENV === "development";
  const [simulatedIso, setSimulatedIso] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!allowSim) return;
    const saved = window.sessionStorage.getItem("wclc-dev-clock");
    if (saved) setSimulatedIso(saved);
  }, [allowSim]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 45_000);
    return () => window.clearInterval(timer);
  }, []);

  const setSimulated = useCallback(
    (iso: string) => {
      if (!allowSim) return;
      setSimulatedIso(iso);
      window.sessionStorage.setItem("wclc-dev-clock", iso);
    },
    [allowSim],
  );
  const clearSimulated = useCallback(() => {
    setSimulatedIso(null);
    window.sessionStorage.removeItem("wclc-dev-clock");
  }, []);

  const nowIso = useMemo(() => {
    if (allowSim && simulatedIso) return simulatedIso;
    return DateTime.now().setZone(timezone).toISO() ?? new Date().toISOString();
  }, [allowSim, simulatedIso, timezone, tick]);

  const value = useMemo(
    () => ({ nowIso, timezone, simulated: Boolean(allowSim && simulatedIso), setSimulated, clearSimulated }),
    [nowIso, timezone, allowSim, simulatedIso, setSimulated, clearSimulated],
  );
  return <ClockContext.Provider value={value}>{children}</ClockContext.Provider>;
}

function SearchProvider({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQueryState] = useState(params.get("q") ?? "");
  const synced = useRef(params.get("q") ?? "");

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (pathname !== "/") return;
      if (synced.current === query) return;
      synced.current = query;
      const next = new URLSearchParams(window.location.search);
      if (query) next.set("q", query);
      else next.delete("q");
      const search = next.toString();
      window.history.replaceState(null, "", search ? `/?${search}` : "/");
    }, 160);
    return () => window.clearTimeout(handle);
  }, [query, pathname]);

  const setQuery = useCallback(
    (value: string) => {
      setQueryState(value);
      if (pathname !== "/") {
        router.push(value ? `/?q=${encodeURIComponent(value)}` : "/");
      }
    },
    [pathname, router],
  );

  const value = useMemo(() => ({ query, setQuery }), [query, setQuery]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function AppState({ children }: { children: ReactNode }) {
  return (
    <ProgramProvider>
      <ClockProvider>
        <BookmarkProvider>
          <SearchProvider>{children}</SearchProvider>
        </BookmarkProvider>
      </ClockProvider>
    </ProgramProvider>
  );
}

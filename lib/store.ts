import fs from "fs/promises";
import path from "path";
import { conferenceConfig } from "./config";
import { buildProgram } from "./ingest";
import { assertNoEmails, containsEmail } from "./privacy";
import type { ProgramData } from "./types";

const cachePath = path.join(process.cwd(), "data", "cache", "program.json");

type Memory = { program: ProgramData; storedAt: number };

let memory: Memory | null = null;
let pending: Promise<ProgramData> | null = null;
let timer: NodeJS.Timeout | null = null;

function usable(entry: Memory | null): entry is Memory {
  if (!entry) return false;
  return Date.now() - entry.storedAt < conferenceConfig.refreshMs;
}

function safeMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "unknown";
  return containsEmail(message) ? "Program refresh failed" : message;
}

async function readCache(): Promise<ProgramData | null> {
  try {
    const text = await fs.readFile(cachePath, "utf8");
    const data = JSON.parse(text) as ProgramData;
    assertNoEmails(data);
    if (data.meta?.schemaVersion !== 1 || !Array.isArray(data.sessions)) return null;
    return data;
  } catch {
    return null;
  }
}

async function writeCache(program: ProgramData): Promise<void> {
  assertNoEmails(program);
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  const temporary = `${cachePath}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(program));
  await fs.rename(temporary, cachePath);
}

async function fetchCsv(): Promise<string> {
  const response = await fetch(conferenceConfig.csvUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
    headers: { Accept: "text/csv,*/*" },
  });
  if (!response.ok) throw new Error(`source_status_${response.status}`);
  return response.text();
}

async function refresh(force: boolean): Promise<ProgramData> {
  if (!force && usable(memory)) return memory.program;
  try {
    const csv = await fetchCsv();
    const program = buildProgram(csv, {
      timezone: conferenceConfig.timezone,
      updatedAt: new Date().toISOString(),
      source: "live",
      refreshIntervalMs: conferenceConfig.refreshMs,
    });
    await writeCache(program);
    memory = { program, storedAt: Date.now() };
    return program;
  } catch (error) {
    console.error("Program refresh failed:", safeMessage(error));
    const cached = memory?.program ?? (await readCache());
    if (!cached) throw new Error("program_unavailable");
    const stale: ProgramData = {
      ...cached,
      meta: {
        ...cached.meta,
        stale: true,
        source: "cache",
        warning: "The live program could not be refreshed. Showing the last successful update.",
      },
    };
    memory = { program: stale, storedAt: Date.now() - conferenceConfig.refreshMs + 60_000 };
    return stale;
  }
}

export async function getProgram(): Promise<ProgramData> {
  if (usable(memory)) return memory.program;
  if (!pending) {
    pending = refresh(false).finally(() => {
      pending = null;
    });
  }
  return pending;
}

export function startRefreshLoop(): void {
  if (timer) return;
  void getProgram();
  timer = setInterval(() => {
    if (!pending) {
      pending = refresh(true).finally(() => {
        pending = null;
      });
    }
  }, conferenceConfig.refreshMs);
  timer.unref?.();
}

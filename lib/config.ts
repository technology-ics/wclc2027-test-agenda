const DEFAULT_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vShHyzsYTVGG1g86awRd4OtsTcaHOvRRgtrtYFp2pHVtVNYbhTVcKWcbZ4PrpcBBeZLCneLh-cu8xgi/pub?gid=223973841&single=true&output=csv";

function refreshMs(): number {
  const parsed = Number(process.env.PROGRAM_REFRESH_MS ?? 300_000);
  if (!Number.isFinite(parsed) || parsed < 15_000) return 300_000;
  return parsed;
}

export const conferenceConfig = {
  csvUrl: process.env.PROGRAM_CSV_URL?.trim() || DEFAULT_CSV_URL,
  refreshMs: refreshMs(),
  timezone: process.env.CONFERENCE_TIMEZONE?.trim() || "Asia/Seoul",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim() || "",
};

export function timezoneLabel(zone: string): string {
  if (zone === "Asia/Seoul") return "Korea Standard Time (Asia/Seoul)";
  if (zone === "America/Denver") return "Mountain Time (America/Denver)";
  return zone;
}

import type { Person, RoleBucket } from "./types";

export function roleBucket(activity: string): RoleBucket {
  const value = activity.trim().toLowerCase();
  if (value.includes("moderator")) return "Moderator";
  if (value.includes("chair")) return "Chair";
  if (value.includes("discuss")) return "Discussant";
  if (value === "q&a" || value.includes("q&a")) return "Q&A";
  return "Speaker";
}

export function kindLabel(activity: string, title: string): string {
  const blob = `${activity} ${title}`.toLowerCase();
  if (/\bpanel\b/.test(blob)) return "Panel";
  if (/\bq\s*&\s*a\b|\bq&a\b/.test(blob)) return "Q&A";
  if (/\bdiscuss/.test(blob)) return "Discussion";
  if (/\bnetwork/.test(blob)) return "Networking";
  if (/\bbreak\b/.test(blob)) return "Break";
  if (/\b(welcome|opening|closing|wrap up|introduction|adjourn)\b/.test(blob)) return "Introduction";
  if (/abstract/.test(activity.toLowerCase())) return "Abstract";
  return "Presentation";
}

export function personLine(person: Pick<Person, "name" | "affiliation" | "country">): string {
  return [person.name, person.affiliation, person.country].filter(Boolean).join(", ");
}

export function dedupePeople(people: Person[]): Person[] {
  const result: Person[] = [];
  for (const person of people) {
    const existing = result.find(
      (item) => item.name.toLowerCase() === person.name.toLowerCase() && item.role === person.role,
    );
    if (!existing) {
      result.push({ ...person });
      continue;
    }
    if (!existing.affiliation && person.affiliation) existing.affiliation = person.affiliation;
    if (!existing.country && person.country) existing.country = person.country;
  }
  return result;
}

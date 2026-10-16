import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { buildAgenda, exportEntries } from "../lib/agenda";
import { buildIcs, eventFromEntry } from "../lib/calendar";
import { buildProgram } from "../lib/ingest";
import { containsEmail } from "../lib/privacy";
import { searchProgram } from "../lib/search";
import { liveStatus } from "../lib/time";
import type { BookmarkItem } from "../lib/types";

const csv = [
  "Abstract.PresentationRoleStatus,Abstract.ControlNumber,Abstract.ProgramStatus,Abstract.ActivityName,Abstract.Title,PrimaryAuthor.FirstName,PrimaryAuthor.LastName,PrimaryAuthor.Email,PrimaryAuthor.FirstInstitutionCountry,Account.Email,Account.Country,PrimaryAuthor.FirstInstitutionName,PrimaryAuthor.ContactCountry,Abstract.PresentationNumber,Session.Number,Session.Type,SessionExtraData.CMEInfo,SessionExtraData.SessionTracks,Session.Title,Session.Location,Abstract.PresentationDateRangeEUNumeric,Abstract.PresentationDateRangeUSDayOnly,Abstract.PresentationDateRangeEUTimeOnly,Session.DateRangeUSDayOnly,Session.DateRangeEUTimeOnly ,Private.Phone",
  'Confirmed,1001,Accepted,Chair,Welcome and Opening Remarks,Alex,Example,alex.example@example.com,Fictivia,account.example@example.com,Fictivia,Example Institute,Fictivia,,ES01,Education Session,Not for CME Credit,Sample Track,Screening @ Region,Room A,12-9-2026 10:00 - 10:05,"Saturday, September 12, 2026",10:00 - 10:05,"Saturday, September 12, 2026",10:00 - 11:00,555-0100',
  'Confirmed,1002,Accepted,Chair,Chair,Blair,Sample,blair.example@example.com,Fictivia,blair.account@example.com,Fictivia,Second Institute,Fictivia,,ES01,Education Session,Not for CME Credit,Sample Track,Screening @ Region,Room A,12-9-2026 10:00 - 10:05,"Saturday, September 12, 2026",10:00 - 10:05,"Saturday, September 12, 2026",10:00 - 11:00,',
  'Confirmed,1003,Accepted,Speaker,Immunotherapy choices for practice,Casey,Example,casey.example@example.com,Fictivia,casey.account@example.com,Fictivia,Example Institute,Fictivia,ES01.01,ES01,Education Session,Not for CME Credit,Sample Track,Screening @ Region,Room A,12-9-2026 10:05 - 10:30,"Saturday, September 12, 2026",10:05 - 10:30,"Saturday, September 12, 2026",10:00 - 11:00,',
  'Confirmed,1004,Accepted,Speaker,Immunotherapy choices for practice,Drew,Example,drew.example@example.com,Fictivia,drew.account@example.com,Fictivia,Other Clinic,Fictivia,ES01.01,ES01,Education Session,Not for CME Credit,Sample Track,Screening @ Region,Room A,12-9-2026 10:05 - 10:30,"Saturday, September 12, 2026",10:05 - 10:30,"Saturday, September 12, 2026",10:00 - 11:00,',
  'Confirmed,1005,Accepted,Q&A,Q&A,,,,,qa.account@example.com,,,,,ES01,Education Session,Not for CME Credit,Sample Track,Screening @ Region,Room A,12-9-2026 10:30 - 10:40,"Saturday, September 12, 2026",10:30 - 10:40,"Saturday, September 12, 2026",10:00 - 11:00,',
  'Confirmed,2001,Accepted,Speaker,Surgery update contact hidden.person@example.com today,Eden,Example,eden.example@example.com,Fictivia,eden.account@example.com,Fictivia,Example Institute,Fictivia,ES02.01,ES02,Oral,ACCME Accredited by IASLC,Other Track,Operative session,Room B,12-9-2026 10:15 - 10:45,"Saturday, September 12, 2026",10:15 - 10:45,"Saturday, September 12, 2026",10:15 - 11:15,',
].join("\n");

describe("program ingestion", () => {
  const program = buildProgram(csv, { timezone: "Asia/Seoul", updatedAt: "2026-10-15T00:00:00.000Z" });

  it("drops email addresses and unapproved contact fields", () => {
    const serialised = JSON.stringify(program);
    expect(containsEmail(serialised)).toBe(false);
    expect(serialised).not.toContain("example.com");
    expect(serialised).not.toContain("555-0100");
    expect(serialised).not.toContain("PrimaryAuthor.Email");
    expect(serialised).toContain("Screening @ Region");
    expect(serialised).toContain("Surgery update contact today");
  });

  it("deduplicates sessions and co-presenters while keeping order", () => {
    expect(program.sessions).toHaveLength(2);
    const first = program.sessions[0];
    expect(first.number).toBe("ES01");
    expect(first.start).toBe("10:00");
    expect(first.end).toBe("11:00");
    expect(first.dateLabel).toBe("Saturday, September 12, 2026");
    expect(first.chairs.map((person) => person.name)).toEqual(["Alex Example", "Blair Sample"]);
    const talk = first.presentations.find((item) => item.number === "ES01.01");
    expect(talk?.participants.map((person) => person.name)).toEqual(["Casey Example", "Drew Example"]);
    expect(first.presentations.map((item) => item.start)).toEqual(["10:00", "10:05", "10:30"]);
    expect(program.meta.hasAbstracts).toBe(false);
  });

  it("searches the whole program and always exposes when and where", () => {
    const immuno = searchProgram(program, "immuno");
    expect(immuno).toHaveLength(1);
    expect(immuno[0]).toMatchObject({
      kind: "presentation",
      dateLabel: "Saturday, September 12, 2026",
      timeLabel: "10:05–10:30",
      location: "Room A",
    });
    expect(searchProgram(program, "ES01").map((hit) => hit.kind)).toEqual(["session"]);
    expect(searchProgram(program, "ES01.01").map((hit) => hit.number)).toEqual(["ES01.01"]);
    const person = searchProgram(program, "blair");
    expect(person[0].matchedPeople[0]).toMatchObject({ name: "Blair Sample", role: "Chair" });
  });

  it("warns about overlapping bookmarks without blocking them", () => {
    const items: BookmarkItem[] = [
      { id: "s:ES01", kind: "session", savedTitle: "Screening @ Region", savedStart: program.sessions[0].startIso },
      { id: "p:ES01.01", kind: "presentation", savedTitle: "Old title", savedStart: "2000-01-01T00:00:00.000Z" },
      { id: "s:ES02", kind: "session", savedTitle: "Operative session", savedStart: program.sessions[1].startIso },
      { id: "missing", kind: "session", savedTitle: "Removed item", savedStart: "" },
    ];
    const agenda = buildAgenda(program, items);
    const session = agenda.find((entry) => entry.id === "s:ES01");
    const child = agenda.find((entry) => entry.id === "p:ES01.01");
    const other = agenda.find((entry) => entry.id === "s:ES02");
    expect(session?.conflict).toBe(true);
    expect(other?.conflict).toBe(true);
    expect(child?.conflict).toBe(true);
    expect(child?.changed).toBe(true);
    expect(agenda.find((entry) => entry.id === "missing")?.missing).toBe(true);
    expect(exportEntries(agenda).map((entry) => entry.id)).toEqual(["s:ES01", "s:ES02"]);
  });
});

describe("conference time", () => {
  it("keeps Seoul and Denver offsets, including daylight saving", () => {
    const seoul = DateTime.fromObject(
      { year: 2026, month: 9, day: 12, hour: 10, minute: 30 },
      { zone: "Asia/Seoul" },
    );
    expect(seoul.toUTC().toFormat("HH:mm")).toBe("01:30");
    const denverSummer = DateTime.fromObject(
      { year: 2027, month: 9, day: 11, hour: 10, minute: 30 },
      { zone: "America/Denver" },
    );
    expect(denverSummer.toFormat("ZZ")).toBe("-06:00");
    expect(denverSummer.toUTC().toFormat("HH:mm")).toBe("16:30");
    const denverWinter = DateTime.fromObject(
      { year: 2027, month: 1, day: 15, hour: 10, minute: 30 },
      { zone: "America/Denver" },
    );
    expect(denverWinter.toFormat("ZZ")).toBe("-07:00");
  });

  it("marks sessions happening now and starting soon", () => {
    const start = "2026-09-12T10:00:00.000+09:00";
    const end = "2026-09-12T11:00:00.000+09:00";
    expect(liveStatus(start, end, "2026-09-12T10:30:00.000+09:00")).toBe("happening");
    expect(liveStatus(start, end, "2026-09-12T09:50:00.000+09:00")).toBe("soon");
    expect(liveStatus(start, end, "2026-09-12T11:00:00.000+09:00")).toBe("past");
  });

  it("writes calendar events in the conference timezone", () => {
    const program = buildProgram(csv, { timezone: "Asia/Seoul" });
    const entry = buildAgenda(program, [{ id: "s:ES01", kind: "session", savedTitle: "", savedStart: "" }])[0];
    const event = eventFromEntry(entry, "http://localhost:3000", "Asia/Seoul");
    expect(event).not.toBeNull();
    const ics = buildIcs([event!], "Test");
    expect(ics).toContain("TZID:Asia/Seoul");
    expect(ics).toContain("DTSTART;TZID=Asia/Seoul:20260912T100000");
    expect(ics).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    expect(containsEmail(event!.description)).toBe(false);
  });
});

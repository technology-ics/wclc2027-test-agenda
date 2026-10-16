export type Person = {
  name: string;
  affiliation: string;
  country: string;
  role: string;
  roleBucket: RoleBucket;
};

export type RoleBucket = "Chair" | "Moderator" | "Speaker" | "Discussant" | "Q&A";

export type AbstractSection = {
  heading: string;
  text: string;
};

export type AbstractContent = {
  number: string;
  title: string;
  authors: { name: string; affiliation: string; country: string }[];
  body: string | null;
  sections: AbstractSection[];
  url: string | null;
};

export type Presentation = {
  id: string;
  number: string;
  title: string;
  activity: string;
  kindLabel: string;
  date: string;
  dateLabel: string;
  start: string;
  end: string;
  startIso: string;
  endIso: string;
  participants: Person[];
  abstract: AbstractContent | null;
  sessionId: string;
};

export type Session = {
  id: string;
  number: string;
  title: string;
  type: string;
  track: string;
  location: string;
  cme: string;
  date: string;
  dateLabel: string;
  start: string;
  end: string;
  startIso: string;
  endIso: string;
  chairs: Person[];
  moderators: Person[];
  presentations: Presentation[];
};

export type ProgramDay = {
  id: string;
  label: string;
  shortLabel: string;
};

export type ProgramMeta = {
  schemaVersion: 1;
  updatedAt: string;
  timezone: string;
  timezoneLabel: string;
  source: "live" | "cache";
  stale: boolean;
  warning: string | null;
  refreshIntervalMs: number;
  sessionCount: number;
  presentationCount: number;
  hasAbstracts: boolean;
  dateRangeLabel: string;
  firstStart: string | null;
  lastEnd: string | null;
};

export type ProgramData = {
  meta: ProgramMeta;
  days: ProgramDay[];
  filters: {
    types: string[];
    tracks: string[];
    locations: string[];
    roles: RoleBucket[];
    cme: string[];
  };
  sessions: Session[];
};

export type SearchHit = {
  kind: "session" | "presentation";
  id: string;
  sessionId: string;
  sessionNumber: string;
  number: string;
  title: string;
  parentTitle: string;
  parentTime: string;
  date: string;
  dateLabel: string;
  timeLabel: string;
  location: string;
  type: string;
  track: string;
  cme: string;
  startIso: string;
  endIso: string;
  matchedPeople: { name: string; role: string }[];
  roleBuckets: RoleBucket[];
  anchor: string;
};

export type BookmarkItem = {
  id: string;
  kind: "session" | "presentation";
  savedTitle: string;
  savedStart: string;
};

export type FilterState = {
  dayId: string | null;
  types: string[];
  tracks: string[];
  locations: string[];
  roles: RoleBucket[];
  cme: string[];
  bookmarkedOnly: boolean;
  happeningOnly: boolean;
};

export const emptyFilters = (): FilterState => ({
  dayId: null,
  types: [],
  tracks: [],
  locations: [],
  roles: [],
  cme: [],
  bookmarkedOnly: false,
  happeningOnly: false,
});

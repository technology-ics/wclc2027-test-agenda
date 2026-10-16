import type { Presentation, ProgramData, Session } from "./types";

export function findSession(program: ProgramData, key: string): Session | undefined {
  const decoded = decodeURIComponent(key);
  return program.sessions.find(
    (session) => session.id === decoded || session.number === decoded || session.id === `s:${decoded}`,
  );
}

export function findPresentation(
  program: ProgramData,
  key: string,
): { session: Session; presentation: Presentation } | undefined {
  const decoded = decodeURIComponent(key);
  for (const session of program.sessions) {
    for (const presentation of session.presentations) {
      if (
        presentation.id === decoded ||
        presentation.number === decoded ||
        presentation.id === `p:${decoded}`
      ) {
        return { session, presentation };
      }
    }
  }
  return undefined;
}

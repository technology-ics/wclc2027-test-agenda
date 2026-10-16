# WCLC 2027 Conference Program

Interactive online program for the IASLC World Conference on Lung Cancer. The interface uses the WCLC 2027 logo and colours. Schedule dates, times, and names come from the published program spreadsheet and are not rewritten.

## Run locally

Node.js 20 or newer is required.

```bash
npm install
npm test
npm run dev
```

Open http://localhost:3000.

## Configuration

Copy `.env.example` to `.env.local` if you need to override the defaults.

| Variable | Purpose |
| --- | --- |
| `PROGRAM_CSV_URL` | Public Google Sheet CSV. No API key is required. |
| `PROGRAM_REFRESH_MS` | How often the server re-reads the sheet. Default `300000` (5 minutes). |
| `CONFERENCE_TIMEZONE` | IANA timezone. Default `Asia/Seoul` because the 2026 room names (ASEM Ballroom, Grand Ballroom) match the COEX venue in Seoul. Set `America/Denver` for the WCLC 2027 production configuration. |
| `NEXT_PUBLIC_SITE_URL` | Optional absolute URL placed in calendar descriptions and PDF links. |

The server keeps a sanitised last-known-good copy in `data/cache/program.json`. If a refresh fails, that copy stays available and the page says the live update failed. The original spreadsheet is never saved.

## Privacy

Faculty email addresses are removed during ingestion. Only an allowlist of public program fields is kept. Email addresses are not stored, indexed, shown, exported, or written to logs. Bookmarks live in the browser’s local storage on that device only.

Do not deploy the local source export `2026-10-14-Export for Program Book.csv`. It is ignored by git and by Vercel.

## Branding

Gotham Narrow is specified for print headings. Licensed font files were not in this folder, so the site uses Roboto for body copy, as the brand guide allows for website text, and Roboto Condensed as the heading fallback. The logo file is used unchanged.

## Not deployed

This project is ready for a standard Next.js host such as Vercel. It has not been deployed.

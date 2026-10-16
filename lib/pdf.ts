import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import type { AgendaEntry } from "./agenda";
import { anchorId, sessionPath } from "./anchors";
import { canViewAbstract } from "./ingest";
import { personLine } from "./people";
import { timeRangeLabel } from "./time";
import type { Presentation, ProgramData, Session } from "./types";

const BLUE = "#203D7C";
const INK = "#1A2332";
const MUTED = "#334155";
const RULE = "#D5DEE8";

type Doc = InstanceType<typeof PDFDocument>;

function contentWidth(doc: Doc): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function ensure(doc: Doc, height: number, onNewPage: () => void) {
  if (doc.y + height <= doc.page.height - doc.page.margins.bottom) return;
  doc.addPage();
  onNewPage();
}

function rule(doc: Doc) {
  const y = doc.y;
  doc.save();
  doc.strokeColor("#16A1DC").lineWidth(2).moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
  doc.restore();
  doc.y = y + 10;
}

function writeWrapped(
  doc: Doc,
  text: string,
  options: { font: string; size: number; color: string },
) {
  doc.font(options.font).fontSize(options.size).fillColor(options.color);
  doc.text(text, { width: contentWidth(doc) });
}

function speakerLine(presentation: Presentation): string {
  if (presentation.participants.length === 0) return "";
  return presentation.participants
    .map((person) => `${person.role}: ${personLine(person)}`)
    .join("  ·  ");
}

function drawPeaks(doc: Doc) {
  const right = doc.page.width - 36;
  doc.save();
  doc.opacity(0.18);
  doc.fillColor("#203D7C").moveTo(right - 78, 28).lineTo(right - 48, 28).lineTo(right - 63, 58).closePath().fill();
  doc.fillColor("#16A1DC").moveTo(right - 46, 34).lineTo(right - 12, 34).lineTo(right - 29, 66).closePath().fill();
  doc.fillColor("#EA8723").moveTo(right - 24, 46).lineTo(right, 46).lineTo(right - 12, 70).closePath().fill();
  doc.restore();
}

function paintFooter(doc: Doc, timezoneLabel: string) {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(index);
    const y = doc.page.height - 40;
    doc.font("Roboto").fontSize(8).fillColor(MUTED);
    doc.text(`Times shown in ${timezoneLabel}`, doc.page.margins.left, y, {
      width: contentWidth(doc) / 2,
      lineBreak: false,
    });
    doc.text(`${index + 1} / ${range.count}`, doc.page.margins.left, y, {
      width: contentWidth(doc),
      align: "right",
      lineBreak: false,
    });
  }
}

function registerFonts(doc: Doc) {
  const dir = path.join(process.cwd(), "assets", "fonts");
  doc.registerFont("Roboto", path.join(dir, "Roboto-Regular.ttf"));
  doc.registerFont("Roboto-Bold", path.join(dir, "Roboto-Bold.ttf"));
  doc.registerFont("Roboto-Medium", path.join(dir, "Roboto-Medium.ttf"));
}

function logoPath(): string {
  return path.join(process.cwd(), "public", "brand", "wclc-2027-logo.png");
}

export type PdfMode =
  | { kind: "program"; includeAbstracts: boolean }
  | { kind: "agenda"; entries: AgendaEntry[] };

export function renderProgramPdf(program: ProgramData, mode: PdfMode, origin: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 48, bottom: 56, left: 48, right: 48 },
      bufferPages: true,
      info: {
        Title: mode.kind === "agenda" ? "WCLC 2027 My Agenda" : "WCLC 2027 Conference Program",
        Author: "IASLC World Conference on Lung Cancer",
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    registerFonts(doc);

    const runningHeader = () => {
      doc.font("Roboto-Bold").fontSize(10).fillColor(BLUE).text("WCLC 2027 Conference Program", doc.page.margins.left, 32, {
        width: contentWidth(doc),
        lineBreak: false,
      });
      doc.y = 52;
    };

    drawPeaks(doc);
    if (fs.existsSync(logoPath())) {
      doc.image(logoPath(), doc.page.margins.left, 36, { width: 250 });
    }
    doc.y = 112;
    writeWrapped(doc, mode.kind === "agenda" ? "My Agenda" : "Conference Program", {
      font: "Roboto-Bold",
      size: 20,
      color: BLUE,
    });
    doc.moveDown(0.2);
    writeWrapped(doc, program.meta.dateRangeLabel || "Conference program", {
      font: "Roboto",
      size: 11,
      color: INK,
    });
    writeWrapped(doc, `All times are 24-hour, ${program.meta.timezoneLabel}.`, {
      font: "Roboto",
      size: 9,
      color: MUTED,
    });
    if (mode.kind === "agenda") {
      doc.moveDown(0.2);
      writeWrapped(doc, "Personalised program of items saved in this browser. Bookmarks stay on this device.", {
        font: "Roboto",
        size: 9,
        color: MUTED,
      });
    }
    doc.moveDown(0.4);
    rule(doc);

    let lastDay = "";
    const writeDay = (label: string) => {
      if (!label || label === lastDay) return;
      lastDay = label;
      ensure(doc, 40, runningHeader);
      const y = doc.y;
      doc.save();
      doc.rect(doc.page.margins.left, y, contentWidth(doc), 22).fill(BLUE);
      doc.fillColor("#FFFFFF").font("Roboto-Bold").fontSize(11).text(label, doc.page.margins.left + 8, y + 5, {
        width: contentWidth(doc) - 16,
        lineBreak: false,
      });
      doc.restore();
      doc.y = y + 30;
      doc.fillColor(INK);
    };

    const writePresentation = (session: Session, presentation: Presentation, includeAbstract: boolean) => {
      ensure(doc, 48, () => {
        runningHeader();
        writeWrapped(doc, `${session.number} continued`, { font: "Roboto-Medium", size: 10, color: BLUE });
        doc.moveDown(0.3);
      });
      const bits = [
        timeRangeLabel(presentation.start, presentation.end),
        presentation.kindLabel,
        presentation.number,
      ].filter(Boolean);
      writeWrapped(doc, bits.join("   "), { font: "Roboto-Medium", size: 9, color: BLUE });
      doc.font("Roboto").fontSize(10).fillColor(INK);
      doc.text(presentation.title, {
        width: contentWidth(doc),
        link: `${origin}${sessionPath(session.number, anchorId(presentation.id))}`,
      });
      const people = speakerLine(presentation);
      if (people) writeWrapped(doc, people, { font: "Roboto", size: 9, color: MUTED });
      if (includeAbstract && canViewAbstract(presentation) && presentation.abstract) {
        const abstract = presentation.abstract;
        if (abstract.body) {
          doc.moveDown(0.15);
          writeWrapped(doc, abstract.body, { font: "Roboto", size: 9, color: INK });
        }
        for (const section of abstract.sections) {
          writeWrapped(doc, section.heading, { font: "Roboto-Medium", size: 9, color: BLUE });
          writeWrapped(doc, section.text, { font: "Roboto", size: 9, color: INK });
        }
        if (abstract.url) {
          doc.font("Roboto").fontSize(9).fillColor(BLUE).text(abstract.url, { width: contentWidth(doc), link: abstract.url });
        }
      }
      doc.moveDown(0.35);
    };

    const writeSessionBlock = (session: Session, presentations: Presentation[] | null, includeAbstract: boolean) => {
      ensure(doc, 88, runningHeader);
      writeDay(session.dateLabel);
      const heading = `${timeRangeLabel(session.start, session.end)}    ${session.number}`;
      writeWrapped(doc, heading, { font: "Roboto-Bold", size: 11, color: BLUE });
      doc.font("Roboto-Bold").fontSize(12).fillColor(BLUE);
      doc.text(session.title, {
        width: contentWidth(doc),
        link: `${origin}${sessionPath(session.number)}`,
      });
      const meta = [session.location, session.type, session.track, session.cme].filter(Boolean).join("   ·   ");
      if (meta) writeWrapped(doc, meta, { font: "Roboto", size: 9, color: MUTED });
      if (session.chairs.length) {
        writeWrapped(doc, `Chairs: ${session.chairs.map((person) => personLine(person)).join("; ")}`, {
          font: "Roboto",
          size: 9,
          color: INK,
        });
      }
      if (session.moderators.length) {
        writeWrapped(doc, `Moderators: ${session.moderators.map((person) => personLine(person)).join("; ")}`, {
          font: "Roboto",
          size: 9,
          color: INK,
        });
      }
      doc.moveDown(0.25);
      const list = presentations ?? session.presentations;
      if (presentations === null) {
        for (const presentation of session.presentations) writePresentation(session, presentation, includeAbstract);
      } else {
        for (const presentation of list) writePresentation(session, presentation, includeAbstract);
      }
      doc.save();
      doc.strokeColor(RULE).lineWidth(1).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
      doc.restore();
      doc.moveDown(0.55);
    };

    if (mode.kind === "program") {
      for (const session of program.sessions) writeSessionBlock(session, null, mode.includeAbstracts);
    } else if (mode.entries.length === 0) {
      writeWrapped(doc, "None of the saved items are in the current program.", {
        font: "Roboto",
        size: 11,
        color: INK,
      });
    } else {
      for (const entry of mode.entries) {
        if (!entry.session) continue;
        if (entry.kind === "session") writeSessionBlock(entry.session, null, false);
        else if (entry.presentation) writeSessionBlock(entry.session, [entry.presentation], false);
      }
    }

    paintFooter(doc, program.meta.timezoneLabel);
    doc.end();
  });
}

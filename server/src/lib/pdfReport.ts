import { LANGUAGE_SHORT_LABELS, QUALITY_FORMULA, type Analytics } from "@testmate/shared";
import PDFDocument from "pdfkit";

/**
 * Builds the PDF report with pdfkit's built-in Helvetica (no font files needed). Those fonts only cover
 * Western European characters, so other text (e.g. Telugu/Devanagari test titles) is replaced; the CSV export
 * keeps the full Unicode text.
 */
const REPLACEMENTS: [RegExp, string][] = [
  [/[‘’]/g, "'"],
  [/[“”]/g, '"'],
  [/[–—]/g, "-"],
  [/→/g, "->"],
  [/≥/g, ">="],
  [/≤/g, "<="],
  [/•/g, "*"],
  [/…/g, "..."],
];

export function pdfSafe(text: string): string {
  let out = text;
  for (const [re, rep] of REPLACEMENTS) out = out.replace(re, rep);
  return out.replace(/[^\x20-\x7E\xA0-\xFF\n]/g, "?");
}

const MODULE_NAMES = { chatbot: "Chatbot", memory: "Memory", multilingual: "Multilingual", api: "API" } as const;
const pct = (n: number | null) => (n === null ? "-" : `${n}%`);

export function buildPdfReport(a: Analytics, meta: { projectName: string; rangeLabel: string; generatedAt: Date }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: pdfSafe(`TestMate AI report - ${meta.projectName}`), Author: "TestMate AI" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const text = (s: string, opts: PDFKit.Mixins.TextOptions = {}) => doc.text(pdfSafe(s), opts);
    const heading = (s: string) => {
      if (doc.y > doc.page.height - 140) doc.addPage();
      doc.moveDown(0.8).font("Helvetica-Bold").fontSize(12).fillColor("#111111");
      text(s, { width });
      doc.moveDown(0.3).font("Helvetica").fontSize(9.5).fillColor("#333333");
    };
    const table = (headers: string[], rows: (string | number)[][], widths: number[]) => {
      const drawRow = (cells: (string | number)[], bold: boolean) => {
        if (doc.y > doc.page.height - 70) doc.addPage();
        const y = doc.y;
        doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
        let x = left;
        let maxH = 0;
        cells.forEach((cell, i) => {
          const w = widths[i]! * width;
          const s = pdfSafe(String(cell));
          doc.text(s, x, y, { width: w - 6 });
          maxH = Math.max(maxH, doc.heightOfString(s, { width: w - 6 }));
          x += w;
        });
        doc.x = left;
        doc.y = y + maxH + 4;
      };
      drawRow(headers, true);
      doc.moveTo(left, doc.y - 2).lineTo(left + width, doc.y - 2).strokeColor("#cccccc").lineWidth(0.5).stroke();
      if (!rows.length) drawRow(["No data in this period."], false);
      for (const r of rows) drawRow(r, false);
      doc.font("Helvetica").fontSize(9.5);
    };

    // Header
    doc.font("Helvetica-Bold").fontSize(20).fillColor("#111111");
    text("TestMate AI - Quality report");
    doc.font("Helvetica").fontSize(10).fillColor("#555555");
    text(`Project: ${meta.projectName}   |   Period: ${meta.rangeLabel}   |   Generated: ${meta.generatedAt.toISOString().replace("T", " ").slice(0, 16)} UTC`);
    doc.moveDown(0.5).fontSize(8.5).fillColor("#777777");
    text(
      "Chatbot, memory and multilingual results come from the built-in SIMULATED (mock) chatbot unless marked live. " +
        "All evaluation is rule-based (keywords, word overlap, script/word-list language detection); it does not understand meaning.",
      { width },
    );

    heading("AI Quality Score");
    doc.font("Helvetica-Bold").fontSize(26).fillColor("#111111");
    text(a.quality.score === null ? "No results yet" : `${a.quality.score} / 100`);
    doc.font("Helvetica").fontSize(9).fillColor("#333333");
    text(a.quality.components.map((c) => `${MODULE_NAMES[c.module]} ${c.passRate}% (weight ${c.weight}%)`).join("   "), { width });
    doc.moveDown(0.3).fontSize(8).fillColor("#777777");
    text(QUALITY_FORMULA, { width });
    doc.fillColor("#333333");

    heading("Totals");
    const t = a.totals;
    text(
      `${t.executions} test runs: ${t.passed} passed, ${t.failed} failed, ${t.needsReview} need review, ${t.errors} errors. ` +
        `${t.mock} simulated, ${t.live} live.`,
      { width },
    );

    heading("By module (latest result of each test)");
    table(
      ["Module", "Tests", "Passed", "Failed", "Review", "Errors", "Pass rate", "Avg score"],
      a.modules.map((m) => [MODULE_NAMES[m.module], m.tests, m.passed, m.failed, m.needsReview, m.errors, pct(m.passRate), m.avgScore ?? "-"]),
      [0.18, 0.1, 0.1, 0.1, 0.1, 0.1, 0.16, 0.16],
    );

    heading("Chatbot quality");
    text(`Average score ${a.chatbot.avgScore ?? "-"} over ${a.chatbot.tests} tests. Most frequent failing checks:`, { width });
    table(["Check", "Failures"], a.chatbot.topFailingChecks.map((c) => [c.label, c.count]), [0.8, 0.2]);

    heading("Conversation memory health");
    const issues = Object.entries(a.memory.issues).filter(([, n]) => n > 0);
    text(
      `${a.memory.scripts} scripts, pass rate ${pct(a.memory.passRate)}` +
        (a.memory.avgFirstFailureTurn ? `, conversations break at turn ${a.memory.avgFirstFailureTurn} on average.` : ".") +
        (issues.length ? ` Issues: ${issues.map(([k, n]) => `${k.replace(/_/g, " ")} ${n}`).join(", ")}.` : ""),
      { width },
    );

    heading("API performance");
    text(
      `${a.api.requests} requests, pass rate ${pct(a.api.passRate)}, ${a.api.errors} errors (${a.api.blocked} blocked by SSRF protection). ` +
        `Response time avg ${a.api.avgMs ?? "-"} ms, p95 ${a.api.p95Ms ?? "-"} ms, max ${a.api.maxMs ?? "-"} ms.`,
      { width },
    );
    if (a.api.slowest.length) table(["Slowest endpoints", "Avg ms", "Requests"], a.api.slowest.map((s) => [s.endpoint, s.avgMs, s.count]), [0.66, 0.17, 0.17]);

    heading("Language comparison (latest run per test)");
    table(
      ["Language", "Tests", "Run", "Passed", "Failed", "Review", "Wrong language", "Pass rate"],
      a.languages.map((l) => [LANGUAGE_SHORT_LABELS[l.language], l.cases, l.run, l.passed, l.failed + l.errors, l.needsReview, l.wrongLanguage, pct(l.passRate)]),
      [0.16, 0.1, 0.1, 0.1, 0.1, 0.1, 0.18, 0.16],
    );

    heading("Regression runs");
    table(
      ["Run", "Suite", "Pass rate", "Change", "New failures", "Fixed"],
      a.regression.map((r) => [
        r.label,
        r.suiteName,
        pct(r.passRate),
        r.passRateDelta === null ? "-" : `${r.passRateDelta > 0 ? "+" : ""}${r.passRateDelta} pts`,
        r.newFailures,
        r.fixed,
      ]),
      [0.2, 0.3, 0.12, 0.14, 0.14, 0.1],
    );

    heading("Bugs");
    const b = a.bugs;
    text(
      `${b.total} bugs: ${b.byStatus.open} open, ${b.byStatus.in_progress} in progress, ${b.byStatus.resolved} resolved, ${b.byStatus.wont_fix} won't fix. ` +
        `Unresolved by severity: critical ${b.openBySeverity.critical}, high ${b.openBySeverity.high}, medium ${b.openBySeverity.medium}, low ${b.openBySeverity.low}.`,
      { width },
    );

    doc.moveDown(1.2).fontSize(7.5).fillColor("#888888");
    text("Non-Latin text (e.g. Telugu or Hindi titles) is shown as '?' in this PDF; use the CSV export for full text.", { width });
    doc.end();
  });
}

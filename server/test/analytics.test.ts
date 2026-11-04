import request from "supertest";
import { describe, expect, it } from "vitest";
import { toCsv } from "../src/lib/csv";
import { pdfSafe } from "../src/lib/pdfReport";
import { setup } from "./helpers";

const reliable = { mode: "knowledge-base", failureRate: 0, faults: [], seed: 1, memoryWindow: 4 };

async function withData() {
  const ctx = setup();
  const project = await request(ctx.app).post("/api/projects").send({ name: "Support Bot" }).expect(201);
  const base = `/api/projects/${project.body.data.id}`;
  await request(ctx.app).put(`${base}/provider/mock`).send(reliable).expect(200);
  const mk = (title: string, input: string, kw: string) =>
    request(ctx.app).post(`${base}/test-cases`).send({ title, input, criteria: { requiredKeywords: [kw] } }).expect(201);
  const pass = await mk("Refund", "How long does a refund take?", "5-7 business days");
  const fail = await mk("Points", "How many loyalty points do I have?", "points");
  // Run the passing case twice: only its latest result counts towards the quality score.
  await request(ctx.app).post(`${base}/test-cases/${pass.body.data.id}/run`).expect(201);
  await request(ctx.app).post(`${base}/test-cases/${pass.body.data.id}/run`).expect(201);
  await request(ctx.app).post(`${base}/test-cases/${fail.body.data.id}/run`).expect(201);
  const script = await request(ctx.app)
    .post(`${base}/conversations`)
    .send({ title: "Name", turns: [{ userMessage: "My name is Ravi." }, { userMessage: "What is my name?", expectation: { kind: "recall", mustInclude: ["Ravi"] } }] })
    .expect(201);
  await request(ctx.app).post(`${base}/conversations/${script.body.data.id}/run`).expect(201);
  return { ...ctx, base };
}

describe("analytics", () => {
  it("computes totals, per-module stats and the weighted quality score from stored runs", async () => {
    const { app, base } = await withData();
    const res = await request(app).get(`${base}/analytics`).expect(200);
    const a = res.body.data;
    expect(a.totals).toMatchObject({ executions: 4, passed: 3, failed: 1, mock: 4, live: 0 });
    const chatbot = a.modules.find((m: { module: string }) => m.module === "chatbot");
    expect(chatbot).toMatchObject({ tests: 2, passed: 1, failed: 1, passRate: 50 });
    // chatbot 50% (weight 0.5) and memory 100% (weight 0.2), renormalized: (50*0.5 + 100*0.2) / 0.7 = 64.3
    expect(a.quality.score).toBe(64.3);
    expect(a.quality.components).toEqual([
      { module: "chatbot", weight: 71.4, passRate: 50 },
      { module: "memory", weight: 28.6, passRate: 100 },
    ]);
    expect(a.chatbot.topFailingChecks[0]).toMatchObject({ label: "Required keywords", count: 1 });
    expect(a.memory).toMatchObject({ scripts: 1, passRate: 100 });
    expect(a.trend).toHaveLength(14);
    expect(a.trend.at(-1)).toMatchObject({ passed: 3, failed: 1 });
    expect(a.recent[0].title).toBe("Name");
  });

  it("returns empty analytics for a project without runs", async () => {
    const { app } = setup();
    const project = await request(app).post("/api/projects").send({ name: "Empty" }).expect(201);
    const res = await request(app).get(`/api/projects/${project.body.data.id}/analytics?days=7`).expect(200);
    expect(res.body.data).toMatchObject({ quality: { score: null, components: [] }, totals: { executions: 0 }, range: { days: 7 } });
    expect(res.body.data.trend).toHaveLength(7);
    await request(app).get(`/api/projects/${project.body.data.id}/analytics?days=abc`).expect(400);
  });

  it("filters execution history by status, source, text and module", async () => {
    const { app, base } = await withData();
    const failed = await request(app).get(`${base}/executions?status=failed`).expect(200);
    expect(failed.body.data.items.map((e: { title: string }) => e.title)).toEqual(["Points"]);
    expect((await request(app).get(`${base}/executions?q=refund`)).body.data.total).toBe(2);
    expect((await request(app).get(`${base}/executions?source=live`)).body.data.total).toBe(0);
    expect((await request(app).get(`${base}/executions?module=memory&days=1`)).body.data.total).toBe(1);
    expect((await request(app).get(`${base}/executions?q=100%25`)).body.data.total).toBe(0);
  });
});

describe("exports", () => {
  it("escapes CSV cells and neutralizes formulas", () => {
    const csv = toCsv(["a", "b"], [["=HYPERLINK(\"x\")", 'say "hi", ok'], [null, "నా ఆర్డర్"], ["-1+1", 5]]);
    expect(csv.startsWith("﻿a,b\r\n")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")","say ""hi"", ok"`);
    expect(csv).toContain(",నా ఆర్డర్");
    expect(csv).toContain("'-1+1,5");
  });

  it("downloads executions and regression CSVs as attachments", async () => {
    const { app, base } = await withData();
    const res = await request(app).get(`${base}/reports/executions.csv?days=30`).expect(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="testmate-support-bot-executions-\d{4}-\d{2}-\d{2}\.csv"/);
    const lines = res.text.trim().split("\r\n");
    expect(lines).toHaveLength(5);
    expect(lines[0]).toContain("id,created_at,module,title,status");
    const reg = await request(app).get(`${base}/reports/regression.csv`).expect(200);
    expect(reg.text.trim().split("\r\n")).toHaveLength(1);
  });

  it("renders a PDF report", async () => {
    const { app, base } = await withData();
    const res = await request(app)
      .get(`${base}/reports/report.pdf?days=30`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    const body = res.body as Buffer;
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    expect(body.length).toBeGreaterThan(2000);
  });

  it("makes text safe for the PDF's built-in fonts", () => {
    expect(pdfSafe("Order status · Telugu → “ok” ≥ 5")).toBe('Order status · Telugu -> "ok" >= 5');
    // Each Telugu code point becomes "?"; the space between the words is kept.
    expect(pdfSafe("నా ఆర్డర్")).toBe("?? ??????");
  });
});

describe("preferences and demo data", () => {
  it("stores validated preferences", async () => {
    const { app } = setup();
    const defaults = await request(app).get("/api/settings/preferences").expect(200);
    expect(defaults.body.data).toEqual({ defaultInputLanguage: "te", defaultExpectedLanguage: "te", defaultMinRelevance: 60, qualityTarget: 80 });
    await request(app).put("/api/settings/preferences").send({ ...defaults.body.data, defaultMinRelevance: 120 }).expect(400);
    const saved = await request(app).put("/api/settings/preferences").send({ ...defaults.body.data, defaultInputLanguage: "hi" }).expect(200);
    expect(saved.body.data.defaultInputLanguage).toBe("hi");
  });

  it("loads and removes demo data through the API", async () => {
    const { app } = setup();
    const seeded = await request(app).post("/api/demo").expect(201);
    expect(seeded.body.data.created).toBe(true);
    const projects = await request(app).get("/api/projects").expect(200);
    expect(projects.body.data[0]).toMatchObject({ name: "Demo: Support Bot", isDemo: true });
    const cleared = await request(app).delete("/api/demo").expect(200);
    expect(cleared.body.data.removed.projects).toBe(1);
    expect((await request(app).get("/api/projects")).body.data).toHaveLength(0);
  });
});

import request from "supertest";
import { describe, expect, it } from "vitest";
import { setup } from "./helpers";

async function withProject() {
  const ctx = setup();
  const project = await request(ctx.app).post("/api/projects").send({ name: "Bugs" }).expect(201);
  const base = `/api/projects/${project.body.data.id}`;
  await request(ctx.app)
    .put(`${base}/provider/mock`)
    .send({ mode: "knowledge-base", failureRate: 0, faults: [], seed: 1, memoryWindow: 0 })
    .expect(200);
  return { ...ctx, base };
}

describe("bugs API", () => {
  it("creates bugs manually, validates input and records history", async () => {
    const { app, base } = await withProject();
    await request(app).post(`${base}/bugs`).send({ title: "x", severity: "urgent" }).expect(400);
    const created = await request(app)
      .post(`${base}/bugs`)
      .send({ title: "Bot ignores Telugu greetings", severity: "medium", category: "wrong_language", module: "multilingual", notes: "Seen in demo" })
      .expect(201);
    expect(created.body.data).toMatchObject({ status: "open", itemKey: null, executionId: null });

    const id = created.body.data.id;
    const updated = await request(app)
      .patch(`${base}/bugs/${id}`)
      .send({ status: "in_progress", severity: "high", comment: "Reproduced with seed 42" })
      .expect(200);
    expect(updated.body.data).toMatchObject({ status: "in_progress", severity: "high" });
    expect(updated.body.data.history.map((h: { action: string; field: string | null }) => [h.action, h.field])).toEqual([
      ["created", null],
      ["updated", "severity"],
      ["updated", "status"],
    ]);
    expect(updated.body.data.history[1]).toMatchObject({ oldValue: "medium", newValue: "high", note: "Reproduced with seed 42" });

    const commented = await request(app).patch(`${base}/bugs/${id}`).send({ comment: "Fix deployed to staging" }).expect(200);
    expect(commented.body.data.history.at(-1)).toMatchObject({ action: "commented", note: "Fix deployed to staging" });
    await request(app).patch(`${base}/bugs/${id}`).send({}).expect(400);
    await request(app).patch(`${base}/bugs/${id}`).send({ status: "closed" }).expect(400);

    await request(app).delete(`${base}/bugs/${id}`).expect(200);
    await request(app).get(`${base}/bugs/${id}`).expect(404);
  });

  it("suggests a prefilled bug from a failed execution", async () => {
    const { app, base } = await withProject();
    const script = await request(app)
      .post(`${base}/conversations`)
      .send({ title: "Name recall", turns: [{ userMessage: "My name is Ravi." }, { userMessage: "What is my name?", expectation: { kind: "recall", mustInclude: ["Ravi"] } }] })
      .expect(201);
    const run = await request(app).post(`${base}/conversations/${script.body.data.id}/run`).expect(201);
    expect(run.body.data.status).toBe("failed");

    const suggestion = await request(app).get(`${base}/bugs/suggest?executionId=${run.body.data.id}`).expect(200);
    expect(suggestion.body.data).toMatchObject({ module: "memory", category: "context_loss", severity: "medium", executionId: run.body.data.id });
    expect(suggestion.body.data.notes).toContain("First failing turn: 2");
    expect(suggestion.body.data.notes).toContain("simulated (mock) chatbot");

    const bug = await request(app).post(`${base}/bugs`).send(suggestion.body.data).expect(201);
    expect(bug.body.data.itemKey).toBe(`script:${script.body.data.id}`);
    await request(app).get(`${base}/bugs/suggest?executionId=99999`).expect(404);
  });

  it("filters, searches, sorts by severity and summarizes", async () => {
    const { app, base } = await withProject();
    const make = (title: string, severity: string, extra = {}) =>
      request(app).post(`${base}/bugs`).send({ title, severity, ...extra }).expect(201);
    await make("Low thing", "low");
    const crit = await make("Critical crash", "critical", { module: "api" });
    await make("Medium 100% issue", "medium");
    await request(app).patch(`${base}/bugs/${crit.body.data.id}`).send({ status: "resolved" }).expect(200);

    const all = await request(app).get(`${base}/bugs`).expect(200);
    expect(all.body.data.map((b: { severity: string }) => b.severity)).toEqual(["critical", "medium", "low"]);
    expect((await request(app).get(`${base}/bugs?status=resolved`)).body.data).toHaveLength(1);
    expect((await request(app).get(`${base}/bugs?module=api`)).body.data).toHaveLength(1);
    expect((await request(app).get(`${base}/bugs?q=100%25`)).body.data.map((b: { title: string }) => b.title)).toEqual(["Medium 100% issue"]);

    const summary = await request(app).get(`${base}/bugs/summary`).expect(200);
    expect(summary.body.data).toEqual({
      total: 3,
      byStatus: { open: 2, in_progress: 0, resolved: 1, wont_fix: 0 },
      openBySeverity: { critical: 0, high: 0, medium: 1, low: 1 },
    });
    const project = await request(app).get(base).expect(200);
    expect(project.body.data.stats.openBugs).toBe(2);
  });

  it("rejects links to executions from other projects", async () => {
    const { app, base } = await withProject();
    const other = await request(app).post("/api/projects").send({ name: "Other" }).expect(201);
    const otherBase = `/api/projects/${other.body.data.id}`;
    const tc = await request(app).post(`${otherBase}/test-cases`).send({ title: "t", input: "refund?", criteria: { requiredKeywords: ["x"] } }).expect(201);
    const run = await request(app).post(`${otherBase}/test-cases/${tc.body.data.id}/run`).expect(201);
    await request(app).post(`${base}/bugs`).send({ title: "Cross link", severity: "low", executionId: run.body.data.id }).expect(400);
  });
});

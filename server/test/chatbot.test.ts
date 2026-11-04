import request from "supertest";
import { describe, expect, it } from "vitest";
import { setup } from "./helpers";

async function withProject() {
  const ctx = setup();
  const res = await request(ctx.app).post("/api/projects").send({ name: "Bot" }).expect(201);
  const pid = res.body.data.id as number;
  return { ...ctx, pid, base: `/api/projects/${pid}` };
}

const reliableConfig = { mode: "knowledge-base", failureRate: 0, faults: [], seed: 1, memoryWindow: 4 };

const refundCase = {
  title: "Refund timeline",
  input: "How long does a refund take?",
  expected: "Refunds go to your original payment method within 5-7 business days.",
  criteria: { requiredKeywords: ["refund", "5-7 business days"], forbiddenKeywords: ["guarantee"] },
};

describe("suites API", () => {
  it("creates, lists, renames and deletes suites, rejecting duplicates", async () => {
    const { app, base } = await withProject();
    const created = await request(app).post(`${base}/suites`).send({ module: "chatbot", name: "FAQ" }).expect(201);
    expect(created.body.data).toMatchObject({ module: "chatbot", name: "FAQ", itemCount: 0 });
    await request(app).post(`${base}/suites`).send({ module: "chatbot", name: "faq" }).expect(409);
    await request(app).post(`${base}/suites`).send({ module: "memory", name: "FAQ" }).expect(201);

    const list = await request(app).get(`${base}/suites?module=chatbot`).expect(200);
    expect(list.body.data).toHaveLength(1);

    const id = created.body.data.id;
    const renamed = await request(app).patch(`${base}/suites/${id}`).send({ name: "Support FAQ" }).expect(200);
    expect(renamed.body.data.name).toBe("Support FAQ");
    await request(app).delete(`${base}/suites/${id}`).expect(200);
    await request(app).delete(`${base}/suites/${id}`).expect(404);
  });

  it("returns 404 for unknown projects", async () => {
    const { app } = setup();
    const res = await request(app).get("/api/projects/999/suites").expect(404);
    expect(res.body.error.message).toBe("Project not found");
  });
});

describe("test cases API", () => {
  it("validates input with field paths", async () => {
    const { app, base } = await withProject();
    const res = await request(app).post(`${base}/test-cases`).send({ title: "", input: "" }).expect(400);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["title", "input"]));

    const noOracle = await request(app).post(`${base}/test-cases`).send({ title: "x", input: "hi" }).expect(400);
    expect(noOracle.body.error.details[0].message).toMatch(/expected answer or at least one required keyword/);

    const exactNoExpected = await request(app)
      .post(`${base}/test-cases`)
      .send({ title: "x", input: "hi", criteria: { matchMode: "exact", requiredKeywords: ["x"] } })
      .expect(400);
    expect(exactNoExpected.body.error.details[0].path).toBe("expected");
  });

  it("supports CRUD with default criteria and suite assignment", async () => {
    const { app, base } = await withProject();
    const suite = await request(app).post(`${base}/suites`).send({ module: "chatbot", name: "FAQ" }).expect(201);
    const otherModule = await request(app).post(`${base}/suites`).send({ module: "memory", name: "Mem" }).expect(201);

    await request(app)
      .post(`${base}/test-cases`)
      .send({ ...refundCase, suiteId: otherModule.body.data.id })
      .expect(400);

    const created = await request(app)
      .post(`${base}/test-cases`)
      .send({ ...refundCase, suiteId: suite.body.data.id })
      .expect(201);
    expect(created.body.data.criteria).toEqual({
      matchMode: "keywords",
      requiredKeywords: ["refund", "5-7 business days"],
      forbiddenKeywords: ["guarantee"],
      minRelevance: 60,
      minLength: null,
      maxLength: null,
    });
    expect(created.body.data.lastRun).toBeNull();

    const id = created.body.data.id;
    const updated = await request(app)
      .put(`${base}/test-cases/${id}`)
      .send({ ...refundCase, title: "Refund ETA", suiteId: null })
      .expect(200);
    expect(updated.body.data).toMatchObject({ title: "Refund ETA", suiteId: null });

    const unassigned = await request(app).get(`${base}/test-cases?module=chatbot&suiteId=none`).expect(200);
    expect(unassigned.body.data).toHaveLength(1);
    await request(app).delete(`${base}/test-cases/${id}`).expect(200);
    await request(app).get(`${base}/test-cases/${id}`).expect(404);
  });

  it("isolates data between projects", async () => {
    const { app, base } = await withProject();
    const other = await request(app).post("/api/projects").send({ name: "Other" }).expect(201);
    const created = await request(app).post(`${base}/test-cases`).send(refundCase).expect(201);
    await request(app).get(`/api/projects/${other.body.data.id}/test-cases/${created.body.data.id}`).expect(404);
    await request(app).post(`/api/projects/${other.body.data.id}/test-cases/${created.body.data.id}/run`).expect(404);
  });
});

describe("running tests", () => {
  it("runs a case through the mock provider and persists a labeled execution", async () => {
    const { app, base, db } = await withProject();
    await request(app).put(`${base}/provider/mock`).send(reliableConfig).expect(200);
    const created = await request(app).post(`${base}/test-cases`).send(refundCase).expect(201);

    const run = await request(app).post(`${base}/test-cases/${created.body.data.id}/run`).expect(201);
    expect(run.body.data).toMatchObject({
      status: "passed",
      effectiveStatus: "passed",
      source: "mock",
      evaluator: "rule-based",
      module: "chatbot",
      details: { provider: { name: "mock", mode: "knowledge-base" }, simulation: { faultInjected: null } },
    });
    expect(run.body.data.output).toContain("5-7 business days");
    expect(run.body.data.details.checks.length).toBeGreaterThan(3);

    const stored = db.prepare("SELECT source, evaluator FROM test_executions").get();
    expect(stored).toEqual({ source: "mock", evaluator: "rule-based" });

    const afterRun = await request(app).get(`${base}/test-cases/${created.body.data.id}`).expect(200);
    expect(afterRun.body.data.lastRun).toMatchObject({ executionId: run.body.data.id, status: "passed" });
  });

  it("records failures with an explanation when the mock injects a fault", async () => {
    const { app, base } = await withProject();
    await request(app)
      .put(`${base}/provider/mock`)
      .send({ ...reliableConfig, failureRate: 1, faults: ["forbidden_claim"] })
      .expect(200);
    const created = await request(app).post(`${base}/test-cases`).send(refundCase).expect(201);
    const run = await request(app).post(`${base}/test-cases/${created.body.data.id}/run`).expect(201);
    expect(run.body.data.status).toBe("failed");
    expect(run.body.data.details.simulation.faultInjected).toBe("forbidden_claim");
    expect(run.body.data.explanation).toContain('Contains forbidden terms: "guarantee"');
  });

  it("runs a whole suite and summarizes results", async () => {
    const { app, base } = await withProject();
    await request(app).put(`${base}/provider/mock`).send(reliableConfig).expect(200);
    const suite = await request(app).post(`${base}/suites`).send({ module: "chatbot", name: "FAQ" }).expect(201);
    const suiteId = suite.body.data.id;
    await request(app).post(`${base}/test-cases`).send({ ...refundCase, suiteId }).expect(201);
    await request(app)
      .post(`${base}/test-cases`)
      .send({ title: "Weather", input: "What's the weather today?", expected: "", criteria: { requiredKeywords: ["sunny"] }, suiteId })
      .expect(201);

    const run = await request(app).post(`${base}/suites/${suiteId}/run`).expect(200);
    expect(run.body.data).toMatchObject({ total: 2, passed: 1, failed: 1, needsReview: 0, errors: 0 });

    const list = await request(app).get(`${base}/executions?module=chatbot&limit=10`).expect(200);
    expect(list.body.data.total).toBe(2);
  });

  it("supports manual overrides with a required note, and clearing them", async () => {
    const { app, base } = await withProject();
    await request(app).put(`${base}/provider/mock`).send(reliableConfig).expect(200);
    const created = await request(app).post(`${base}/test-cases`).send(refundCase).expect(201);
    const run = await request(app).post(`${base}/test-cases/${created.body.data.id}/run`).expect(201);
    const execUrl = `${base}/executions/${run.body.data.id}/override`;

    await request(app).patch(execUrl).send({ status: "failed", note: "" }).expect(400);
    await request(app).patch(execUrl).send({ status: "passed", note: "Looks fine" }).expect(400);

    const overridden = await request(app).patch(execUrl).send({ status: "failed", note: "Tone is rude" }).expect(200);
    expect(overridden.body.data).toMatchObject({
      status: "passed",
      effectiveStatus: "failed",
      override: { status: "failed", note: "Tone is rude" },
    });

    const cleared = await request(app).patch(execUrl).send({ status: null }).expect(200);
    expect(cleared.body.data).toMatchObject({ effectiveStatus: "passed", override: null });
  });

  it("stores and validates the simulated provider config per project", async () => {
    const { app, base } = await withProject();
    const defaults = await request(app).get(`${base}/provider/mock`).expect(200);
    expect(defaults.body.data).toMatchObject({ mode: "knowledge-base", failureRate: 0.2 });
    await request(app).put(`${base}/provider/mock`).send({ ...reliableConfig, failureRate: 2 }).expect(400);
    await request(app).put(`${base}/provider/mock`).send({ ...reliableConfig, faults: ["bogus"] }).expect(400);
    const saved = await request(app).put(`${base}/provider/mock`).send({ ...reliableConfig, seed: 7 }).expect(200);
    expect(saved.body.data.seed).toBe(7);
  });
});

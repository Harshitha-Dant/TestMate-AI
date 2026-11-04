import request from "supertest";
import { describe, expect, it } from "vitest";
import { classifyChange, diffRuns, passRate } from "../src/lib/regressionDiff";
import { setup } from "./helpers";

describe("regression diff", () => {
  it("classifies status changes", () => {
    expect(classifyChange(null, "failed")).toBe("new_test");
    expect(classifyChange("passed", "passed")).toBe("unchanged");
    expect(classifyChange("passed", "failed")).toBe("new_failure");
    expect(classifyChange("passed", "error")).toBe("new_failure");
    expect(classifyChange("failed", "passed")).toBe("fixed");
    expect(classifyChange("needs_review", "passed")).toBe("fixed");
    expect(classifyChange("passed", "needs_review")).toBe("changed");
    expect(classifyChange("failed", "error")).toBe("changed");
  });

  it("matches items by key and reports removed items", () => {
    const { results, removed } = diffRuns(
      [
        { itemKey: "case:1", title: "A", status: "passed", executionId: 10 },
        { itemKey: "case:2", title: "B", status: "failed", executionId: 11 },
        { itemKey: "case:3", title: "C", status: "passed", executionId: 12 },
      ],
      [
        { itemKey: "case:1", title: "A", status: "failed", executionId: 20 },
        { itemKey: "case:2", title: "B", status: "passed", executionId: 21 },
        { itemKey: "case:4", title: "D", status: "passed", executionId: 22 },
      ],
    );
    expect(results.map((r) => [r.itemKey, r.change, r.previousExecutionId])).toEqual([
      ["case:1", "new_failure", 10],
      ["case:2", "fixed", 11],
      ["case:4", "new_test", null],
    ]);
    expect(removed).toEqual([{ itemKey: "case:3", title: "C", previousStatus: "passed", previousExecutionId: 12 }]);
    expect(passRate(2, 3)).toBe(66.7);
    expect(passRate(0, 0)).toBe(0);
  });
});

const reliable = { mode: "knowledge-base", failureRate: 0, faults: [], seed: 1, memoryWindow: 4 };
const broken = { mode: "knowledge-base", failureRate: 1, faults: ["empty"], seed: 1, memoryWindow: 4 };

async function withSuite() {
  const ctx = setup();
  const project = await request(ctx.app).post("/api/projects").send({ name: "Reg" }).expect(201);
  const base = `/api/projects/${project.body.data.id}`;
  const suite = await request(ctx.app).post(`${base}/suites`).send({ module: "chatbot", name: "FAQ" }).expect(201);
  const suiteId = suite.body.data.id as number;
  const add = (title: string, input: string, keywords: string[]) =>
    request(ctx.app).post(`${base}/test-cases`).send({ title, input, criteria: { requiredKeywords: keywords }, suiteId }).expect(201);
  const refund = await add("Refund", "How long does a refund take?", ["5-7 business days"]);
  const points = await add("Loyalty points", "How many loyalty points do I have?", ["points"]);
  await request(ctx.app).put(`${base}/provider/mock`).send(reliable).expect(200);
  return { ...ctx, base, suiteId, refundId: refund.body.data.id as number, pointsId: points.body.data.id as number };
}

describe("regression runs API", () => {
  it("takes a baseline, detects new failures and fixes, and reports pass-rate delta", async () => {
    const { app, base, suiteId } = await withSuite();
    const first = await request(app).post(`${base}/regression/runs`).send({ suiteId, label: "v1.0" }).expect(201);
    expect(first.body.data.diff.to).toMatchObject({ label: "v1.0", total: 2, passed: 1, failed: 1, passRate: 50, baselineRunId: null });
    expect(first.body.data.diff.counts.new_test).toBe(2);

    // "New bot version": every reply is empty, so the passing test regresses.
    await request(app).put(`${base}/provider/mock`).send(broken).expect(200);
    const second = await request(app).post(`${base}/regression/runs`).send({ suiteId, label: "v1.1" }).expect(201);
    const diff = second.body.data.diff;
    expect(diff.from.label).toBe("v1.0");
    expect(diff.to).toMatchObject({ passRate: 0, baselinePassRate: 50, passRateDelta: -50, newFailures: 1 });
    expect(diff.results.find((r: { title: string }) => r.title === "Refund")).toMatchObject({
      change: "new_failure",
      previousStatus: "passed",
      status: "failed",
    });
    expect(diff.counts).toMatchObject({ new_failure: 1, unchanged: 1, fixed: 0 });

    await request(app).put(`${base}/provider/mock`).send(reliable).expect(200);
    const third = await request(app).post(`${base}/regression/runs`).send({ suiteId }).expect(201);
    expect(third.body.data.diff.to).toMatchObject({ label: "Run 3", fixed: 1, passRateDelta: 50 });

    const list = await request(app).get(`${base}/regression/runs?suiteId=${suiteId}`).expect(200);
    expect(list.body.data.map((r: { label: string }) => r.label)).toEqual(["Run 3", "v1.1", "v1.0"]);

    // Any two runs can be compared; executions are tagged with their regression run.
    const cmp = await request(app).get(`${base}/regression/compare?from=${first.body.data.diff.to.id}&to=${third.body.data.diff.to.id}`).expect(200);
    expect(cmp.body.data.counts.unchanged).toBe(2);
    const exec = await request(app).get(`${base}/executions/${diff.results[0].executionId}`).expect(200);
    expect(exec.body.data.regressionRunId).toBe(diff.to.id);
  });

  it("reports removed tests and validates baselines", async () => {
    const { app, base, suiteId, pointsId } = await withSuite();
    const first = await request(app).post(`${base}/regression/runs`).send({ suiteId }).expect(201);
    await request(app).delete(`${base}/test-cases/${pointsId}`).expect(200);
    const second = await request(app).post(`${base}/regression/runs`).send({ suiteId }).expect(201);
    expect(second.body.data.diff.removed).toEqual([
      expect.objectContaining({ title: "Loyalty points", previousStatus: "failed" }),
    ]);

    const other = await request(app).post(`${base}/suites`).send({ module: "chatbot", name: "Other" }).expect(201);
    await request(app).post(`${base}/regression/runs`).send({ suiteId: other.body.data.id }).expect(400); // empty suite
    await request(app)
      .post(`${base}/regression/runs`)
      .send({ suiteId, baselineRunId: 9999 })
      .expect(404);
    await request(app).delete(`${base}/regression/runs/${first.body.data.diff.to.id}`).expect(200);
  });

  it("opens one regression bug per new failure and does not duplicate it", async () => {
    const { app, base, suiteId } = await withSuite();
    await request(app).post(`${base}/regression/runs`).send({ suiteId, label: "v1" }).expect(201);
    await request(app).put(`${base}/provider/mock`).send(broken).expect(200);
    const second = await request(app).post(`${base}/regression/runs`).send({ suiteId, label: "v2", createBugs: true }).expect(201);
    expect(second.body.data.bugsCreated).toHaveLength(1);

    const bug = await request(app).get(`${base}/bugs/${second.body.data.bugsCreated[0]}`).expect(200);
    expect(bug.body.data).toMatchObject({ category: "regression", severity: "high", status: "open", module: "chatbot" });
    expect(bug.body.data.title).toMatch(/^Regression: Refund/);
    expect(bug.body.data.failureExplanation).toContain('fails in "v2"');
    expect(bug.body.data.execution.status).toBe("failed");

    // Recover, regress again: the open bug gets a history note instead of a duplicate.
    await request(app).put(`${base}/provider/mock`).send(reliable).expect(200);
    await request(app).post(`${base}/regression/runs`).send({ suiteId, label: "v3" }).expect(201);
    await request(app).put(`${base}/provider/mock`).send(broken).expect(200);
    const fourth = await request(app).post(`${base}/regression/runs`).send({ suiteId, label: "v4", createBugs: true }).expect(201);
    expect(fourth.body.data.bugsCreated).toHaveLength(0);
    const again = await request(app).get(`${base}/bugs/${second.body.data.bugsCreated[0]}`).expect(200);
    expect(again.body.data.history.at(-1)).toMatchObject({ action: "commented", note: 'Failed again in regression run "v4".' });
  });

  it("works for memory suites using script identity", async () => {
    const ctx = setup();
    const project = await request(ctx.app).post("/api/projects").send({ name: "Mem" }).expect(201);
    const base = `/api/projects/${project.body.data.id}`;
    await request(ctx.app).put(`${base}/provider/mock`).send({ ...reliable, memoryWindow: 5 }).expect(200);
    const suite = await request(ctx.app).post(`${base}/suites`).send({ module: "memory", name: "Recall" }).expect(201);
    await request(ctx.app)
      .post(`${base}/conversations`)
      .send({
        title: "Name",
        suiteId: suite.body.data.id,
        turns: [{ userMessage: "My name is Ravi." }, { userMessage: "What is my name?", expectation: { kind: "recall", mustInclude: ["Ravi"] } }],
      })
      .expect(201);
    await request(ctx.app).post(`${base}/regression/runs`).send({ suiteId: suite.body.data.id }).expect(201);
    await request(ctx.app).put(`${base}/provider/mock`).send({ ...reliable, memoryWindow: 0 }).expect(200);
    const second = await request(ctx.app).post(`${base}/regression/runs`).send({ suiteId: suite.body.data.id }).expect(201);
    expect(second.body.data.diff.results[0]).toMatchObject({ itemKey: expect.stringMatching(/^script:\d+$/), change: "new_failure" });
  });
});

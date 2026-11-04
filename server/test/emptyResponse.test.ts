import request from "supertest";
import { describe, expect, it } from "vitest";
import { RuleBasedEvaluator } from "../src/evaluators/ruleBasedEvaluator";
import { setup } from "./helpers";

/**
 * Dedicated empty-response scenario: the simulated chatbot is configured so that every reply is empty
 * (fault "empty" at a 100% fault rate). The rule-based evaluator must fail "Response present" and the test.
 */
const emptyReplyConfig = { mode: "knowledge-base", failureRate: 1, faults: ["empty"], seed: 1, memoryWindow: 4 };

const emptyResponseCase = {
  title: "Empty response",
  input: "How long does a refund take?",
  expected: "Refunds go to your original payment method within 5-7 business days.",
  criteria: { requiredKeywords: ["refund"] },
};

type Check = { id: string; label: string; outcome: string; detail: string };

describe("empty-response scenario", () => {
  it("fails the test when the simulated chatbot returns an empty response", async () => {
    const { app } = setup();
    const project = await request(app).post("/api/projects").send({ name: "Empty reply bot" }).expect(201);
    const base = `/api/projects/${project.body.data.id}`;

    await request(app).put(`${base}/provider/mock`).send(emptyReplyConfig).expect(200);
    const created = await request(app).post(`${base}/test-cases`).send(emptyResponseCase).expect(201);
    const run = await request(app).post(`${base}/test-cases/${created.body.data.id}/run`).expect(201);
    const execution = run.body.data;

    // The reply really is empty, and it is recorded as a simulated (mock) result with the injected fault.
    expect(execution.output).toBe("");
    expect(execution.source).toBe("mock");
    expect(execution.evaluator).toBe("rule-based");
    expect(execution.details.simulation.faultInjected).toBe("empty");

    // "Response present" is FAILED.
    const responsePresent = (execution.details.checks as Check[]).find((c) => c.label === "Response present");
    expect(responsePresent).toMatchObject({
      id: "non_empty",
      outcome: "fail",
      detail: "The chatbot returned an empty response.",
    });

    // The overall test status is FAILED.
    expect(execution.status).toBe("failed");
    expect(execution.effectiveStatus).toBe("failed");
    expect(execution.explanation).toContain("The chatbot returned an empty response.");

    // The stored execution says the same.
    const stored = await request(app).get(`${base}/executions/${execution.id}`).expect(200);
    expect(stored.body.data.status).toBe("failed");
    expect((stored.body.data.details.checks as Check[]).find((c) => c.id === "non_empty")?.outcome).toBe("fail");
  });

  it.each([
    ["an empty string", ""],
    ["whitespace only", "   \n\t "],
  ])("evaluator fails %s as a missing response", (_label, output) => {
    const result = new RuleBasedEvaluator().evaluate({
      output,
      expected: emptyResponseCase.expected,
      criteria: {
        matchMode: "keywords",
        requiredKeywords: [],
        forbiddenKeywords: [],
        minRelevance: 0,
        minLength: null,
        maxLength: null,
      },
    });
    // Even with no other criteria that could fail, an empty reply alone fails the test.
    expect(result.checks.find((c) => c.label === "Response present")?.outcome).toBe("fail");
    expect(result.status).toBe("failed");
  });
});

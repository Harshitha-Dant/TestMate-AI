import request from "supertest";
import { describe, expect, it } from "vitest";
import { setup } from "./helpers";

async function withProject(memoryWindow = 4) {
  const ctx = setup();
  const res = await request(ctx.app).post("/api/projects").send({ name: "Bot" }).expect(201);
  const base = `/api/projects/${res.body.data.id}`;
  await request(ctx.app)
    .put(`${base}/provider/mock`)
    .send({ mode: "knowledge-base", failureRate: 0, faults: [], seed: 1, memoryWindow })
    .expect(200);
  return { ...ctx, base };
}

const longChat = {
  title: "Long chat",
  turns: [
    { userMessage: "Hi, my name is Ravi." },
    { userMessage: "I live in Hyderabad." },
    { userMessage: "Where is my order?" },
    { userMessage: "Can I pay with UPI?" },
    { userMessage: "How long does delivery take?" },
    { userMessage: "What is my name?", expectation: { kind: "recall", mustInclude: ["Ravi"] } },
  ],
};

describe("conversation scripts API", () => {
  it("validates scripts and turn expectations", async () => {
    const { app, base } = await withProject();
    const tooShort = await request(app).post(`${base}/conversations`).send({ title: "x", turns: [{ userMessage: "hi" }] }).expect(400);
    expect(tooShort.body.error.details[0].path).toBe("turns");

    const badRecall = await request(app)
      .post(`${base}/conversations`)
      .send({ title: "x", turns: [{ userMessage: "hi" }, { userMessage: "name?", expectation: { kind: "recall" } }] })
      .expect(400);
    expect(badRecall.body.error.details[0].path).toBe("turns.1.expectation.mustInclude");
  });

  it("creates, updates (replacing turns) and deletes scripts", async () => {
    const { app, base } = await withProject();
    const created = await request(app).post(`${base}/conversations`).send(longChat).expect(201);
    expect(created.body.data.turns).toHaveLength(6);
    expect(created.body.data.turns[5]).toMatchObject({
      position: 6,
      expectation: { kind: "recall", mustInclude: ["Ravi"], mustIncludeAny: [], mustNotInclude: [] },
    });
    const id = created.body.data.id;

    const updated = await request(app)
      .put(`${base}/conversations/${id}`)
      .send({ ...longChat, title: "Short", turns: longChat.turns.slice(0, 2) })
      .expect(200);
    expect(updated.body.data).toMatchObject({ title: "Short" });
    expect(updated.body.data.turns).toHaveLength(2);

    const chatbotSuite = await request(app).post(`${base}/suites`).send({ module: "chatbot", name: "Q" }).expect(201);
    await request(app).put(`${base}/conversations/${id}`).send({ ...longChat, suiteId: chatbotSuite.body.data.id }).expect(400);

    await request(app).delete(`${base}/conversations/${id}`).expect(200);
    await request(app).get(`${base}/conversations/${id}`).expect(404);
  });
});

describe("running conversations", () => {
  it("passes when the fact is inside the memory window", async () => {
    const { app, base } = await withProject(5);
    const created = await request(app).post(`${base}/conversations`).send(longChat).expect(201);
    const run = await request(app).post(`${base}/conversations/${created.body.data.id}/run`).expect(201);
    expect(run.body.data).toMatchObject({ module: "memory", status: "passed", source: "mock", score: 100 });
    expect(run.body.data.details.memory.transcript[5]).toMatchObject({ reply: "Your name is Ravi.", visibleTurns: [1, 2, 3, 4, 5] });
  });

  it("shows the exact turn where memory failed and why", async () => {
    const { app, base } = await withProject(4);
    const created = await request(app).post(`${base}/conversations`).send(longChat).expect(201);
    const run = await request(app).post(`${base}/conversations/${created.body.data.id}/run`).expect(201);
    const { details, status, score, explanation } = run.body.data;
    expect(status).toBe("failed");
    expect(score).toBe(83);
    expect(details.memory.firstFailureTurn).toBe(6);
    expect(details.memory.transcript[5].visibleTurns).toEqual([2, 3, 4, 5]);
    expect(details.memory.transcript[5].issues[0].type).toBe("context_loss");
    expect(explanation).toContain("turn 6");
    expect(explanation).toContain("could only see turns 2–5");

    const script = await request(app).get(`${base}/conversations/${created.body.data.id}`).expect(200);
    expect(script.body.data.lastRun).toMatchObject({ status: "failed", firstFailureTurn: 6 });

    const history = await request(app).get(`${base}/executions?sessionId=${created.body.data.id}`).expect(200);
    expect(history.body.data.total).toBe(1);
  });

  it("runs a memory suite", async () => {
    const { app, base } = await withProject(4);
    const suite = await request(app).post(`${base}/suites`).send({ module: "memory", name: "Recall" }).expect(201);
    const suiteId = suite.body.data.id;
    await request(app).post(`${base}/conversations`).send({ ...longChat, suiteId }).expect(201);
    await request(app)
      .post(`${base}/conversations`)
      .send({ title: "Short", suiteId, turns: [longChat.turns[0], longChat.turns[5]] })
      .expect(201);
    const run = await request(app).post(`${base}/suites/${suiteId}/run`).expect(200);
    expect(run.body.data).toMatchObject({ total: 2, passed: 1, failed: 1 });
  });
});

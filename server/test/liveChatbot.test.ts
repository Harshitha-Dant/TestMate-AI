import http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setup } from "./helpers";

/** A tiny "real" chatbot: remembers a name from the conversation history and answers refund questions. */
let server: http.Server;
let url = "";
const received: { headers: http.IncomingHttpHeaders; body: { message: string; messages: { role: string; content: string }[] } }[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const body = JSON.parse(raw);
      received.push({ headers: req.headers, body });
      if (req.url === "/broken") {
        res.statusCode = 500;
        return res.end("oops");
      }
      const history = body.messages.map((m: { content: string }) => m.content).join(" ");
      const name = /my name is (\w+)/i.exec(history)?.[1];
      let reply = "I can help with orders.";
      if (/refund/i.test(body.message)) reply = "Refunds take 5-7 business days.";
      if (/what is my name/i.test(body.message)) reply = name ? `Your name is ${name}.` : "I don't remember your name.";
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ data: { reply } }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

async function withLiveBot(allowLocalhost = true, http: object = {}) {
  const ctx = setup();
  await request(ctx.app).put("/api/settings/api-studio").send({ allowLocalhost, timeoutMs: 3000, maxResponseKb: 64 }).expect(200);
  const p = await request(ctx.app).post("/api/projects").send({ name: "Live" }).expect(201);
  const base = `/api/projects/${p.body.data.id}`;
  await request(ctx.app)
    .put(`${base}/provider/target`)
    .send({ kind: "http", http: { url: `${url}/chat`, replyPath: "data.reply", sendHistory: true, ...http } })
    .expect(200);
  return { ...ctx, base };
}

describe("live HTTP chatbot", () => {
  it("runs chatbot tests against a live endpoint and labels results as live", async () => {
    const { app, base } = await withLiveBot();
    const tc = await request(app)
      .post(`${base}/test-cases`)
      .send({ title: "Refund", input: "How long does a refund take?", criteria: { requiredKeywords: ["5-7 business days"], forbiddenKeywords: ["guarantee"] } })
      .expect(201);
    const run = await request(app).post(`${base}/test-cases/${tc.body.data.id}/run`).expect(201);
    expect(run.body.data).toMatchObject({ status: "passed", source: "live", output: "Refunds take 5-7 business days.", details: { provider: { name: "http", mode: "http" } } });
    expect(run.body.data.details.simulation).toBeUndefined();
    // Simulation hints (expected answers, forbidden terms) are never sent to a real bot.
    expect(JSON.stringify(received.at(-1)!.body)).not.toContain("guarantee");
  });

  it("sends the conversation history so memory tests work", async () => {
    const { app, base } = await withLiveBot();
    const script = await request(app)
      .post(`${base}/conversations`)
      .send({ title: "Name", turns: [{ userMessage: "My name is Ravi." }, { userMessage: "What is my name?", expectation: { kind: "recall", mustInclude: ["Ravi"] } }] })
      .expect(201);
    const run = await request(app).post(`${base}/conversations/${script.body.data.id}/run`).expect(201);
    expect(run.body.data).toMatchObject({ status: "passed", source: "live" });
    expect(run.body.data.details.memory.memoryWindow).toBeNull();
    expect(received.at(-1)!.body.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
  });

  it("records SSRF blocks, HTTP errors and missing reply fields as errors", async () => {
    const blocked = await withLiveBot(false);
    const tc = await request(blocked.app).post(`${blocked.base}/test-cases`).send({ title: "t", input: "refund?", criteria: { requiredKeywords: ["x"] } }).expect(201);
    const run = await request(blocked.app).post(`${blocked.base}/test-cases/${tc.body.data.id}/run`).expect(201);
    expect(run.body.data).toMatchObject({ status: "error", source: "live" });
    expect(run.body.data.explanation).toContain("Blocked for safety");

    const broken = await withLiveBot(true, { url: `${url}/broken` });
    const tc2 = await request(broken.app).post(`${broken.base}/test-cases`).send({ title: "t", input: "refund?", criteria: { requiredKeywords: ["x"] } }).expect(201);
    const run2 = await request(broken.app).post(`${broken.base}/test-cases/${tc2.body.data.id}/run`).expect(201);
    expect(run2.body.data.explanation).toContain("HTTP 500");

    const wrongPath = await withLiveBot(true, { replyPath: "answer" });
    const tc3 = await request(wrongPath.app).post(`${wrongPath.base}/test-cases`).send({ title: "t", input: "refund?", criteria: { requiredKeywords: ["x"] } }).expect(201);
    const run3 = await request(wrongPath.app).post(`${wrongPath.base}/test-cases/${tc3.body.data.id}/run`).expect(201);
    expect(run3.body.data.explanation).toContain('no "answer" field');
  });

  it("only accepts secrets as {{secret:NAME}} and resolves them from the environment", async () => {
    const { app, base } = await withLiveBot();
    const literal = await request(app)
      .put(`${base}/provider/target`)
      .send({ kind: "http", http: { url: `${url}/chat`, replyPath: "data.reply", headers: [{ key: "Authorization", value: "Bearer abc", enabled: true }] } })
      .expect(400);
    expect(literal.body.error.message).toContain("{{secret:NAME}}");

    process.env.TESTMATE_SECRET_BOT_KEY = "k-123";
    try {
      await request(app)
        .put(`${base}/provider/target`)
        .send({ kind: "http", http: { url: `${url}/chat`, replyPath: "data.reply", headers: [{ key: "Authorization", value: "Bearer {{secret:BOT_KEY}}", enabled: true }] } })
        .expect(200);
      const tc = await request(app).post(`${base}/test-cases`).send({ title: "t", input: "refund?", criteria: { requiredKeywords: ["refund"] } }).expect(201);
      await request(app).post(`${base}/test-cases/${tc.body.data.id}/run`).expect(201);
      expect(received.at(-1)!.headers.authorization).toBe("Bearer k-123");
      const target = await request(app).get(`${base}/provider/target`).expect(200);
      expect(target.body.data.http.headers[0].value).toBe("Bearer {{secret:BOT_KEY}}");
    } finally {
      delete process.env.TESTMATE_SECRET_BOT_KEY;
    }

    // Switching back to the simulated bot works and needs no endpoint.
    await request(app).put(`${base}/provider/target`).send({ kind: "mock" }).expect(200);
    await request(app).put(`${base}/provider/target`).send({ kind: "http" }).expect(400);
  });
});

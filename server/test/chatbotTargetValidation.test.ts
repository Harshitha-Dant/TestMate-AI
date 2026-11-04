import request from "supertest";
import { describe, expect, it } from "vitest";
import { setup } from "./helpers";

async function project() {
  const { app } = setup();
  const res = await request(app).post("/api/projects").send({ name: "Target validation" }).expect(201);
  return { app, base: `/api/projects/${res.body.data.id}` };
}

const target = (headers: { key: string; value: string; enabled: boolean }[]) => ({
  kind: "http",
  http: { url: "https://bot.example.com/chat", headers },
});

describe("live chatbot target header validation", () => {
  it.each([
    ["a header name with CR/LF", "X\r\nInjected", "1"],
    ["a header name with a space", "Bad Name", "1"],
    ["a client-managed header", "Host", "evil.example.com"],
    ["a header value with a line break", "X-Trace", "a\r\nb"],
  ])("rejects %s", async (_label, key, value) => {
    const { app, base } = await project();
    const res = await request(app).put(`${base}/provider/target`).send(target([{ key, value, enabled: true }])).expect(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const saved = await request(app).get(`${base}/provider/target`).expect(200);
    expect(saved.body.data.kind).toBe("mock");
  });

  it("still accepts normal headers and secret placeholders", async () => {
    const { app, base } = await project();
    const res = await request(app)
      .put(`${base}/provider/target`)
      .send(target([{ key: "X-Client", value: "testmate", enabled: true }, { key: "Authorization", value: "Bearer {{secret:BOT_TOKEN}}", enabled: true }]))
      .expect(200);
    expect(res.body.data.http.headers).toHaveLength(2);
  });
});

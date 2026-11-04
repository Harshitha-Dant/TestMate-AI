import http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setup } from "./helpers";

let server: http.Server;
let target = "";
const seen: { headers: http.IncomingHttpHeaders; body: string }[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push({ headers: req.headers, body });
      const path = new URL(req.url ?? "/", "http://x").pathname;
      if (path === "/user") {
        res.setHeader("content-type", "application/json");
        res.setHeader("set-cookie", "session=xyz");
        return res.end(JSON.stringify({ id: 7, name: "Ravi", access_token: "live-token-123", tags: ["a"] }));
      }
      if (path === "/html") return res.end("<html>hi</html>");
      res.statusCode = 404;
      res.end("{}");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  target = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

async function withProject(allowLocalhost = true) {
  const ctx = setup();
  await request(ctx.app).put("/api/settings/api-studio").send({ allowLocalhost, timeoutMs: 3000, maxResponseKb: 64 }).expect(200);
  const res = await request(ctx.app).post("/api/projects").send({ name: "API" }).expect(201);
  return { ...ctx, base: `/api/projects/${res.body.data.id}/api-studio` };
}

const getUser = () => ({
  method: "GET",
  url: `${target}/user?api_key=k-999&q=1`,
  headers: [
    { key: "Authorization", value: "Bearer super-secret", enabled: true },
    { key: "Accept", value: "application/json", enabled: true },
    { key: "X-Disabled", value: "nope", enabled: false },
  ],
  expectations: { status: 200, maxTimeMs: null, fields: [{ path: "id", type: "number", equals: "7" }, { path: "name", type: "string", equals: "Ravi" }] },
});

describe("API Studio settings", () => {
  it("defaults to blocking localhost and validates updates", async () => {
    const { app } = setup();
    const defaults = await request(app).get("/api/settings/api-studio").expect(200);
    expect(defaults.body.data).toEqual({ allowLocalhost: false, timeoutMs: 10000, maxResponseKb: 1024 });
    await request(app).put("/api/settings/api-studio").send({ allowLocalhost: true, timeoutMs: 10, maxResponseKb: 64 }).expect(400);
  });
});

describe("sending requests", () => {
  it("sends a live request, evaluates it and stores only masked data", async () => {
    const { app, base, db } = await withProject();
    const res = await request(app).post(`${base}/send`).send(getUser()).expect(201);
    const { entry, execution } = res.body.data;

    // The real request carried the real secret and only enabled headers.
    const sent = seen[seen.length - 1]!;
    expect(sent.headers.authorization).toBe("Bearer super-secret");
    expect(sent.headers["x-disabled"]).toBeUndefined();
    expect(sent.headers["user-agent"]).toMatch(/TestMate-AI/);

    expect(execution).toMatchObject({ module: "api", status: "passed", source: "live", evaluator: "rule-based", score: 100 });
    expect(entry.response).toMatchObject({ status: 200, remoteAddress: "127.0.0.1" });
    expect(entry.headers[0].value).toBe("Bearer ••••••••");
    expect(entry.url).toBe(`${target}/user?api_key=••••••••&q=1`);
    expect(entry.response.headers).toContainEqual(["set-cookie", "••••••••"]);
    expect(JSON.parse(entry.response.body).access_token).toBe("••••••••");

    // Nothing secret reached the database.
    const dump = JSON.stringify(db.prepare("SELECT * FROM api_requests").all()) + JSON.stringify(db.prepare("SELECT * FROM test_executions").all());
    for (const secret of ["super-secret", "k-999", "live-token-123", "session=xyz"]) expect(dump).not.toContain(secret);
  });

  it("explains failed assertions", async () => {
    const { app, base } = await withProject();
    const res = await request(app)
      .post(`${base}/send`)
      .send({ ...getUser(), url: `${target}/html`, expectations: { status: 201, fields: [{ path: "id", type: "any", equals: null }] } })
      .expect(201);
    expect(res.body.data.execution.status).toBe("failed");
    expect(res.body.data.execution.explanation).toContain("Expected 201, got 200.");
    expect(res.body.data.execution.explanation).toContain("not valid JSON");
  });

  it("blocks internal targets and records the block as an error run", async () => {
    const { app, base } = await withProject(false);
    const local = await request(app).post(`${base}/send`).send(getUser()).expect(201);
    expect(local.body.data.entry.error).toMatchObject({ kind: "blocked" });
    expect(local.body.data.execution).toMatchObject({ status: "error", source: "live" });

    const meta = await request(app)
      .post(`${base}/send`)
      .send({ method: "GET", url: "http://169.254.169.254/latest/meta-data/iam/" })
      .expect(201);
    expect(meta.body.data.entry.error.message).toContain("cloud metadata endpoint");
    expect(seen.some((s) => s.headers.host?.startsWith("169.254"))).toBe(false);
  });

  it("rejects invalid JSON bodies, masked leftovers and missing secrets before sending", async () => {
    const { app, base } = await withProject();
    const count = seen.length;
    const badJson = await request(app).post(`${base}/send`).send({ method: "POST", url: `${target}/user`, bodyType: "json", body: "{oops" }).expect(201);
    expect(badJson.body.data.entry.error).toMatchObject({ kind: "invalid_request_body" });
    const masked = await request(app)
      .post(`${base}/send`)
      .send({ method: "GET", url: `${target}/user`, headers: [{ key: "Authorization", value: "Bearer ••••••••", enabled: true }] })
      .expect(201);
    expect(masked.body.data.entry.error.message).toContain("masked value");
    const missing = await request(app)
      .post(`${base}/send`)
      .send({ method: "GET", url: `${target}/user`, headers: [{ key: "Authorization", value: "Bearer {{secret:NOPE}}", enabled: true }] })
      .expect(201);
    expect(missing.body.data.entry.error.message).toContain("TESTMATE_SECRET_NOPE");
    expect(seen.length).toBe(count); // none of these reached the server
  });

  it("resolves {{secret:NAME}} from the server environment without storing it", async () => {
    const { app, base, db } = await withProject();
    process.env.TESTMATE_SECRET_TEST_TOKEN = "env-token-42";
    try {
      const res = await request(app)
        .post(`${base}/send`)
        .send({ method: "GET", url: `${target}/user`, headers: [{ key: "Authorization", value: "Bearer {{secret:TEST_TOKEN}}", enabled: true }] })
        .expect(201);
      expect(seen[seen.length - 1]!.headers.authorization).toBe("Bearer env-token-42");
      expect(res.body.data.entry.headers[0].value).toBe("Bearer {{secret:TEST_TOKEN}}");
      expect(JSON.stringify(db.prepare("SELECT * FROM api_requests").all())).not.toContain("env-token-42");
    } finally {
      delete process.env.TESTMATE_SECRET_TEST_TOKEN;
    }
  });

  it("validates headers and methods", async () => {
    const { app, base } = await withProject();
    const res = await request(app)
      .post(`${base}/send`)
      .send({ method: "GET", url: target, headers: [{ key: "Host", value: "evil", enabled: true }, { key: "X-Bad", value: "a\r\nInjected: 1", enabled: true }] })
      .expect(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(["headers.0.key", "headers.1.value"]);
    await request(app).post(`${base}/send`).send({ method: "TRACE", url: target }).expect(400);
  });
});

describe("history and saved requests", () => {
  it("lists, deletes and clears history", async () => {
    const { app, base } = await withProject();
    await request(app).post(`${base}/send`).send(getUser()).expect(201);
    const second = await request(app).post(`${base}/send`).send(getUser()).expect(201);
    const list = await request(app).get(`${base}/history`).expect(200);
    expect(list.body.data).toHaveLength(2);
    expect(list.body.data[0].lastRun.status).toBe("passed");
    await request(app).delete(`${base}/history/${second.body.data.entry.id}`).expect(200);
    const cleared = await request(app).delete(`${base}/history`).expect(200);
    expect(cleared.body.data.removed).toBe(1);
  });

  it("saves, runs and suite-runs saved requests", async () => {
    const { app, base } = await withProject();
    const projectBase = base.replace("/api-studio", "");
    const suite = await request(app).post(`${projectBase}/suites`).send({ module: "api", name: "Smoke" }).expect(201);
    await request(app).post(`${base}/saved`).send({ ...getUser(), name: "" }).expect(400);
    const saved = await request(app)
      .post(`${base}/saved`)
      .send({ ...getUser(), name: "Get user", headers: [{ key: "Accept", value: "application/json", enabled: true }], suiteId: suite.body.data.id })
      .expect(201);
    expect(saved.body.data).toMatchObject({ kind: "saved", name: "Get user", url: `${target}/user?api_key=••••••••&q=1` });

    // The saved URL holds a masked query value, so running it is refused until the value is re-entered.
    const blockedRun = await request(app).post(`${base}/saved/${saved.body.data.id}/run`).expect(201);
    expect(blockedRun.body.data.entry.error.kind).toBe("missing_secret");

    await request(app).put(`${base}/saved/${saved.body.data.id}`).send({ ...getUser(), name: "Get user", url: `${target}/user`, headers: [], suiteId: suite.body.data.id }).expect(200);
    const run = await request(app).post(`${projectBase}/suites/${suite.body.data.id}/run`).expect(200);
    expect(run.body.data).toMatchObject({ total: 1, passed: 1 });
    const savedList = await request(app).get(`${base}/saved`).expect(200);
    expect(savedList.body.data[0].lastRun).toBeNull(); // runs are recorded on history entries
    await request(app).delete(`${base}/saved/${saved.body.data.id}`).expect(200);
  });
});

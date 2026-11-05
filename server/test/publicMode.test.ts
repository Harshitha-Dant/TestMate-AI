import type { PublicLimits } from "@testmate/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { openDb } from "../src/db/connection";
import { migrate } from "../src/db/migrate";
import { adminKeyProblem, createPublicPolicy, MIN_ADMIN_KEY_LENGTH } from "../src/lib/publicMode";
import { RateLimiter } from "../src/lib/rateLimit";
import { setup } from "./helpers";

const ADMIN_KEY = "test-admin-key-0123456789abcdef";
const HEADER = "X-TestMate-Admin-Key";

function publicApp(limits: Partial<PublicLimits> = {}) {
  const db = openDb(":memory:");
  migrate(db);
  return { db, app: createApp(db, { publicMode: { adminKey: ADMIN_KEY, limits } }) };
}

async function project(app: ReturnType<typeof createApp>, name = "Bot") {
  const res = await request(app).post("/api/projects").send({ name }).expect(201);
  return res.body.data.id as number;
}

describe("public mode is off by default", () => {
  it("keeps local behaviour: no admin key, settings editable, no limits", async () => {
    const { app } = setup();
    const meta = await request(app).get("/api/meta").expect(200);
    expect(meta.body.data).toEqual({ publicMode: false, limits: null });

    const id = await project(app);
    await request(app).delete(`/api/projects/${id}`).expect(200);
    const saved = await request(app).put("/api/settings/api-studio").send({ allowLocalhost: true, timeoutMs: 30_000, maxResponseKb: 4096 }).expect(200);
    expect(saved.body.data).toEqual({ allowLocalhost: true, timeoutMs: 30_000, maxResponseKb: 4096 });
    expect((await request(app).get("/api/health")).headers["strict-transport-security"]).toBeUndefined();
  });
});

describe("admin key", () => {
  it("is validated at startup", () => {
    expect(adminKeyProblem(undefined)).toMatch(/not set/);
    expect(adminKeyProblem("short")).toMatch(String(MIN_ADMIN_KEY_LENGTH));
    expect(adminKeyProblem("x".repeat(30) + " y")).toMatch(/spaces/);
    expect(adminKeyProblem(ADMIN_KEY)).toBeNull();
    expect(() => createPublicPolicy({ adminKey: "short" })).toThrow();
  });

  it("is required for deletes, app-wide settings and removing demo data", async () => {
    const { app } = publicApp();
    const id = await project(app);

    const denied = await request(app).delete(`/api/projects/${id}`).expect(403);
    expect(denied.body.error.code).toBe("ADMIN_REQUIRED");
    expect(denied.body.error.message).toMatch(/Settings → Admin access/);
    await request(app).delete(`/api/projects/${id}`).set(HEADER, "wrong-key-wrong-key-wrong-key").expect(403);
    await request(app).put("/api/settings/preferences").send({}).expect(403);
    await request(app).put("/api/settings/api-studio").send({ allowLocalhost: false, timeoutMs: 5000, maxResponseKb: 64 }).expect(403);
    await request(app).delete("/api/demo").expect(403);

    await request(app).delete(`/api/projects/${id}`).set(HEADER, ADMIN_KEY).expect(200);
  });

  it("leaves viewing, creating and running open to visitors", async () => {
    const { app } = publicApp();
    const id = await project(app);
    const base = `/api/projects/${id}`;
    const tc = await request(app).post(`${base}/test-cases`).send({ title: "Refund", input: "How long does a refund take?", criteria: { requiredKeywords: ["refund"] } }).expect(201);
    await request(app).post(`${base}/test-cases/${tc.body.data.id}/run`).expect(201);
    await request(app).get(`${base}/executions`).expect(200);
    await request(app).put(`${base}/test-cases/${tc.body.data.id}`).send({ title: "Refund 2", input: "How long does a refund take?", criteria: { requiredKeywords: ["refund"] } }).expect(200);
    await request(app).get(`${base}/reports/executions.csv`).expect(200);
  });

  it("is checked by /api/admin/check and never returned in any response", async () => {
    const { app } = publicApp();
    await request(app).get("/api/admin/check").expect(403);
    const ok = await request(app).get("/api/admin/check").set(HEADER, ADMIN_KEY).expect(200);
    expect(ok.body.data).toEqual({ admin: true });
    for (const path of ["/api/meta", "/api/admin/check", "/api/settings/api-studio", "/api/settings/preferences", "/api/projects"]) {
      const res = await request(app).get(path).set(HEADER, ADMIN_KEY);
      expect(JSON.stringify(res.body)).not.toContain(ADMIN_KEY);
      expect(JSON.stringify(res.headers)).not.toContain(ADMIN_KEY);
    }
  });

  it("limits wrong-key guesses to 5 a minute per visitor", async () => {
    const { app } = publicApp();
    for (let i = 0; i < 5; i++) await request(app).get("/api/admin/check").set(HEADER, `guess-${i}-xxxxxxxxxxxxxxxxxxxx`).expect(403);
    const blocked = await request(app).get("/api/admin/check").set(HEADER, "guess-6-xxxxxxxxxxxxxxxxxxxx").expect(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
  });
});

describe("request-safety settings are locked", () => {
  it("forces localhost off and clamps timeout and size, even with the admin key", async () => {
    const { app } = publicApp();
    const saved = await request(app)
      .put("/api/settings/api-studio")
      .set(HEADER, ADMIN_KEY)
      .send({ allowLocalhost: true, timeoutMs: 60_000, maxResponseKb: 10_240 })
      .expect(200);
    expect(saved.body.data).toEqual({ allowLocalhost: false, timeoutMs: 8_000, maxResponseKb: 256 });
    expect((await request(app).get("/api/settings/api-studio")).body.data.allowLocalhost).toBe(false);
  });

  it("still blocks loopback requests in API Studio", async () => {
    const { app } = publicApp();
    const id = await project(app);
    const res = await request(app).post(`/api/projects/${id}/api-studio/send`).send({ method: "GET", url: "http://127.0.0.1:9/" }).expect(201);
    expect(res.body.data.entry.error.kind).toBe("blocked");
  });
});

describe("rate limits", () => {
  it("limits runs per visitor with 429 and Retry-After", async () => {
    const { app } = publicApp({ runsPerMinute: 2 });
    const id = await project(app);
    const base = `/api/projects/${id}`;
    const tc = await request(app).post(`${base}/test-cases`).send({ title: "Hi", input: "hello", criteria: { requiredKeywords: ["hi"] } }).expect(201);
    await request(app).post(`${base}/test-cases/${tc.body.data.id}/run`).expect(201);
    await request(app).post(`${base}/test-cases/${tc.body.data.id}/run`).expect(201);
    const limited = await request(app).post(`${base}/test-cases/${tc.body.data.id}/run`).expect(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
    expect(limited.headers["retry-after"]).toBeDefined();
    await request(app).get(`${base}/executions`).expect(200); // reading is never limited
  });

  it("limits other changes per visitor", async () => {
    const { app } = publicApp({ writesPerMinute: 3 });
    await project(app, "A");
    await project(app, "B");
    await project(app, "C");
    await request(app).post("/api/projects").send({ name: "D" }).expect(429);
  });

  it("caps requests to other servers for all visitors together", async () => {
    const { app } = publicApp({ outboundPerHour: 2 });
    const id = await project(app);
    const send = () => request(app).post(`/api/projects/${id}/api-studio/send`).send({ method: "GET", url: "http://10.0.0.1/" });
    expect((await send()).status).toBe(201);
    expect((await send()).status).toBe(201);
    const capped = await send().expect(429);
    expect(capped.body.error.message).toMatch(/hourly limit/);
  });

  it("does not count simulated chatbot runs as requests to other servers", async () => {
    const { app } = publicApp({ outboundPerHour: 1 });
    const id = await project(app);
    const base = `/api/projects/${id}`;
    const tc = await request(app).post(`${base}/test-cases`).send({ title: "Hi", input: "hello", criteria: { requiredKeywords: ["hi"] } }).expect(201);
    for (let i = 0; i < 3; i++) await request(app).post(`${base}/test-cases/${tc.body.data.id}/run`).expect(201);
  });

  it("uses fixed windows that reset", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    expect(limiter.hit("a").allowed).toBe(true);
    expect(limiter.hit("a").allowed).toBe(true);
    expect(limiter.hit("a")).toEqual({ allowed: false, retryAfterSec: 1 });
    expect(limiter.hit("b").allowed).toBe(true);
    now = 1000;
    expect(limiter.hit("a").allowed).toBe(true);
  });
});

describe("growth limit and headers", () => {
  it("caps the number of projects", async () => {
    const { app } = publicApp({ maxProjects: 2 });
    await project(app, "A");
    await project(app, "B");
    const res = await request(app).post("/api/projects").send({ name: "C" }).expect(403);
    expect(res.body.error.code).toBe("LIMIT_REACHED");
  });

  it("reports public mode and limits, and sends security headers", async () => {
    const { app } = publicApp();
    const meta = await request(app).get("/api/meta").expect(200);
    expect(meta.body.data.publicMode).toBe(true);
    expect(meta.body.data.limits).toMatchObject({ runsPerMinute: 20, writesPerMinute: 60, outboundPerHour: 300, maxProjects: 25 });
    expect(meta.headers["x-content-type-options"]).toBe("nosniff");
    expect(meta.headers["x-frame-options"]).toBe("DENY");
    expect(meta.headers["strict-transport-security"]).toMatch(/max-age=/);
  });
});

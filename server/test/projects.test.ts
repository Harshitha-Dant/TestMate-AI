import request from "supertest";
import { describe, expect, it } from "vitest";
import { setup } from "./helpers";

describe("projects API", () => {
  it("runs the full CRUD cycle", async () => {
    const { app } = setup();

    const empty = await request(app).get("/api/projects").expect(200);
    expect(empty.body).toEqual({ ok: true, data: [] });

    const created = await request(app)
      .post("/api/projects")
      .send({ name: "  Support Bot  ", description: "Customer support assistant" })
      .expect(201);
    expect(created.body.data).toMatchObject({
      name: "Support Bot",
      description: "Customer support assistant",
      isDemo: false,
      stats: { suites: 0, testCases: 0, executions: 0, openBugs: 0 },
    });
    const id = created.body.data.id as number;

    const updated = await request(app).patch(`/api/projects/${id}`).send({ name: "Support Bot v2" }).expect(200);
    expect(updated.body.data.name).toBe("Support Bot v2");
    expect(updated.body.data.description).toBe("Customer support assistant");

    await request(app).get(`/api/projects/${id}`).expect(200);
    await request(app).delete(`/api/projects/${id}`).expect(200);
    const gone = await request(app).get(`/api/projects/${id}`).expect(404);
    expect(gone.body.error.code).toBe("NOT_FOUND");
  });

  it("rejects invalid input with a validation error", async () => {
    const { app } = setup();
    const res = await request(app).post("/api/projects").send({ name: "   " }).expect(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].path).toBe("name");

    await request(app).patch("/api/projects/1").send({}).expect(400);
    await request(app).get("/api/projects/abc").expect(400);
  });

  it("rejects duplicate names case-insensitively", async () => {
    const { app } = setup();
    await request(app).post("/api/projects").send({ name: "Alpha" }).expect(201);
    const dup = await request(app).post("/api/projects").send({ name: "alpha" }).expect(409);
    expect(dup.body.error.code).toBe("CONFLICT");
  });

  it("returns a JSON error for malformed bodies and unknown routes", async () => {
    const { app } = setup();
    const bad = await request(app)
      .post("/api/projects")
      .set("Content-Type", "application/json")
      .send("{not json")
      .expect(400);
    expect(bad.body.error.message).toMatch(/not valid JSON/);

    const missing = await request(app).get("/api/nope").expect(404);
    expect(missing.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when deleting a missing project", async () => {
    const { app } = setup();
    await request(app).delete("/api/projects/42").expect(404);
  });
});

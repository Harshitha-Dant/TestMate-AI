import request from "supertest";
import { describe, expect, it } from "vitest";
import { setup } from "./helpers";

describe("request body errors", () => {
  it("answers 413 with the API envelope when the JSON body is over 1 MB", async () => {
    const { app } = setup();
    const res = await request(app)
      .post("/api/projects")
      .set("content-type", "application/json")
      .send(JSON.stringify({ name: "Big", description: "y".repeat(1_200_000) }))
      .expect(413);
    expect(res.body).toEqual({ ok: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large (limit 1 MB)" } });
  });

  it("answers 4xx, not 500, for a body in an unsupported encoding", async () => {
    const { app } = setup();
    const res = await request(app)
      .post("/api/projects")
      .set("content-type", "application/json")
      .set("content-encoding", "x-unknown")
      .send(JSON.stringify({ name: "x" }));
    expect(res.status).toBe(415);
    expect(res.body.ok).toBe(false);
  });

  it("still answers 400 for malformed JSON", async () => {
    const { app } = setup();
    const res = await request(app).post("/api/projects").set("content-type", "application/json").send("{not json").expect(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });
});

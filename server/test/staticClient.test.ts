import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { openDb } from "../src/db/connection";
import { migrate } from "../src/db/migrate";

describe("serving the built client", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "testmate-client-"));
  fs.writeFileSync(path.join(dir, "index.html"), "<!doctype html><title>TestMate AI</title>");
  fs.writeFileSync(path.join(dir, "app.js"), "console.log(1)");
  const db = openDb(":memory:");
  migrate(db);
  const app = createApp(db, { clientDir: dir });
  afterAll(() => {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("serves assets and falls back to index.html for app routes", async () => {
    expect((await request(app).get("/app.js")).text).toContain("console.log");
    const deep = await request(app).get("/regression?run=2");
    expect(deep.status).toBe(200);
    expect(deep.text).toContain("<title>TestMate AI</title>");
  });

  it("keeps API 404s as JSON envelopes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });
});

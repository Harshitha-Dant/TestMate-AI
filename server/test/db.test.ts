import { describe, expect, it } from "vitest";
import { migrate } from "../src/db/migrate";
import { clearDemo, DEMO_PROJECT_NAME, seedDemo } from "../src/db/seed";
import { setup } from "./helpers";

describe("migrations", () => {
  it("creates every table and is idempotent", () => {
    const { db } = setup();
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
      (t) => t.name,
    );
    for (const t of [
      "projects", "test_suites", "test_cases", "test_executions", "conversation_sessions", "conversation_turns",
      "api_requests", "bug_reports", "bug_history", "regression_runs", "regression_results", "app_settings",
    ]) {
      expect(tables).toContain(t);
    }
    expect(migrate(db)).toEqual([]);
  });

  it("enforces foreign keys", () => {
    const { db } = setup();
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
    expect(() =>
      db.prepare("INSERT INTO test_suites (project_id, module, name) VALUES (999, 'chatbot', 'x')").run(),
    ).toThrow(/FOREIGN KEY/);
  });

  it("cascades project deletion to scoped rows", async () => {
    const { db } = setup();
    const { projectId } = await seedDemo(db);
    db.prepare("DELETE FROM projects WHERE id = ?").run(projectId);
    for (const table of ["test_suites", "test_cases", "test_executions"]) {
      expect(db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()).toEqual({ n: 0 });
    }
  });
});

describe("demo seed", () => {
  it("seeds once, labels data as demo, and clears only demo rows", async () => {
    const { db } = setup();
    db.prepare("INSERT INTO projects (name) VALUES ('My real project')").run();

    expect((await seedDemo(db)).created).toBe(true);
    expect((await seedDemo(db)).created).toBe(false);
    // Demo executions come from really running the demo cases through the mock provider.
    const runs = db.prepare("SELECT COUNT(*) AS n, MIN(source) AS src, MIN(is_demo) AS demo FROM test_executions").get();
    expect(runs).toEqual({ n: 37, src: "mock", demo: 1 }); // 21 lab runs + 2 regression runs of the 8-case chatbot suite
    const demo = db.prepare("SELECT is_demo FROM projects WHERE name = ?").get(DEMO_PROJECT_NAME);
    expect(demo).toEqual({ is_demo: 1 });

    const removed = clearDemo(db);
    expect(removed.projects).toBe(1);
    expect(removed.test_suites).toBe(4);
    expect(removed.test_executions).toBe(37);
    expect(removed.regression_runs).toBe(2);
    expect(removed.bug_reports).toBe(3); // 2 opened by the v1.1 regression + 1 reported by hand
    expect(removed.conversation_sessions).toBe(5);
    const names = (db.prepare("SELECT name FROM projects").all() as { name: string }[]).map((p) => p.name);
    expect(names).toEqual(["My real project"]);
  });
});

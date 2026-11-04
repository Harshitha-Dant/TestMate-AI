import type { ConversationScript, ConversationTurn, ExecutionStatus, TurnExpectation } from "@testmate/shared";
import type { Db } from "../connection";
import { parseJson } from "../json";

interface ScriptRow {
  id: number;
  project_id: number;
  suite_id: number | null;
  title: string;
  description: string;
  is_demo: number;
  created_at: string;
  updated_at: string;
  last_exec_id: number | null;
  last_status: ExecutionStatus | null;
  last_run_at: string | null;
  last_first_failure: number | null;
}

interface TurnRow {
  session_id: number;
  position: number;
  user_message: string;
  expectation: string;
}

const EMPTY_EXPECTATION: TurnExpectation = { kind: "statement", mustInclude: [], mustIncludeAny: [], mustNotInclude: [] };

const SELECT = `
  SELECT s.*, e.id AS last_exec_id, COALESCE(e.override_status, e.status) AS last_status, e.created_at AS last_run_at,
    json_extract(e.details, '$.memory.firstFailureTurn') AS last_first_failure
  FROM conversation_sessions s
  LEFT JOIN test_executions e
    ON e.id = (SELECT MAX(x.id) FROM test_executions x WHERE x.session_id = s.id)`;

function withTurns(db: Db, rows: ScriptRow[]): ConversationScript[] {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const turnRows = db
    .prepare(`SELECT * FROM conversation_turns WHERE session_id IN (${ids.map(() => "?").join(",")}) ORDER BY position`)
    .all(...ids) as TurnRow[];
  const bySession = new Map<number, ConversationTurn[]>();
  for (const t of turnRows) {
    const list = bySession.get(t.session_id) ?? [];
    list.push({
      position: t.position,
      userMessage: t.user_message,
      expectation: { ...EMPTY_EXPECTATION, ...parseJson<Partial<TurnExpectation>>(t.expectation, {}) },
    });
    bySession.set(t.session_id, list);
  }
  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    suiteId: r.suite_id,
    title: r.title,
    description: r.description,
    turns: bySession.get(r.id) ?? [],
    isDemo: r.is_demo === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    lastRun:
      r.last_exec_id && r.last_status && r.last_run_at
        ? { executionId: r.last_exec_id, status: r.last_status, at: r.last_run_at, firstFailureTurn: r.last_first_failure }
        : null,
  }));
}

export interface ScriptWrite {
  suiteId: number | null;
  title: string;
  description: string;
  turns: { userMessage: string; expectation: TurnExpectation }[];
  isDemo?: boolean;
}

function insertTurns(db: Db, sessionId: number, turns: ScriptWrite["turns"]): void {
  const stmt = db.prepare("INSERT INTO conversation_turns (session_id, position, user_message, expectation) VALUES (?, ?, ?, ?)");
  turns.forEach((t, i) => stmt.run(sessionId, i + 1, t.userMessage, JSON.stringify(t.expectation)));
}

export const conversationRepo = {
  list(db: Db, projectId: number, suiteId?: number | "none"): ConversationScript[] {
    const where = ["s.project_id = ?"];
    const params: number[] = [projectId];
    if (suiteId === "none") where.push("s.suite_id IS NULL");
    else if (suiteId !== undefined) {
      where.push("s.suite_id = ?");
      params.push(suiteId);
    }
    return withTurns(db, db.prepare(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY s.id`).all(...params) as ScriptRow[]);
  },

  get(db: Db, projectId: number, id: number): ConversationScript | undefined {
    const row = db.prepare(`${SELECT} WHERE s.project_id = ? AND s.id = ?`).get(projectId, id) as ScriptRow | undefined;
    return row ? withTurns(db, [row])[0] : undefined;
  },

  create(db: Db, projectId: number, input: ScriptWrite): number {
    return db.transaction(() => {
      const id = Number(
        db
          .prepare("INSERT INTO conversation_sessions (project_id, suite_id, title, description, is_demo) VALUES (?, ?, ?, ?, ?)")
          .run(projectId, input.suiteId, input.title, input.description, input.isDemo ? 1 : 0).lastInsertRowid,
      );
      insertTurns(db, id, input.turns);
      return id;
    })();
  },

  /** Replaces the script's turns wholesale; past runs keep their own transcript copy. */
  update(db: Db, projectId: number, id: number, input: ScriptWrite): void {
    db.transaction(() => {
      db.prepare(
        `UPDATE conversation_sessions SET suite_id = ?, title = ?, description = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE project_id = ? AND id = ?`,
      ).run(input.suiteId, input.title, input.description, projectId, id);
      db.prepare("DELETE FROM conversation_turns WHERE session_id = ?").run(id);
      insertTurns(db, id, input.turns);
    })();
  },

  remove(db: Db, projectId: number, id: number): boolean {
    return db.prepare("DELETE FROM conversation_sessions WHERE project_id = ? AND id = ?").run(projectId, id).changes > 0;
  },
};

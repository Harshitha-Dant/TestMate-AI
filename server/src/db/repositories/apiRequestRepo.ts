import type {
  ApiCallError,
  ApiErrorKind,
  ApiExpectations,
  ApiHistoryEntry,
  ApiResponseData,
  BodyType,
  ExecutionStatus,
  HeaderEntry,
  HttpMethod,
} from "@testmate/shared";
import type { Db } from "../connection";
import { parseJson } from "../json";

interface Row {
  id: number;
  project_id: number;
  suite_id: number | null;
  kind: "history" | "saved";
  name: string;
  method: HttpMethod;
  url: string;
  headers: string;
  body_type: BodyType;
  body: string | null;
  assertions: string;
  response_status: number | null;
  response_time_ms: number | null;
  response_headers: string | null;
  response_body: string | null;
  response_meta: string | null;
  error_kind: ApiErrorKind | null;
  error_message: string | null;
  is_demo: number;
  created_at: string;
  last_exec_id: number | null;
  last_status: ExecutionStatus | null;
  last_run_at: string | null;
}

const EMPTY_EXPECTATIONS: ApiExpectations = { status: null, maxTimeMs: null, fields: [] };

const SELECT = `
  SELECT a.*, e.id AS last_exec_id, COALESCE(e.override_status, e.status) AS last_status, e.created_at AS last_run_at
  FROM api_requests a
  LEFT JOIN test_executions e ON e.id = (SELECT MAX(x.id) FROM test_executions x WHERE x.api_request_id = a.id)`;

type Meta = Pick<ApiResponseData, "statusText" | "bodyBytes" | "truncated" | "contentType" | "redirects" | "remoteAddress">;

const toEntry = (r: Row): ApiHistoryEntry => {
  const meta = parseJson<Partial<Meta>>(r.response_meta, {});
  const response: ApiResponseData | null =
    r.response_status === null
      ? null
      : {
          status: r.response_status,
          statusText: meta.statusText ?? "",
          timeMs: r.response_time_ms ?? 0,
          headers: parseJson<[string, string][]>(r.response_headers, []),
          body: r.response_body ?? "",
          bodyBytes: meta.bodyBytes ?? 0,
          truncated: meta.truncated ?? false,
          contentType: meta.contentType ?? null,
          redirects: meta.redirects ?? [],
          remoteAddress: meta.remoteAddress ?? null,
        };
  const error: ApiCallError | null = r.error_kind ? { kind: r.error_kind, message: r.error_message ?? "" } : null;
  return {
    id: r.id,
    projectId: r.project_id,
    kind: r.kind,
    suiteId: r.suite_id,
    name: r.name,
    method: r.method,
    url: r.url,
    headers: parseJson<HeaderEntry[]>(r.headers, []),
    bodyType: r.body_type,
    body: r.body ?? "",
    expectations: { ...EMPTY_EXPECTATIONS, ...parseJson<Partial<ApiExpectations>>(r.assertions, {}) },
    response,
    error,
    lastRun: r.last_exec_id && r.last_status && r.last_run_at ? { executionId: r.last_exec_id, status: r.last_status, at: r.last_run_at } : null,
    isDemo: r.is_demo === 1,
    createdAt: r.created_at,
  };
};

/** Values must already be masked: this repository stores exactly what it is given. */
export interface ApiRequestWrite {
  kind: "history" | "saved";
  suiteId: number | null;
  name: string;
  method: HttpMethod;
  url: string;
  headers: HeaderEntry[];
  bodyType: BodyType;
  body: string;
  expectations: ApiExpectations;
  response?: ApiResponseData | null;
  error?: ApiCallError | null;
  isDemo?: boolean;
}

export const apiRequestRepo = {
  list(db: Db, projectId: number, kind: "history" | "saved", opts: { limit?: number; suiteId?: number | "none" } = {}): ApiHistoryEntry[] {
    const where = ["a.project_id = ?", "a.kind = ?"];
    const params: (string | number)[] = [projectId, kind];
    if (opts.suiteId === "none") where.push("a.suite_id IS NULL");
    else if (opts.suiteId !== undefined) {
      where.push("a.suite_id = ?");
      params.push(opts.suiteId);
    }
    const order = kind === "history" ? "a.id DESC" : "a.name COLLATE NOCASE, a.id";
    const rows = db
      .prepare(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ?`)
      .all(...params, opts.limit ?? 500) as Row[];
    return rows.map(toEntry);
  },

  get(db: Db, projectId: number, id: number): ApiHistoryEntry | undefined {
    const row = db.prepare(`${SELECT} WHERE a.project_id = ? AND a.id = ?`).get(projectId, id) as Row | undefined;
    return row && toEntry(row);
  },

  insert(db: Db, projectId: number, w: ApiRequestWrite): number {
    const r = w.response ?? null;
    const meta: Meta | null = r
      ? { statusText: r.statusText, bodyBytes: r.bodyBytes, truncated: r.truncated, contentType: r.contentType, redirects: r.redirects, remoteAddress: r.remoteAddress }
      : null;
    return Number(
      db
        .prepare(
          `INSERT INTO api_requests (project_id, suite_id, kind, name, method, url, headers, body_type, body, assertions,
             response_status, response_time_ms, response_headers, response_body, response_meta, error_kind, error_message, is_demo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          projectId,
          w.suiteId,
          w.kind,
          w.name,
          w.method,
          w.url,
          JSON.stringify(w.headers),
          w.bodyType,
          w.body,
          JSON.stringify(w.expectations),
          r?.status ?? null,
          r?.timeMs ?? null,
          r ? JSON.stringify(r.headers) : null,
          r?.body ?? null,
          meta ? JSON.stringify(meta) : null,
          w.error?.kind ?? null,
          w.error?.message ?? null,
          w.isDemo ? 1 : 0,
        ).lastInsertRowid,
    );
  },

  updateSaved(db: Db, projectId: number, id: number, w: ApiRequestWrite): void {
    db.prepare(
      `UPDATE api_requests SET suite_id = ?, name = ?, method = ?, url = ?, headers = ?, body_type = ?, body = ?, assertions = ?
       WHERE project_id = ? AND id = ? AND kind = 'saved'`,
    ).run(w.suiteId, w.name, w.method, w.url, JSON.stringify(w.headers), w.bodyType, w.body, JSON.stringify(w.expectations), projectId, id);
  },

  remove(db: Db, projectId: number, id: number, kind: "history" | "saved"): boolean {
    return db.prepare("DELETE FROM api_requests WHERE project_id = ? AND id = ? AND kind = ?").run(projectId, id, kind).changes > 0;
  },

  /** Removes all history entries; their executions stay in Test History (api_request_id is set to NULL). */
  clearHistory(db: Db, projectId: number): number {
    return db.prepare("DELETE FROM api_requests WHERE project_id = ? AND kind = 'history'").run(projectId).changes;
  },
};

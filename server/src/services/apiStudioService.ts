import type { ApiCallError, ApiHistoryEntry, ApiRequestInput, ApiResponseData, Execution } from "@testmate/shared";
import type { Db } from "../db/connection";
import { apiRequestRepo } from "../db/repositories/apiRequestRepo";
import { executionRepo } from "../db/repositories/executionRepo";
import { evaluateApiResponse } from "../evaluators/apiEvaluator";
import { notFound } from "../lib/errors";
import { SafeHttpError } from "../lib/safeHttp/errors";
import { safeRequest, type SafeRequestOptions } from "../lib/safeHttp/safeRequest";
import { containsMask, maskHeaderPairs, maskHeaders, maskJsonSecrets, maskUrl, resolveSecrets } from "../lib/secrets";
import { settingsService } from "./settingsService";
import { suiteService } from "./suiteService";

const USER_AGENT = "TestMate-AI/0.1 (API Studio)";
/** Stored copies are capped so history stays small; the live check uses the full (size-capped) body. */
const MAX_STORED_BODY = 200_000;
const MAX_EXECUTION_OUTPUT = 20_000;

export interface SendResult {
  entry: ApiHistoryEntry;
  execution: Execution;
}

function describeRequest(input: ApiRequestInput): string {
  if (input.name.trim()) return input.name.trim();
  try {
    const u = new URL(input.url);
    return `${input.method} ${u.host}${u.pathname}`;
  } catch {
    return `${input.method} ${input.url}`;
  }
}

/** Builds the real outgoing request: enabled headers, resolved {{secret:...}} values, validated body. */
function prepare(input: ApiRequestInput): { url: string; headers: Record<string, string>; body?: string } {
  const headers: Record<string, string> = {};
  for (const h of input.headers) {
    if (!h.enabled || !h.key.trim()) continue;
    if (containsMask(h.value)) {
      throw new SafeHttpError(
        "missing_secret",
        `Header "${h.key}" still holds a masked value from history. Re-enter it, or use {{secret:NAME}} with a server-side TESTMATE_SECRET_NAME.`,
      );
    }
    headers[h.key.trim().toLowerCase()] = resolveSecrets(h.value);
  }
  if (containsMask(input.url)) {
    throw new SafeHttpError("missing_secret", "The URL still holds a masked query value from history. Re-enter it or use {{secret:NAME}}.");
  }
  const url = resolveSecrets(input.url);
  headers["user-agent"] ??= USER_AGENT;

  const sendsBody = input.bodyType !== "none" && input.body.length > 0 && input.method !== "GET";
  if (!sendsBody) return { url, headers };
  if (containsMask(input.body)) {
    throw new SafeHttpError("missing_secret", "The body still holds masked values from history. Re-enter them or use {{secret:NAME}}.");
  }
  const body = resolveSecrets(input.body);
  if (input.bodyType === "json") {
    try {
      JSON.parse(body);
    } catch (err) {
      throw new SafeHttpError("invalid_request_body", `Request body is not valid JSON: ${(err as Error).message}`);
    }
    headers["content-type"] ??= "application/json";
  } else {
    headers["content-type"] ??= "text/plain; charset=utf-8";
  }
  return { url, headers, body };
}

export const apiStudioService = {
  /** Sends the request through the SSRF-safe client, evaluates it, and stores a masked history entry + execution. */
  async send(
    db: Db,
    projectId: number,
    input: ApiRequestInput,
    opts: { isDemo?: boolean; regressionRunId?: number | null; transport?: Partial<SafeRequestOptions> } = {},
  ): Promise<SendResult> {
    if (input.suiteId) suiteService.assertInModule(db, projectId, input.suiteId, "api");
    const settings = settingsService.getApiStudio(db);
    const started = performance.now();

    let response: ApiResponseData | null = null;
    let liveBody = "";
    let error: ApiCallError | null = null;
    try {
      const req = prepare(input);
      const res = await safeRequest(
        { method: input.method, ...req },
        { allowLocalhost: settings.allowLocalhost, timeoutMs: settings.timeoutMs, maxBytes: settings.maxResponseKb * 1024, ...opts.transport },
      );
      liveBody = res.body;
      response = {
        ...res,
        headers: maskHeaderPairs(res.headers),
        body: maskJsonSecrets(res.body).slice(0, MAX_STORED_BODY),
      };
    } catch (err) {
      if (!(err instanceof SafeHttpError)) throw err;
      error = { kind: err.kind, message: err.message };
    }

    const maskedUrl = maskUrl(input.url);
    const entryId = apiRequestRepo.insert(db, projectId, {
      kind: "history",
      suiteId: input.suiteId ?? null,
      name: input.name.trim(),
      method: input.method,
      url: maskedUrl,
      headers: maskHeaders(input.headers),
      bodyType: input.bodyType,
      body: maskJsonSecrets(input.body).slice(0, MAX_STORED_BODY),
      expectations: input.expectations,
      response,
      error,
      isDemo: opts.isDemo,
    });

    const evaluation = response
      ? evaluateApiResponse({ ...response, body: liveBody, expectations: input.expectations })
      : null;
    const executionId = executionRepo.insert(db, projectId, {
      module: "api",
      apiRequestId: entryId,
      regressionRunId: opts.regressionRunId ?? null,
      title: describeRequest(input),
      status: evaluation?.status ?? "error",
      score: evaluation?.score ?? null,
      // API Studio makes real HTTP calls, so its results are live, never simulated.
      source: "live",
      evaluator: "rule-based",
      input: `${input.method} ${maskedUrl}`,
      output: response ? response.body.slice(0, MAX_EXECUTION_OUTPUT) : (error?.message ?? ""),
      explanation: evaluation?.explanation ?? error?.message ?? "",
      details: {
        checks: evaluation?.checks,
        http: {
          method: input.method,
          url: maskedUrl,
          status: response?.status ?? null,
          timeMs: response?.timeMs ?? null,
          errorKind: error?.kind ?? null,
        },
      },
      durationMs: Math.round(performance.now() - started),
      isDemo: opts.isDemo,
    });

    return { entry: apiRequestRepo.get(db, projectId, entryId)!, execution: executionRepo.get(db, projectId, executionId)! };
  },

  history: (db: Db, projectId: number, limit = 50) => apiRequestRepo.list(db, projectId, "history", { limit }),

  removeHistory(db: Db, projectId: number, id: number): void {
    if (!apiRequestRepo.remove(db, projectId, id, "history")) throw notFound("History entry");
  },

  clearHistory: (db: Db, projectId: number) => ({ removed: apiRequestRepo.clearHistory(db, projectId) }),

  listSaved: (db: Db, projectId: number, suiteId?: number | "none") => apiRequestRepo.list(db, projectId, "saved", { suiteId }),

  getSaved(db: Db, projectId: number, id: number): ApiHistoryEntry {
    const entry = apiRequestRepo.get(db, projectId, id);
    if (!entry || entry.kind !== "saved") throw notFound("Saved request");
    return entry;
  },

  /** Saved requests are stored masked too; secret values must come from {{secret:NAME}} placeholders. */
  createSaved(db: Db, projectId: number, input: ApiRequestInput, opts: { isDemo?: boolean } = {}): ApiHistoryEntry {
    if (input.suiteId) suiteService.assertInModule(db, projectId, input.suiteId, "api");
    const id = apiRequestRepo.insert(db, projectId, {
      kind: "saved",
      suiteId: input.suiteId ?? null,
      name: describeRequest(input),
      method: input.method,
      url: maskUrl(input.url),
      headers: maskHeaders(input.headers),
      bodyType: input.bodyType,
      body: maskJsonSecrets(input.body),
      expectations: input.expectations,
      isDemo: opts.isDemo,
    });
    return apiRequestRepo.get(db, projectId, id)!;
  },

  updateSaved(db: Db, projectId: number, id: number, input: ApiRequestInput): ApiHistoryEntry {
    apiStudioService.getSaved(db, projectId, id);
    if (input.suiteId) suiteService.assertInModule(db, projectId, input.suiteId, "api");
    apiRequestRepo.updateSaved(db, projectId, id, {
      kind: "saved",
      suiteId: input.suiteId ?? null,
      name: describeRequest(input),
      method: input.method,
      url: maskUrl(input.url),
      headers: maskHeaders(input.headers),
      bodyType: input.bodyType,
      body: maskJsonSecrets(input.body),
      expectations: input.expectations,
    });
    return apiStudioService.getSaved(db, projectId, id);
  },

  removeSaved(db: Db, projectId: number, id: number): void {
    if (!apiRequestRepo.remove(db, projectId, id, "saved")) throw notFound("Saved request");
  },

  /** Re-sends a saved request; the run is recorded in history like any other send. */
  async runSaved(db: Db, projectId: number, id: number, opts: { regressionRunId?: number | null } = {}): Promise<SendResult> {
    const saved = apiStudioService.getSaved(db, projectId, id);
    return apiStudioService.send(
      db,
      projectId,
      {
        name: saved.name,
        method: saved.method,
        url: saved.url,
        headers: saved.headers,
        bodyType: saved.bodyType,
        body: saved.body,
        expectations: saved.expectations,
        suiteId: saved.suiteId,
      },
      opts,
    );
  },
};

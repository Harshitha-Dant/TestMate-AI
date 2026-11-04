import type { ApiExpectations, EvaluationCheck, ExecutionStatus } from "@testmate/shared";
import { getPath, jsonType, parsePath, valueEquals } from "../lib/jsonPath";

export interface ApiEvaluationInput {
  status: number;
  timeMs: number;
  body: string;
  truncated: boolean;
  contentType: string | null;
  expectations: ApiExpectations;
}

/**
 * Rule-based checks for an HTTP response: status code, response time and JSON field assertions
 * (path exists, type, optional exact value). The response is a real (live) HTTP response.
 */
export function evaluateApiResponse(i: ApiEvaluationInput): {
  status: Exclude<ExecutionStatus, "error">;
  score: number;
  checks: EvaluationCheck[];
  explanation: string;
} {
  const checks: EvaluationCheck[] = [];
  const { expectations: exp } = i;

  const statusOk = exp.status === null ? i.status >= 200 && i.status < 300 : i.status === exp.status;
  checks.push({
    id: "status",
    label: exp.status === null ? "Status is 2xx" : `Status is ${exp.status}`,
    outcome: statusOk ? "pass" : "fail",
    detail: statusOk ? `Got ${i.status}.` : `Expected ${exp.status ?? "a 2xx status"}, got ${i.status}.`,
  });

  if (exp.maxTimeMs !== null) {
    const fast = i.timeMs <= exp.maxTimeMs;
    checks.push({
      id: "time",
      label: `Responds within ${exp.maxTimeMs} ms`,
      outcome: fast ? "pass" : "fail",
      detail: fast ? `Took ${i.timeMs} ms.` : `Took ${i.timeMs} ms, over the ${exp.maxTimeMs} ms limit.`,
    });
  }

  if (exp.fields.length) {
    let json: unknown;
    let parsed = false;
    try {
      json = JSON.parse(i.body);
      parsed = true;
    } catch {
      // Reported per field below.
    }
    const notJson = i.truncated
      ? "The response was cut off at the size limit, so it can't be parsed as JSON."
      : `The response is not valid JSON${i.contentType ? ` (content-type: ${i.contentType})` : ""}.`;

    exp.fields.forEach((f, idx) => {
      const id = `field_${idx}`;
      const label = `${f.path || "$"}${f.type !== "any" ? ` is ${f.type}` : " exists"}${f.equals !== null ? ` = ${f.equals}` : ""}`;
      if (!parsed) return checks.push({ id, label, outcome: "fail", detail: notJson });
      const segments = parsePath(f.path);
      if (!segments) return checks.push({ id, label, outcome: "fail", detail: `"${f.path}" is not a valid path (use a.b[0].c).` });
      const { found, value } = getPath(json, segments);
      if (!found) return checks.push({ id, label, outcome: "fail", detail: `Field "${f.path}" is missing.` });
      const actualType = jsonType(value);
      if (f.type !== "any" && actualType !== f.type) {
        return checks.push({ id, label, outcome: "fail", detail: `Field "${f.path}" is ${actualType}, expected ${f.type}.` });
      }
      if (f.equals !== null && !valueEquals(value, f.equals)) {
        return checks.push({ id, label, outcome: "fail", detail: `Field "${f.path}" is ${preview(value)}, expected ${f.equals}.` });
      }
      checks.push({ id, label, outcome: "pass", detail: `Field "${f.path}" is ${preview(value)}.` });
    });
  }

  const failed = checks.filter((c) => c.outcome === "fail");
  return {
    status: failed.length ? "failed" : "passed",
    score: Math.round(((checks.length - failed.length) / checks.length) * 100),
    checks,
    explanation: failed.length ? failed.map((c) => c.detail).join(" ") : "All API checks passed.",
  };
}

function preview(value: unknown): string {
  const text = JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 77)}...` : text;
}

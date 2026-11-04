import { describe, expect, it } from "vitest";
import { evaluateApiResponse } from "../src/evaluators/apiEvaluator";
import { getPath, parsePath, valueEquals } from "../src/lib/jsonPath";
import { isSecretName, maskHeaders, maskHeaderPairs, maskJsonSecrets, maskUrl, maskValue, resolveSecrets } from "../src/lib/secrets";

describe("secret masking", () => {
  it("masks secret-like headers but keeps placeholders and ordinary headers", () => {
    expect(
      maskHeaders([
        { key: "Authorization", value: "Bearer abc.def.ghi", enabled: true },
        { key: "X-API-Key", value: "k-123", enabled: true },
        { key: "Cookie", value: "sid=1", enabled: false },
        { key: "Authorization", value: "Bearer {{secret:API_TOKEN}}", enabled: true },
        { key: "Accept", value: "application/json", enabled: true },
      ]).map((h) => h.value),
    ).toEqual(["Bearer ••••••••", "••••••••", "••••••••", "Bearer {{secret:API_TOKEN}}", "application/json"]);
    expect(maskHeaderPairs([["set-cookie", "session=abc"], ["content-type", "text/plain"]])).toEqual([
      ["set-cookie", "••••••••"],
      ["content-type", "text/plain"],
    ]);
    expect(maskValue("")).toBe("");
  });

  it("recognizes secret names without masking look-alikes", () => {
    for (const name of ["Authorization", "X-API-Key", "api_key", "access_token", "client_secret", "password", "X-Auth", "session-id", "pin"]) {
      expect(isSecretName(name), name).toBe(true);
    }
    for (const name of ["author", "Accept", "spinner", "Content-Type", "monkey", "keyboard"]) {
      expect(isSecretName(name), name).toBe(false);
    }
  });

  it("masks secret values inside JSON bodies", () => {
    const masked = JSON.parse(maskJsonSecrets(JSON.stringify({ user: "ravi", password: "hunter2", nested: { access_token: "abc" }, author: "x" })));
    expect(masked).toEqual({ user: "ravi", password: "••••••••", nested: { access_token: "••••••••" }, author: "x" });
    expect(maskJsonSecrets("not json password=1")).toBe("not json password=1");
  });

  it("masks secret-like query parameters", () => {
    expect(maskUrl("https://api.example.com/x?api_key=abc&q=shoes")).toBe("https://api.example.com/x?api_key=••••••••&q=shoes");
    expect(maskUrl("https://api.example.com/x?q=shoes")).toBe("https://api.example.com/x?q=shoes");
  });

  it("resolves {{secret:NAME}} only from TESTMATE_SECRET_* env vars", () => {
    const env = { TESTMATE_SECRET_API_TOKEN: "t0k", DATABASE_URL: "postgres://x" };
    expect(resolveSecrets("Bearer {{secret:API_TOKEN}}", env)).toBe("Bearer t0k");
    expect(() => resolveSecrets("{{secret:DATABASE_URL}}", env)).toThrow(/TESTMATE_SECRET_DATABASE_URL/);
    expect(resolveSecrets("no placeholders", env)).toBe("no placeholders");
  });
});

describe("JSON path", () => {
  const doc = { data: { items: [{ id: 7, name: "Ravi" }] }, "x-total": 3, list: [1, 2] };
  it("parses dot, bracket index and quoted keys", () => {
    expect(parsePath("data.items[0].name")).toEqual(["data", "items", 0, "name"]);
    expect(parsePath("$['x-total']")).toEqual(["x-total"]);
    expect(parsePath("$")).toEqual([]);
    expect(parsePath("a[b]")).toBeNull();
  });
  it("reads values and reports missing paths", () => {
    expect(getPath(doc, parsePath("data.items[0].id")!)).toEqual({ found: true, value: 7 });
    expect(getPath(doc, parsePath("list[5]")!).found).toBe(false);
    expect(getPath(doc, parsePath("data.nope")!).found).toBe(false);
  });
  it("compares values parsed as JSON or as text", () => {
    expect(valueEquals(7, "7")).toBe(true);
    expect(valueEquals("7", "7")).toBe(true);
    expect(valueEquals(true, "true")).toBe(true);
    expect(valueEquals(null, "null")).toBe(true);
    expect(valueEquals({ a: [1] }, '{"a":[1]}')).toBe(true);
    expect(valueEquals("Ravi", "Ravi")).toBe(true);
    expect(valueEquals(8, "7")).toBe(false);
  });
});

describe("evaluateApiResponse", () => {
  const body = JSON.stringify({ id: 1, title: "delectus", completed: false, tags: [] });
  const base = { status: 200, timeMs: 120, body, truncated: false, contentType: "application/json" };

  it("passes when status, time and fields match", () => {
    const r = evaluateApiResponse({
      ...base,
      expectations: {
        status: 200,
        maxTimeMs: 500,
        fields: [
          { path: "id", type: "number", equals: "1" },
          { path: "title", type: "string", equals: null },
          { path: "completed", type: "boolean", equals: "false" },
          { path: "tags", type: "array", equals: null },
        ],
      },
    });
    expect(r.status).toBe("passed");
    expect(r.score).toBe(100);
  });

  it("explains each failure", () => {
    const r = evaluateApiResponse({
      ...base,
      status: 404,
      timeMs: 900,
      expectations: {
        status: null,
        maxTimeMs: 500,
        fields: [
          { path: "id", type: "string", equals: null },
          { path: "owner.name", type: "any", equals: null },
          { path: "id", type: "number", equals: "2" },
        ],
      },
    });
    expect(r.status).toBe("failed");
    expect(r.checks.map((c) => c.detail)).toEqual([
      "Expected a 2xx status, got 404.",
      "Took 900 ms, over the 500 ms limit.",
      'Field "id" is number, expected string.',
      'Field "owner.name" is missing.',
      'Field "id" is 1, expected 2.',
    ]);
  });

  it("reports invalid or truncated JSON clearly", () => {
    const html = evaluateApiResponse({ ...base, body: "<html>", contentType: "text/html", expectations: { status: null, maxTimeMs: null, fields: [{ path: "id", type: "any", equals: null }] } });
    expect(html.checks[1]!.detail).toBe("The response is not valid JSON (content-type: text/html).");
    const cut = evaluateApiResponse({ ...base, body: '{"id":', truncated: true, expectations: { status: null, maxTimeMs: null, fields: [{ path: "id", type: "any", equals: null }] } });
    expect(cut.checks[1]!.detail).toContain("cut off at the size limit");
  });
});

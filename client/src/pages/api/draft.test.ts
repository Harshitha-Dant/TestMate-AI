import type { ApiHistoryEntry } from "@testmate/shared";
import { describe, expect, it } from "vitest";
import { draftFromEntry, formatBytes, prettyJson, shortUrl, suggestFields } from "./draft";

const entry = (over: Partial<ApiHistoryEntry> = {}): ApiHistoryEntry => ({
  id: 1,
  projectId: 1,
  kind: "history",
  suiteId: null,
  name: "",
  method: "GET",
  url: "https://api.example.com/users?q=1",
  headers: [
    { key: "Accept", value: "application/json", enabled: true },
    { key: "Authorization", value: "Bearer ••••••••", enabled: true },
    { key: "X-Key", value: "{{secret:KEY}}", enabled: true },
  ],
  bodyType: "none",
  body: "",
  expectations: { status: null, maxTimeMs: null, fields: [] },
  response: null,
  error: null,
  lastRun: null,
  isDemo: false,
  createdAt: "2026-11-04T00:00:00Z",
  ...over,
});

describe("draftFromEntry", () => {
  it("clears masked secrets and reports what must be re-entered", () => {
    const { draft, needsSecrets } = draftFromEntry(entry());
    expect(draft.headers.map((h) => h.value)).toEqual(["application/json", "", "{{secret:KEY}}"]);
    expect(needsSecrets).toEqual(['header "Authorization"']);
  });
  it("flags masked URL and body values", () => {
    const { needsSecrets } = draftFromEntry(entry({ url: "https://x.test/?api_key=••••••••", body: '{"password":"••••••••"}', headers: [] }));
    expect(needsSecrets).toEqual(["a URL query value", "a value in the body"]);
  });
});

describe("response helpers", () => {
  it("pretty-prints JSON and leaves other text alone", () => {
    expect(prettyJson('{"a":1}')).toEqual({ text: '{\n  "a": 1\n}', isJson: true });
    expect(prettyJson("<html>")).toEqual({ text: "<html>", isJson: false });
  });
  it("formats sizes and short URLs", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
    expect(shortUrl("https://api.example.com/v1/items?x=1")).toBe("api.example.com/v1/items?x=1");
    expect(shortUrl("not a url")).toBe("not a url");
  });
  it("suggests field checks from a JSON response without duplicates", () => {
    const body = JSON.stringify({ id: 1, title: "t", done: false, tags: [], owner: null });
    expect(suggestFields(body, [{ path: "id", type: "number", equals: null }]).map((f) => `${f.path}:${f.type}`)).toEqual([
      "title:string",
      "done:boolean",
      "tags:array",
      "owner:null",
    ]);
    expect(suggestFields(JSON.stringify([{ id: 1 }]), [])).toEqual([{ path: "[0].id", type: "number", equals: null }]);
    expect(suggestFields("not json", [])).toEqual([]);
  });
});

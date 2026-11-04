import { describe, expect, it } from "vitest";
import { ApiClientError } from "../api/client";
import { deltaTone, formatDelta } from "../pages/regression/regressionUi";
import { cn } from "./cn";
import { faultLabel } from "./faults";
import { formatDuration, formatRelative } from "./format";
import { intentName, langAttr, languageName } from "./languages";

describe("format", () => {
  const now = Date.parse("2026-11-04T12:00:00Z");
  it("formats relative times", () => {
    expect(formatRelative("2026-11-04T11:59:40Z", now)).toBe("just now");
    expect(formatRelative("2026-11-04T11:55:00Z", now)).toMatch(/5 minutes ago/);
    expect(formatRelative("2026-11-04T09:00:00Z", now)).toMatch(/3 hours ago/);
    expect(formatRelative("2026-11-03T12:00:00Z", now)).toMatch(/yesterday|1 day ago/);
  });
  it("formats durations", () => {
    expect(formatDuration(null)).toBe("–");
    expect(formatDuration(240)).toBe("240 ms");
    expect(formatDuration(1530)).toBe("1.5 s");
  });
});

describe("languages", () => {
  it("returns lang attributes only for real languages", () => {
    expect(langAttr("te")).toBe("te");
    expect(langAttr("hi-Latn")).toBe("hi-Latn");
    expect(langAttr("mixed")).toBeUndefined();
    expect(langAttr(null)).toBeUndefined();
  });
  it("names languages and intents", () => {
    expect(languageName("te-Latn")).toBe("Tanglish");
    expect(languageName(null)).toBe("Not set");
    expect(intentName("order_status")).toBe("Order status");
    expect(intentName(null)).toBe("Any");
  });
});

describe("ApiClientError", () => {
  it("maps validation details to field errors (first message per field)", () => {
    const err = new ApiClientError("VALIDATION_ERROR", "Invalid input", [
      { path: "title", message: "Title is required" },
      { path: "title", message: "second" },
      { path: "", message: "Whole form problem" },
    ]);
    expect(err.fieldErrors()).toEqual({ title: "Title is required", _: "Whole form problem" });
    expect(new ApiClientError("CONFLICT", "dup").fieldErrors()).toEqual({});
  });
});

describe("small helpers", () => {
  it("joins class names", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
  it("labels faults and deltas", () => {
    expect(faultLabel("wrong_language")).toBe("answered in the wrong language");
    expect(faultLabel("custom")).toBe("custom");
    expect(formatDelta(-12.5)).toBe("-12.5 pts");
    expect(formatDelta(3)).toBe("+3 pts");
    expect(formatDelta(0)).toBe("±0 pts");
    expect(formatDelta(null)).toBe("–");
    expect(deltaTone(-1)).toBe("text-failure");
    expect(deltaTone(2)).toBe("text-success");
  });
});

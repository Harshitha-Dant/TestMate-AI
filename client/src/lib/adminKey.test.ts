import { afterEach, describe, expect, it, vi } from "vitest";
import { adminHeaders, clearAdminKey, readAdminKey, saveAdminKey } from "./adminKey";

function fakeSessionStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}

describe("admin key storage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("keeps the key for the tab session and builds the header", () => {
    vi.stubGlobal("sessionStorage", fakeSessionStorage());
    expect(readAdminKey()).toBeNull();
    expect(adminHeaders()).toEqual({});
    saveAdminKey("k".repeat(30));
    expect(readAdminKey()).toBe("k".repeat(30));
    expect(adminHeaders()).toEqual({ "X-TestMate-Admin-Key": "k".repeat(30) });
    clearAdminKey();
    expect(readAdminKey()).toBeNull();
  });

  it("works without storage (blocked or private mode)", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readAdminKey()).toBeNull();
    expect(() => saveAdminKey("x")).not.toThrow();
    expect(() => clearAdminKey()).not.toThrow();
    expect(adminHeaders("explicit-key")).toEqual({ "X-TestMate-Admin-Key": "explicit-key" });
  });
});

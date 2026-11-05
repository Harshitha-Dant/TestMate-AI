import type { AppMeta } from "@testmate/shared";
import { apiRequest } from "./client";

let cached: Promise<AppMeta> | null = null;

export const metaApi = {
  /** How the server runs (public demo or local). Fetched once per page load. */
  get(): Promise<AppMeta> {
    cached ??= apiRequest<AppMeta>("/meta").catch((err: unknown) => {
      cached = null; // retry on the next call
      throw err;
    });
    return cached;
  },
};

export const adminApi = {
  /** Resolves when `key` is the server's admin key; rejects with ADMIN_REQUIRED otherwise. */
  check(key: string): Promise<{ admin: boolean }> {
    return apiRequest<{ admin: boolean }>("/admin/check", { adminKey: key });
  },
};

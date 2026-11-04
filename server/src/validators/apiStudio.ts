import { ASSERTION_TYPES, BODY_TYPES, HTTP_METHODS } from "@testmate/shared";
import { z } from "zod";
import { idSchema } from "./common";

/** Headers the HTTP client manages itself; letting users set them invites request smuggling or confusion. */
const MANAGED_HEADERS = new Set(["host", "content-length", "transfer-encoding", "connection", "upgrade", "keep-alive", "te", "trailer", "expect"]);

/** One request header: a valid HTTP token name (not a client-managed one) and a value without line breaks. */
export const headerEntry = z
  .object({
    key: z.string().trim().max(200),
    value: z.string().max(8000),
    enabled: z.boolean().default(true),
  })
  .superRefine((h, ctx) => {
    if (!h.key) return; // blank rows are ignored when sending
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(h.key)) {
      ctx.addIssue({ code: "custom", path: ["key"], message: `"${h.key}" is not a valid header name` });
    } else if (MANAGED_HEADERS.has(h.key.toLowerCase()) || h.key.toLowerCase().startsWith("proxy-")) {
      ctx.addIssue({ code: "custom", path: ["key"], message: `"${h.key}" is set automatically and can't be overridden` });
    }
    if (/[\r\n\0]/.test(h.value)) ctx.addIssue({ code: "custom", path: ["value"], message: "Header values can't contain line breaks" });
  });

export const expectationsSchema = z.object({
  status: z.number().int().min(100).max(599).nullable().default(null),
  maxTimeMs: z.number().int().min(1).max(120_000).nullable().default(null),
  fields: z
    .array(
      z.object({
        path: z.string().trim().max(300),
        type: z.enum(ASSERTION_TYPES).default("any"),
        equals: z.string().max(2000).nullable().default(null),
      }),
    )
    .max(50)
    .default([]),
});

export const apiRequestSchema = z.object({
  name: z.string().trim().max(120).default(""),
  method: z.enum(HTTP_METHODS),
  url: z.string().trim().min(1, "Enter a URL").max(4000),
  headers: z.array(headerEntry).max(50).default([]),
  bodyType: z.enum(BODY_TYPES).default("none"),
  body: z.string().max(200_000).default(""),
  expectations: expectationsSchema.default({ status: null, maxTimeMs: null, fields: [] }),
  suiteId: idSchema.nullable().default(null),
});

export const savedRequestSchema = apiRequestSchema.extend({
  name: z.string().trim().min(1, "Give the saved request a name").max(120),
});

export const apiStudioSettingsSchema = z.object({
  allowLocalhost: z.boolean(),
  timeoutMs: z.number().int().min(1000, "At least 1 second").max(60_000, "At most 60 seconds"),
  maxResponseKb: z.number().int().min(16, "At least 16 KB").max(10_240, "At most 10 MB"),
});

export const historyQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });
export const savedQuery = z.object({ suiteId: z.union([z.literal("none"), idSchema]).optional() });

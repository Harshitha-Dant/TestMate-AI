import { BUG_CATEGORIES, BUG_SEVERITIES, BUG_STATUSES, TEST_MODULES } from "@testmate/shared";
import { z } from "zod";
import { idSchema } from "./common";

export const regressionRunSchema = z.object({
  suiteId: idSchema,
  label: z.string().trim().max(80).optional(),
  baselineRunId: idSchema.nullable().optional(),
  createBugs: z.boolean().default(false),
});

export const regressionListQuery = z.object({ suiteId: idSchema.optional() });
export const compareQuery = z.object({ from: idSchema, to: idSchema });

export const bugInputSchema = z.object({
  title: z.string().trim().min(3, "Give the bug a short title").max(120),
  module: z.enum(TEST_MODULES).nullable().default(null),
  category: z.enum(BUG_CATEGORIES).default("other"),
  severity: z.enum(BUG_SEVERITIES),
  failureExplanation: z.string().trim().max(5000).default(""),
  notes: z.string().trim().max(5000).default(""),
  executionId: idSchema.nullable().optional(),
});

export const bugUpdateSchema = z
  .object({
    title: z.string().trim().min(3).max(120).optional(),
    category: z.enum(BUG_CATEGORIES).optional(),
    severity: z.enum(BUG_SEVERITIES).optional(),
    status: z.enum(BUG_STATUSES).optional(),
    notes: z.string().trim().max(5000).optional(),
    comment: z.string().trim().max(2000).optional(),
  })
  .refine((u) => Object.values(u).some((v) => v !== undefined && v !== ""), { message: "Nothing to update" });

export const bugListQuery = z.object({
  status: z.enum(BUG_STATUSES).optional(),
  severity: z.enum(BUG_SEVERITIES).optional(),
  module: z.enum(TEST_MODULES).optional(),
  q: z.string().trim().max(200).optional(),
});

export const suggestQuery = z.object({ executionId: idSchema });

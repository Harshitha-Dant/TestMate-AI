import { TEST_LANGUAGES } from "@testmate/shared";
import { z } from "zod";

/** ?days=7|30|90|... or ?days=all (default: all time). */
export const rangeQuery = z.object({
  days: z
    .union([z.literal("all"), z.coerce.number().int().min(1).max(3650)])
    .optional()
    .transform((d) => (d === undefined || d === "all" ? null : d)),
});

export const preferencesSchema = z.object({
  defaultInputLanguage: z.enum(TEST_LANGUAGES),
  defaultExpectedLanguage: z.enum(TEST_LANGUAGES),
  defaultMinRelevance: z.number().int().min(0).max(100),
  qualityTarget: z.number().int().min(1).max(100),
});

import { EXECUTION_STATUSES, INTENTS, MATCH_MODES, RESULT_SOURCES, MOCK_FAULTS, MOCK_MODES, TEST_LANGUAGES, TEST_MODULES, TURN_KINDS } from "@testmate/shared";
import { z } from "zod";
import { idSchema } from "./common";

export const moduleQuery = z.object({ module: z.enum(TEST_MODULES).optional() });

export const suiteCreateSchema = z.object({
  module: z.enum(TEST_MODULES),
  name: z.string().trim().min(1, "Name is required").max(80),
  description: z.string().trim().max(500).default(""),
});

export const suiteUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(80).optional(),
    description: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined, { message: "Nothing to update" });

const keywordList = z
  .array(z.string().trim().min(1).max(100))
  .max(30, "At most 30 keywords")
  .default([])
  .transform((list) => [...new Set(list)]);

const lengthLimit = z.number().int().min(0).max(20000).nullable().default(null);

export const criteriaSchema = z
  .object({
    matchMode: z.enum(MATCH_MODES).default("keywords"),
    requiredKeywords: keywordList,
    forbiddenKeywords: keywordList,
    minRelevance: z.number().int().min(0).max(100).default(60),
    minLength: lengthLimit,
    maxLength: lengthLimit,
  })
  .refine((c) => c.minLength === null || c.maxLength === null || c.minLength <= c.maxLength, {
    message: "Minimum length cannot exceed maximum length",
    path: ["maxLength"],
  });

const caseBase = z.object({
  suiteId: idSchema.nullable().default(null),
  title: z.string().trim().min(1, "Title is required").max(120),
  input: z.string().trim().min(1, "Question is required").max(4000),
  expected: z.string().trim().max(4000).default(""),
  criteria: criteriaSchema.default({
    matchMode: "keywords",
    requiredKeywords: [],
    forbiddenKeywords: [],
    minRelevance: 60,
    minLength: null,
    maxLength: null,
  }),
  inputLanguage: z.enum(TEST_LANGUAGES).nullable().default(null),
  expectedLanguage: z.enum(TEST_LANGUAGES).nullable().default(null),
  expectedIntent: z.enum(INTENTS).nullable().default(null),
});

const hasExpectedForMatchMode = (c: z.infer<typeof caseBase>) => c.criteria.matchMode === "keywords" || c.expected.length > 0;
const matchModeMessage = { message: "Exact and contains modes need an expected answer", path: ["expected"] };

/** Chatbot Lab: the reply is judged by its text, so an expected answer or a required keyword is needed. */
export const testCaseSchema = caseBase
  .refine(hasExpectedForMatchMode, matchModeMessage)
  .refine((c) => c.expected.length > 0 || c.criteria.requiredKeywords.length > 0, {
    message: "Add an expected answer or at least one required keyword so the result can be judged",
    path: ["expected"],
  });

/** Multilingual Lab: the reply language is always checked; intent and text checks are optional. */
export const multilingualCaseSchema = caseBase
  .refine(hasExpectedForMatchMode, matchModeMessage)
  .refine((c) => c.expectedLanguage !== null, {
    message: "Choose the language the reply should be in",
    path: ["expectedLanguage"],
  });

export const detectLanguageSchema = z.object({ text: z.string().max(5000) });

export const caseListQuery = z.object({
  suiteId: z.union([z.literal("none"), idSchema]).optional(),
});

export const executionListQuery = z.object({
  module: z.enum(TEST_MODULES).optional(),
  status: z.enum(EXECUTION_STATUSES).optional(),
  source: z.enum(RESULT_SOURCES).optional(),
  q: z.string().trim().max(200).optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
  testCaseId: idSchema.optional(),
  sessionId: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const overrideSchema = z
  .object({
    status: z.enum(["passed", "failed", "needs_review"]).nullable(),
    note: z.string().trim().max(1000).default(""),
  })
  .refine((o) => o.status === null || o.note.length >= 3, {
    message: "Explain the override in a short note (at least 3 characters)",
    path: ["note"],
  });

const phraseList = z
  .array(z.string().trim().min(1).max(200))
  .max(20)
  .default([])
  .transform((list) => [...new Set(list)]);

export const turnExpectationSchema = z
  .object({
    kind: z.enum(TURN_KINDS).default("statement"),
    mustInclude: phraseList,
    mustIncludeAny: phraseList,
    mustNotInclude: phraseList,
  })
  .refine((e) => e.kind !== "recall" || e.mustInclude.length > 0, {
    message: "A recall turn needs at least one fact the reply must include",
    path: ["mustInclude"],
  })
  .refine((e) => e.kind !== "follow_up" || e.mustIncludeAny.length > 0, {
    message: "A follow-up turn needs at least one topic word the reply should contain",
    path: ["mustIncludeAny"],
  });

export const conversationSchema = z.object({
  suiteId: idSchema.nullable().default(null),
  title: z.string().trim().min(1, "Title is required").max(120),
  description: z.string().trim().max(500).default(""),
  turns: z
    .array(
      z.object({
        userMessage: z.string().trim().min(1, "Message is required").max(2000),
        expectation: turnExpectationSchema.default({ kind: "statement", mustInclude: [], mustIncludeAny: [], mustNotInclude: [] }),
      }),
    )
    .min(2, "A conversation needs at least 2 turns")
    .max(30, "At most 30 turns"),
});

export const mockConfigSchema = z.object({
  mode: z.enum(MOCK_MODES),
  failureRate: z.number().min(0).max(1),
  faults: z.array(z.enum(MOCK_FAULTS)).transform((f) => [...new Set(f)]),
  seed: z.number().int().min(0).max(2_147_483_647),
  memoryWindow: z.number().int().min(0).max(50),
});

export const chatbotTargetSchema = z
  .object({
    kind: z.enum(["mock", "http"]),
    http: z
      .object({
        url: z.string().trim().min(1, "Enter the endpoint URL").max(2000),
        replyPath: z.string().trim().max(200).default("reply"),
        headers: z
          .array(
            z.object({
              key: z.string().trim().max(200),
              value: z.string().max(4000).refine((v) => !/[\r\n]/.test(v), "Header values can't contain line breaks"),
              enabled: z.boolean().default(true),
            }),
          )
          .max(20)
          .default([]),
        sendHistory: z.boolean().default(true),
      })
      .nullable()
      .default(null),
  })
  .refine((t) => t.kind === "mock" || t.http !== null, { message: "Enter the chatbot endpoint settings", path: ["http"] });

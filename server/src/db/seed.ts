import { DEFAULT_CRITERIA, type ApiRequestInput, type TestCriteria, type TurnExpectation } from "@testmate/shared";
import { DEFAULT_MOCK_CONFIG } from "../providers/mockChatbotProvider";
import { apiStudioService } from "../services/apiStudioService";
import { bugService } from "../services/bugService";
import { multilingualService, SAMPLE_SUITE_NAME } from "../services/multilingualService";
import { regressionService } from "../services/regressionService";
import { runService } from "../services/runService";
import type { Db } from "./connection";
import { conversationRepo } from "./repositories/conversationRepo";
import { projectSettingsRepo } from "./repositories/projectSettingsRepo";
import { testCaseRepo } from "./repositories/testCaseRepo";

/**
 * Demo data. Every row is tagged is_demo = 1 and the project name starts with "Demo:" so it is
 * obviously sample data. clearDemo() removes all of it without touching user data.
 * Demo executions are produced by actually running the demo cases through the mock provider,
 * so they are real (simulated) results, not invented numbers.
 */
export const DEMO_PROJECT_NAME = "Demo: Support Bot";

/**
 * Mock seed for the demo project, found by searching seeds so the default 20% fault rate shows each failure
 * type once: context loss from the memory window (long chat, turn 6), a wrong-memory contradiction (short
 * recall, turn 3), one wrong-language reply in the Multilingual Lab and a few single-turn failures.
 * Re-check it whenever demo data or fault logic changes.
 */
const DEMO_MOCK_SEED = 4888;

/** Mock seed for the demo's simulated "v1.1" bot, chosen so the v1.0 → v1.1 regression shows new failures and a fix. */
const DEMO_V11_SEED = 7;

const criteria = (c: Partial<TestCriteria>): TestCriteria => ({ ...DEFAULT_CRITERIA, ...c });

const DEMO_CHATBOT_CASES = [
  {
    title: "Order tracking",
    input: "Where is my order?",
    expected: "You can track your order from My Orders using Track package.",
    criteria: criteria({ requiredKeywords: ["track", "My Orders"] }),
  },
  {
    title: "Refund timeline",
    input: "How long does a refund take?",
    expected: "Refunds go to your original payment method within 5-7 business days.",
    criteria: criteria({ requiredKeywords: ["refund", "5-7 business days"], forbiddenKeywords: ["guarantee"] }),
  },
  {
    title: "Cancellation window",
    input: "Can I cancel my order?",
    expected: "You can cancel within 24 hours of placing the order.",
    criteria: criteria({ requiredKeywords: ["cancel", "24 hours"] }),
  },
  {
    title: "Password reset steps",
    input: "I forgot my password, what do I do?",
    expected: "Select Forgot password on the sign-in page and follow the emailed link.",
    criteria: criteria({ requiredKeywords: ["forgot password", "email"], maxLength: 300 }),
  },
  {
    title: "Support hours",
    input: "When is customer support available?",
    expected: "Support is available 9 AM to 9 PM IST, Monday to Saturday.",
    criteria: criteria({ requiredKeywords: ["9 AM", "9 PM"] }),
  },
  {
    title: "UPI payments",
    input: "Can I pay with UPI?",
    expected: "Yes, we accept UPI.",
    criteria: criteria({ requiredKeywords: ["UPI"], forbiddenKeywords: ["bitcoin"] }),
  },
  {
    title: "Loyalty points balance",
    input: "How many loyalty points do I have?",
    expected: "You have loyalty points shown under My Rewards.",
    criteria: criteria({ requiredKeywords: ["points"] }),
  },
  {
    title: "Greeting (exact)",
    input: "hello",
    expected: "Hello! I'm the support assistant. How can I help you with your order today?",
    criteria: criteria({ matchMode: "exact" }),
  },
];

const turn = (userMessage: string, e: Partial<TurnExpectation> = {}) => ({
  userMessage,
  expectation: { kind: "statement" as const, mustInclude: [], mustIncludeAny: [], mustNotInclude: [], ...e },
});

/** With the default memory window of 4, "Name recall after a long chat" fails at turn 6 on purpose. */
const DEMO_MEMORY_SCRIPTS = [
  {
    title: "Name recall (short)",
    description: "The bot should remember a name given two turns earlier.",
    turns: [turn("Hi, my name is Ravi."), turn("I live in Hyderabad."), turn("What is my name?", { kind: "recall", mustInclude: ["Ravi"] })],
  },
  {
    title: "Name recall after a long chat",
    description: "The name is given at turn 1 and asked at turn 6, beyond a 4-turn memory window.",
    turns: [
      turn("Hi, my name is Ravi."),
      turn("I live in Hyderabad."),
      turn("Where is my order?"),
      turn("Can I pay with UPI?"),
      turn("How long does delivery take?"),
      turn("What is my name?", { kind: "recall", mustInclude: ["Ravi"] }),
    ],
  },
  {
    title: "Corrected city",
    description: "The user changes their city; the bot must use the new one, not the old one.",
    turns: [
      turn("I live in Hyderabad."),
      turn("Actually, I moved to Bengaluru last month."),
      turn("Where do I live?", { kind: "recall", mustInclude: ["Bengaluru"], mustNotInclude: ["Hyderabad"] }),
    ],
  },
  {
    title: "Refund follow-up",
    description: "The second question only makes sense with the first turn's context.",
    turns: [
      turn("I want to return my shoes.", { kind: "follow_up", mustIncludeAny: ["refund", "return"] }),
      turn("How many days will that take?", { kind: "follow_up", mustIncludeAny: ["5-7", "business days"] }),
    ],
  },
  {
    title: "Order number recall",
    description: "The bot should keep an order number across an unrelated question.",
    turns: [
      turn("My order number is ORD-48213."),
      turn("Can I cancel it?", { kind: "follow_up", mustIncludeAny: ["cancel"] }),
      turn("What is my order number?", { kind: "recall", mustInclude: ["ORD-48213"] }),
    ],
  },
];

const noExpectations = { status: null, maxTimeMs: null, fields: [] };

/** Demo API requests. The last one demonstrates the SSRF guard: it must be blocked, never sent. */
const DEMO_API_REQUESTS: ApiRequestInput[] = [
  {
    name: "Get a todo (JSONPlaceholder)",
    method: "GET",
    url: "https://jsonplaceholder.typicode.com/todos/1",
    headers: [{ key: "Accept", value: "application/json", enabled: true }],
    bodyType: "none",
    body: "",
    expectations: {
      status: 200,
      maxTimeMs: 5000,
      fields: [
        { path: "id", type: "number", equals: "1" },
        { path: "title", type: "string", equals: null },
        { path: "completed", type: "boolean", equals: null },
      ],
    },
  },
  {
    name: "Create a post (JSONPlaceholder)",
    method: "POST",
    url: "https://jsonplaceholder.typicode.com/posts",
    headers: [{ key: "Authorization", value: "Bearer {{secret:DEMO_TOKEN}}", enabled: false }],
    bodyType: "json",
    body: JSON.stringify({ title: "Order status in 4 languages", body: "Where is my order?", userId: 1 }, null, 2),
    expectations: { status: 201, maxTimeMs: null, fields: [{ path: "id", type: "number", equals: null }, { path: "title", type: "string", equals: "Order status in 4 languages" }] },
  },
  {
    name: "Missing resource returns 404",
    method: "GET",
    url: "https://jsonplaceholder.typicode.com/todos/999999",
    headers: [],
    bodyType: "none",
    body: "",
    expectations: { status: 404, maxTimeMs: null, fields: [] },
  },
  {
    name: "SSRF guard demo (should be blocked)",
    method: "GET",
    url: "http://169.254.169.254/latest/meta-data/",
    headers: [],
    bodyType: "none",
    body: "",
    expectations: noExpectations,
  },
];

export async function seedDemo(db: Db): Promise<{ projectId: number; created: boolean }> {
  const existing = db.prepare("SELECT id FROM projects WHERE name = ?").get(DEMO_PROJECT_NAME) as
    | { id: number }
    | undefined;
  if (existing) return { projectId: existing.id, created: false };

  const { projectId, chatbotSuiteId, memorySuiteId, multilingualSuiteId } = db.transaction(() => {
    const projectId = Number(
      db
        .prepare("INSERT INTO projects (name, description, is_demo) VALUES (?, ?, 1)")
        .run(DEMO_PROJECT_NAME, "Sample project with demo data. Safe to delete or clear via db:clear-demo.")
        .lastInsertRowid,
    );
    const suite = db.prepare(
      "INSERT INTO test_suites (project_id, module, name, description, is_demo) VALUES (?, ?, ?, ?, 1)",
    );
    const chatbotSuiteId = Number(
      suite.run(projectId, "chatbot", "Order support FAQ", "Single-turn answers about orders and refunds.").lastInsertRowid,
    );
    const memorySuiteId = Number(
      suite.run(projectId, "memory", "Customer profile recall", "Multi-turn scripts that check context retention.")
        .lastInsertRowid,
    );
    const multilingualSuiteId = Number(
      suite.run(projectId, "multilingual", SAMPLE_SUITE_NAME, "The same questions in English, Telugu, Tanglish, Hindi and Hinglish.")
        .lastInsertRowid,
    );
    const apiSuiteId = Number(
      suite.run(projectId, "api", "Public API smoke", "Live HTTP checks against public sample APIs (needs internet).")
        .lastInsertRowid,
    );
    // Saved only, never sent during seeding: seeding must work offline and must not call the internet.
    for (const r of DEMO_API_REQUESTS) apiStudioService.createSaved(db, projectId, { ...r, suiteId: apiSuiteId }, { isDemo: true });
    for (const c of DEMO_CHATBOT_CASES) {
      testCaseRepo.create(db, projectId, "chatbot", { ...c, suiteId: chatbotSuiteId, isDemo: true });
    }
    for (const s of DEMO_MEMORY_SCRIPTS) {
      conversationRepo.create(db, projectId, { ...s, suiteId: memorySuiteId, isDemo: true });
    }
    projectSettingsRepo.set(db, projectId, "mock_provider", { ...DEFAULT_MOCK_CONFIG, seed: DEMO_MOCK_SEED });
    multilingualService.addSamples(db, projectId, { isDemo: true });
    return { projectId, chatbotSuiteId, memorySuiteId, multilingualSuiteId };
  })();

  await runService.runSuite(db, projectId, chatbotSuiteId, { isDemo: true });
  await runService.runSuite(db, projectId, memorySuiteId, { isDemo: true });
  await runService.runSuite(db, projectId, multilingualSuiteId, { isDemo: true });
  await seedQuality(db, projectId, chatbotSuiteId);
  return { projectId, created: true };
}

/**
 * Regression + bug demo: a "v1.0" snapshot with the demo bot, then a "v1.1" bot (another mock seed and a higher
 * fault rate) that introduces new failures and fixes; bugs are opened automatically for the new failures.
 * The demo bot settings are restored afterwards so the labs keep showing the curated results.
 */
async function seedQuality(db: Db, projectId: number, chatbotSuiteId: number): Promise<void> {
  const demoConfig = { ...DEFAULT_MOCK_CONFIG, seed: DEMO_MOCK_SEED };
  await regressionService.run(db, projectId, { suiteId: chatbotSuiteId, label: "v1.0 baseline" }, { isDemo: true });
  projectSettingsRepo.set(db, projectId, "mock_provider", { ...demoConfig, seed: DEMO_V11_SEED, failureRate: 0.35 });
  await regressionService.run(db, projectId, { suiteId: chatbotSuiteId, label: "v1.1", createBugs: true }, { isDemo: true });
  projectSettingsRepo.set(db, projectId, "mock_provider", demoConfig);

  // A hand-reported bug with a little history, from the memory script that loses context at turn 6.
  const memoryRun = db
    .prepare("SELECT e.id FROM test_executions e JOIN conversation_sessions s ON s.id = e.session_id WHERE e.project_id = ? AND s.title = ? ORDER BY e.id DESC")
    .get(projectId, "Name recall after a long chat") as { id: number } | undefined;
  if (memoryRun) {
    const draft = bugService.suggestFromExecution(db, projectId, memoryRun.id);
    const bug = bugService.create(db, projectId, { ...draft, title: "Bot forgets the customer's name after 4 turns", severity: "high" }, { isDemo: true });
    bugService.update(db, projectId, bug.id, { status: "in_progress", comment: "Memory window is only 4 user turns; asked the bot team to raise it." });
  }
}

/** Tables with an is_demo column, children first so non-cascading references are removed cleanly. */
const DEMO_TABLES = [
  "bug_reports",
  "test_executions",
  "regression_runs",
  "api_requests",
  "conversation_sessions",
  "test_cases",
  "test_suites",
  "projects",
] as const;

export function clearDemo(db: Db): Record<string, number> {
  return db.transaction(() => {
    const removed: Record<string, number> = {};
    for (const table of DEMO_TABLES) {
      removed[table] = db.prepare(`DELETE FROM ${table} WHERE is_demo = 1`).run().changes;
    }
    return removed;
  })();
}

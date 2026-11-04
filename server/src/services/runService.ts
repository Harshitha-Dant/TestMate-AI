import type { ConversationScript, Execution, Intent, Language, SuiteRunResult, TestCase } from "@testmate/shared";
import type { Db } from "../db/connection";
import { conversationRepo } from "../db/repositories/conversationRepo";
import { executionRepo } from "../db/repositories/executionRepo";
import { testCaseRepo } from "../db/repositories/testCaseRepo";
import { ConversationEvaluator, type PlayedTurn } from "../evaluators/conversationEvaluator";
import { MultilingualEvaluator } from "../evaluators/multilingualEvaluator";
import { RuleBasedEvaluator } from "../evaluators/ruleBasedEvaluator";
import type { ChatMessage } from "../providers/types";
import { apiStudioService } from "./apiStudioService";
import { providerService } from "./providerService";
import { suiteService } from "./suiteService";

const evaluator = new RuleBasedEvaluator();
const multilingualEvaluator = new MultilingualEvaluator();
const conversationEvaluator = new ConversationEvaluator();

export interface SuiteItemResult {
  itemKey: string;
  title: string;
  execution: Execution;
}

export interface RunOptions {
  regressionRunId?: number | null;
  isDemo?: boolean;
}

const errorText = (err: unknown) => `The chatbot provider failed: ${err instanceof Error ? err.message : String(err)}`;

/** Positions of earlier turns inside the simulated memory window when answering turn `position`. */
function visibleTurns(position: number, window: number): number[] {
  const first = Math.max(1, position - window);
  return window > 0 ? Array.from({ length: position - first }, (_, i) => first + i) : [];
}

export const runService = {
  /** Sends the case to the project's chatbot provider, evaluates the reply and stores the execution. */
  async runTestCase(db: Db, projectId: number, testCase: TestCase, opts: RunOptions = {}): Promise<Execution> {
    const { provider, mode } = providerService.forProject(db, projectId);
    const started = performance.now();
    const base = {
      module: testCase.module,
      testCaseId: testCase.id,
      regressionRunId: opts.regressionRunId ?? null,
      title: testCase.title,
      source: provider.source,
      evaluator: evaluator.name,
      input: testCase.input,
      isDemo: opts.isDemo,
    };

    const multilingual = testCase.module === "multilingual";
    let id: number;
    try {
      const reply = await provider.reply([{ role: "user", content: testCase.input }], {
        expected: testCase.expected,
        forbiddenKeywords: testCase.criteria.forbiddenKeywords,
        multilingual,
      });
      const multilingualResult = multilingual
        ? multilingualEvaluator.evaluate({
            input: testCase.input,
            output: reply.text,
            expected: testCase.expected,
            criteria: testCase.criteria,
            inputLanguage: testCase.inputLanguage as Language | null,
            expectedLanguage: testCase.expectedLanguage as Language | null,
            expectedIntent: testCase.expectedIntent as Intent | null,
          })
        : null;
      const result =
        multilingualResult ??
        evaluator.evaluate({ output: reply.text, expected: testCase.expected, criteria: testCase.criteria });
      const language = multilingualResult?.language;
      id = executionRepo.insert(db, projectId, {
        ...base,
        status: result.status,
        score: result.score,
        output: reply.text,
        explanation: result.explanation,
        language: language?.output.language ?? null,
        details: {
          checks: result.checks,
          language,
          provider: { name: provider.name, mode },
          simulation: provider.source === "mock" ? { faultInjected: reply.faultInjected ?? null } : undefined,
        },
        durationMs: Math.round(performance.now() - started),
      });
    } catch (err) {
      id = executionRepo.insert(db, projectId, {
        ...base,
        status: "error",
        score: null,
        output: "",
        explanation: errorText(err),
        details: { provider: { name: provider.name, mode } },
        durationMs: Math.round(performance.now() - started),
      });
    }
    return executionRepo.get(db, projectId, id)!;
  },

  /** Plays a multi-turn script, keeping the full history, then evaluates the whole transcript. */
  async runConversation(db: Db, projectId: number, script: ConversationScript, opts: RunOptions = {}): Promise<Execution> {
    const { provider, config, mode } = providerService.forProject(db, projectId);
    const window = provider.source === "mock" ? config.memoryWindow : null;
    const started = performance.now();
    const messages: ChatMessage[] = [];
    const played: PlayedTurn[] = [];
    const base = {
      module: "memory" as const,
      sessionId: script.id,
      regressionRunId: opts.regressionRunId ?? null,
      title: script.title,
      source: provider.source,
      evaluator: conversationEvaluator.name,
      input: script.turns.map((t) => `${t.position}. ${t.userMessage}`).join("\n"),
      isDemo: opts.isDemo,
    };

    try {
      for (const turn of script.turns) {
        messages.push({ role: "user", content: turn.userMessage });
        const reply = await provider.reply(messages, { forbiddenKeywords: turn.expectation.mustNotInclude });
        messages.push({ role: "assistant", content: reply.text });
        played.push({
          position: turn.position,
          userMessage: turn.userMessage,
          reply: reply.text,
          expectation: turn.expectation,
          visibleTurns: window === null ? null : visibleTurns(turn.position, window),
          faultInjected: reply.faultInjected ?? null,
        });
      }
    } catch (err) {
      const id = executionRepo.insert(db, projectId, {
        ...base,
        status: "error",
        score: null,
        output: played.map((p) => p.reply).join("\n"),
        explanation: `${errorText(err)} (at turn ${played.length + 1})`,
        details: { provider: { name: provider.name, mode } },
        durationMs: Math.round(performance.now() - started),
      });
      return executionRepo.get(db, projectId, id)!;
    }

    const result = conversationEvaluator.evaluate(played, window);
    const faults = played.filter((p) => p.faultInjected).map((p) => `turn ${p.position}: ${p.faultInjected}`);
    const id = executionRepo.insert(db, projectId, {
      ...base,
      status: result.status,
      score: result.score,
      output: played.map((p) => `${p.position}. ${p.reply}`).join("\n"),
      explanation: result.explanation,
      details: {
        memory: result.details,
        provider: { name: provider.name, mode },
        simulation: provider.source === "mock" ? { faultInjected: faults.length ? faults.join(", ") : null } : undefined,
      },
      durationMs: Math.round(performance.now() - started),
    });
    return executionRepo.get(db, projectId, id)!;
  },

  /**
   * Runs every item in the suite sequentially and returns each with a stable key
   * (case:<id>, script:<id>, api:<savedRequestId>) so runs can be compared over time.
   */
  async runSuiteItems(db: Db, projectId: number, suiteId: number, opts: RunOptions = {}): Promise<SuiteItemResult[]> {
    const suite = suiteService.get(db, projectId, suiteId);
    const items: SuiteItemResult[] = [];
    if (suite.module === "chatbot" || suite.module === "multilingual") {
      for (const testCase of testCaseRepo.list(db, projectId, { module: suite.module, suiteId })) {
        const execution = await runService.runTestCase(db, projectId, testCase, opts);
        items.push({ itemKey: `case:${testCase.id}`, title: testCase.title, execution });
      }
    } else if (suite.module === "memory") {
      for (const script of conversationRepo.list(db, projectId, suiteId)) {
        const execution = await runService.runConversation(db, projectId, script, opts);
        items.push({ itemKey: `script:${script.id}`, title: script.title, execution });
      }
    } else {
      // API suites re-send their saved requests (live HTTP calls through the SSRF-safe client).
      for (const saved of apiStudioService.listSaved(db, projectId, suiteId)) {
        const { execution } = await apiStudioService.runSaved(db, projectId, saved.id, opts);
        items.push({ itemKey: `api:${saved.id}`, title: saved.name, execution });
      }
    }
    return items;
  },

  /** Runs every test or script in the suite and returns a summary. */
  async runSuite(db: Db, projectId: number, suiteId: number, opts: RunOptions = {}): Promise<SuiteRunResult> {
    const executions = (await runService.runSuiteItems(db, projectId, suiteId, opts)).map((i) => i.execution);
    const count = (s: Execution["status"]) => executions.filter((e) => e.status === s).length;
    return {
      suiteId,
      total: executions.length,
      passed: count("passed"),
      failed: count("failed"),
      needsReview: count("needs_review"),
      errors: count("error"),
      executions,
    };
  },
};

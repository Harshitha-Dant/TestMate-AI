import type { EvaluationCheck, EvaluatorName, ExecutionStatus, TestCriteria } from "@testmate/shared";

export interface EvaluationInput {
  output: string;
  expected: string;
  criteria: TestCriteria;
}

export interface EvaluationResult {
  status: Exclude<ExecutionStatus, "error">;
  /** 0-100 weighted score across graded checks. */
  score: number;
  checks: EvaluationCheck[];
  /** Plain-language summary of what was missing or wrong. */
  explanation: string;
}

/** Judges a chatbot response. Implementations must be transparent about how they decide. */
export interface Evaluator {
  readonly name: EvaluatorName;
  evaluate(input: EvaluationInput): EvaluationResult;
}

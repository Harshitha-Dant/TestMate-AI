const FAULT_LABELS: Record<string, string> = {
  omit_detail: "left out part of the answer",
  off_topic: "answered a different question",
  forbidden_claim: "added a forbidden claim",
  empty: "returned an empty reply",
  wrong_memory: "recalled a different value than the user gave",
  wrong_language: "answered in the wrong language",
};

/** Plain-language description of a deliberate mock fault. */
export function faultLabel(fault: string): string {
  return FAULT_LABELS[fault] ?? fault;
}

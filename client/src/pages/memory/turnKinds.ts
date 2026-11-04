import type { TurnKind } from "@testmate/shared";

export const TURN_KIND_LABELS: Record<TurnKind, string> = {
  statement: "Statement",
  recall: "Recall",
  follow_up: "Follow-up",
};

export const TURN_KIND_HINTS: Record<TurnKind, string> = {
  statement: "The user shares information. The reply only needs to be present.",
  recall: "The bot must bring back facts from earlier turns.",
  follow_up: "The question depends on the previous turn's topic.",
};

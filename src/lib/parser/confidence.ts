import type { IntentType } from "./intents";

export interface ConfidenceResult {
  score: number;
  level: "high" | "medium" | "low";
  reasons: string[];
}

export function calculateConfidence(
  intent: IntentType,
  hasGameTitle: boolean,
  hasSoftwareTitle: boolean,
  hasGenre: boolean,
  hasPlatform: boolean,
  hasSearchTerms: boolean,
  inputLength: number,
  patternMatchStrength: number
): ConfidenceResult {
  let score = patternMatchStrength;
  const reasons: string[] = [];

  if (hasGameTitle || hasSoftwareTitle) {
    score += 0.15;
    reasons.push("identified specific title");
  }

  if (hasGenre) {
    score += 0.05;
    reasons.push("identified genre");
  }

  if (hasPlatform) {
    score += 0.05;
    reasons.push("identified platform");
  }

  if (hasSearchTerms && inputLength > 5) {
    score += 0.05;
    reasons.push("has meaningful search terms");
  }

  if (inputLength < 3) {
    score -= 0.2;
    reasons.push("very short input");
  }

  if (intent === "UNKNOWN") {
    score = 0.1;
    reasons.push("no clear intent detected");
  }

  if (intent === "HELP") {
    score = Math.max(score, 0.8);
    reasons.push("help request detected");
  }

  score = Math.max(0, Math.min(1, score));

  let level: "high" | "medium" | "low";
  if (score >= 0.7) level = "high";
  else if (score >= 0.4) level = "medium";
  else level = "low";

  return { score, level, reasons };
}

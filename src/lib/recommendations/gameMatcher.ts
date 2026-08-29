import type { Software } from "@/lib/data";
import type { DetectedSpecs } from "@/lib/detectSpecs";
import { checkCompatibility } from "./compatibility";

export interface Recommendation {
  software: Software;
  score: number;
  reason: string;
  compatibility?: "excellent" | "good" | "playable" | "poor" | "unknown";
}

export function getRecommendations(
  current: Software,
  allSoftware: Software[],
  count: number = 6
): Recommendation[] {
  const candidates = allSoftware.filter((s) => s.id !== current.id);
  const scored: Recommendation[] = [];

  for (const candidate of candidates) {
    let score = 0;
    let reason = "";

    if (candidate.subcategory.toLowerCase() === current.subcategory.toLowerCase()) {
      score += 30;
      reason = `Same genre: ${candidate.subcategory}`;
    } else if (candidate.category === current.category) {
      score += 15;
      reason = `Same category`;
    }

    if (candidate.platform === current.platform) {
      score += 5;
    }

    const sizeA = parseSizeGB(current.size);
    const sizeB = parseSizeGB(candidate.size);
    if (sizeA > 0 && sizeB > 0) {
      const sizeDiff = Math.abs(sizeA - sizeB) / Math.max(sizeA, sizeB);
      if (sizeDiff < 0.3) {
        score += 8;
        if (!reason) reason = "Similar size";
      }
    }

    const ratingDiff = Math.abs(candidate.rating - current.rating);
    if (ratingDiff < 0.5) {
      score += 5;
    }

    const featureOverlap = calculateFeatureOverlap(current.features, candidate.features);
    if (featureOverlap > 0.3) {
      score += Math.floor(featureOverlap * 20);
      if (!reason || reason === "Same category") reason = "Similar features";
    }

    score += Math.min(candidate.downloads / 100000, 5);

    scored.push({ software: candidate, score, reason: reason || "Recommended" });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count);
}

export function getGamesForPC(
  allSoftware: Software[],
  specs: DetectedSpecs | null,
  count: number = 20
): Recommendation[] {
  const games = allSoftware.filter((s) => s.category === "pc-games");

  if (!specs) {
    return games.slice(0, count).map((s) => ({
      software: s,
      score: s.downloads / 1000 + s.rating * 10,
      reason: "Popular game",
      compatibility: "unknown" as const,
    }));
  }

  const scored: Recommendation[] = [];

  for (const game of games) {
    const compat = checkCompatibility(specs, game.systemRequirements);
    let score = 0;

    switch (compat.overall) {
      case "excellent": score = 100; break;
      case "good": score = 80; break;
      case "playable": score = 60; break;
      case "poor": score = 20; break;
      case "unknown": score = 40; break;
    }

    score += game.rating * 5;
    score += Math.min(game.downloads / 50000, 10);

    scored.push({
      software: game,
      score,
      reason: compat.summary,
      compatibility: compat.overall,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count);
}

export function findSimilarGames(
  target: Software,
  allSoftware: Software[],
  count: number = 8
): Recommendation[] {
  const games = allSoftware.filter((s) => s.id !== target.id && s.category === "pc-games");
  const scored: Recommendation[] = [];

  for (const game of games) {
    let score = 0;
    let reason = "";

    if (game.subcategory.toLowerCase() === target.subcategory.toLowerCase()) {
      score += 40;
      reason = `Same genre: ${game.subcategory}`;
    }

    const featureOverlap = calculateFeatureOverlap(target.features, game.features);
    score += Math.floor(featureOverlap * 30);
    if (featureOverlap > 0.3 && !reason) reason = "Similar features";

    const targetTokens = target.description.toLowerCase().split(/\s+/);
    const gameTokens = game.description.toLowerCase().split(/\s+/);
    const descOverlap = calculateTokenOverlap(targetTokens, gameTokens);
    score += Math.floor(descOverlap * 20);
    if (descOverlap > 0.2 && !reason) reason = "Similar description";

    const sizeA = parseSizeGB(target.size);
    const sizeB = parseSizeGB(game.size);
    if (sizeA > 0 && sizeB > 0) {
      const ratio = Math.min(sizeA, sizeB) / Math.max(sizeA, sizeB);
      score += Math.floor(ratio * 10);
    }

    score += game.rating * 3;

    scored.push({
      software: game,
      score,
      reason: reason || "Similar game",
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count);
}

function parseSizeGB(size: string): number {
  const match = size.match(/([\d.]+)\s*(GB|MB|TB)/i);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === "MB") return val / 1024;
  if (unit === "TB") return val * 1024;
  return val;
}

function calculateFeatureOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a.map((f) => f.toLowerCase()));
  const setB = new Set(b.map((f) => f.toLowerCase()));
  let overlap = 0;
  for (const f of setA) {
    for (const g of setB) {
      if (f.includes(g) || g.includes(f)) {
        overlap++;
        break;
      }
    }
  }
  return overlap / Math.max(setA.size, setB.size);
}

function calculateTokenOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a.filter((t) => t.length > 3));
  const setB = new Set(b.filter((t) => t.length > 3));
  let overlap = 0;
  for (const t of setA) {
    if (setB.has(t)) overlap++;
  }
  const union = setA.size + setB.size - overlap;
  return union === 0 ? 0 : overlap / union;
}

import { normalize, extractTokens } from "./normalize";
import { classifyIntent, type IntentType, type ClassifiedIntent } from "./intents";
import { extractEntities, type ExtractedEntities } from "./entities";
import { fuzzyResolveAlias, type AliasEntry } from "./aliases";
import { calculateConfidence, type ConfidenceResult } from "./confidence";
import {
  getContext,
  saveContext,
  addRecentQuery,
  setCurrentGame,
  setCurrentSoftware,
  setCurrentIntent,
  setLastSearchResults,
  resolvePronouns,
  clearContext,
} from "./context";
import type { Software } from "@/lib/data";

export interface ParseResult {
  rawInput: string;
  normalizedInput: string;
  tokens: string[];
  intents: ClassifiedIntent[];
  primaryIntent: IntentType;
  confidence: ConfidenceResult;
  entities: ExtractedEntities;
  resolvedAlias: AliasEntry | null;
  context: {
    hadPronounResolution: boolean;
    originalInput: string;
  };
}

export function parseInput(input: string): ParseResult {
  const rawInput = input;
  const ctx = getContext();
  const resolvedInput = resolvePronouns(input, ctx);
  const hadPronounResolution = resolvedInput !== input;

  const normalizedInput = normalize(resolvedInput);
  const tokens = extractTokens(resolvedInput);

  const intents = classifyIntent(normalizedInput);
  const primaryIntent = intents.length > 0 ? intents[0].intent : "UNKNOWN";

  const entities = extractEntities(resolvedInput, normalizedInput);

  let resolvedAlias = fuzzyResolveAlias(entities.gameTitle || entities.softwareTitle || normalizedInput);

  if (!resolvedAlias && entities.searchTerms.length > 0) {
    resolvedAlias = fuzzyResolveAlias(entities.searchTerms.join(" "));
  }

  const hasGameTitle = !!(entities.gameTitle || (resolvedAlias?.type === "game"));
  const hasSoftwareTitle = !!(entities.softwareTitle || (resolvedAlias?.type === "software"));
  const hasGenre = !!entities.genre;
  const hasPlatform = !!entities.platform;
  const hasSearchTerms = entities.searchTerms.length > 0;

  const patternStrength = intents.length > 0 ? intents[0].confidence : 0.3;

  const confidence = calculateConfidence(
    primaryIntent,
    hasGameTitle,
    hasSoftwareTitle,
    hasGenre,
    hasPlatform,
    hasSearchTerms,
    normalizedInput.length,
    patternStrength
  );

  if (resolvedAlias?.type === "game" && !entities.gameTitle) {
    entities.gameTitle = resolvedAlias.canonical;
  } else if (resolvedAlias?.type === "software" && !entities.softwareTitle) {
    entities.softwareTitle = resolvedAlias.canonical;
  }

  const result: ParseResult = {
    rawInput,
    normalizedInput,
    tokens,
    intents,
    primaryIntent,
    confidence,
    entities,
    resolvedAlias,
    context: { hadPronounResolution, originalInput: rawInput },
  };

  addRecentQuery(rawInput);
  setCurrentIntent(primaryIntent);

  if (resolvedAlias?.type === "game") {
    setCurrentGame(resolvedAlias.canonical);
  } else if (resolvedAlias?.type === "software") {
    setCurrentSoftware(resolvedAlias.canonical);
  }

  if (entities.genre) {
    saveContext({ currentGenre: entities.genre });
  }
  if (entities.platform) {
    saveContext({ currentPlatform: entities.platform });
  }

  return result;
}

export function getSuggestions(result: ParseResult): string[] {
  const suggestions: string[] = [];
  const ctx = getContext();

  if (result.primaryIntent === "UNKNOWN" || result.confidence.level === "low") {
    if (result.entities.gameTitle || result.resolvedAlias) {
      const name = result.entities.gameTitle || result.resolvedAlias?.canonical || "it";
      suggestions.push(`Show ${name} requirements`);
      suggestions.push(`Can my PC run ${name}?`);
      suggestions.push(`Games like ${name}`);
      suggestions.push(`Download ${name}`);
    } else if (result.entities.softwareTitle) {
      const name = result.entities.softwareTitle;
      suggestions.push(`Show ${name} details`);
      suggestions.push(`Download ${name}`);
      suggestions.push(`Alternatives to ${name}`);
    } else {
      suggestions.push("Can my PC run Cyberpunk?");
      suggestions.push("Show me RPG games");
      suggestions.push("Find lightweight games");
      suggestions.push("What are the requirements for GTA V?");
    }
  } else {
    if (result.primaryIntent === "CHECK_PC_COMPATIBILITY") {
      if (ctx.currentGame) {
        suggestions.push(`Show ${ctx.currentGame} requirements`);
        suggestions.push(`Download ${ctx.currentGame}`);
      } else {
        suggestions.push("Can my PC run Cyberpunk?");
        suggestions.push("Find games my PC can run");
      }
    } else if (result.primaryIntent === "GAME_REQUIREMENTS" || result.primaryIntent === "SOFTWARE_REQUIREMENTS") {
      if (ctx.currentGame) {
        suggestions.push(`Can my PC run ${ctx.currentGame}`);
        suggestions.push(`Games like ${ctx.currentGame}`);
      }
    } else if (result.primaryIntent === "SIMILAR_GAMES") {
      suggestions.push("Find lightweight games");
      suggestions.push("Show trending games");
    } else if (result.primaryIntent === "FIND_GAMES_FOR_PC") {
      suggestions.push("Show lightweight games");
      suggestions.push("Find RPG games under 50GB");
    }
  }

  return suggestions.slice(0, 4);
}

export function getResponsePreview(result: ParseResult): string {
  const { primaryIntent, entities, resolvedAlias, confidence } = result;
  const name = entities.gameTitle || entities.softwareTitle || resolvedAlias?.canonical;

  switch (primaryIntent) {
    case "CHECK_PC_COMPATIBILITY":
      return name
        ? `Checking if your PC can run ${name}...`
        : "Checking PC compatibility...";
    case "GAME_REQUIREMENTS":
    case "SOFTWARE_REQUIREMENTS":
      return name ? `Showing requirements for ${name}...` : "Showing system requirements...";
    case "DOWNLOAD_GAME":
    case "DOWNLOAD_SOFTWARE":
      return name ? `Opening download for ${name}...` : "Finding download...";
    case "SIMILAR_GAMES":
      return name ? `Finding games similar to ${name}...` : "Finding similar games...";
    case "SIMILAR_SOFTWARE":
      return name ? `Finding alternatives to ${name}...` : "Finding alternatives...";
    case "GAME_RECOMMENDATION":
      return entities.genre ? `Finding ${entities.genre} game recommendations...` : "Finding recommendations...";
    case "SOFTWARE_RECOMMENDATION":
      return "Finding software recommendations...";
    case "FIND_GAMES_FOR_PC":
      return "Finding games your PC can run...";
    case "FIND_LIGHTWEIGHT_GAMES":
      return "Finding lightweight games...";
    case "FIND_GAMES_BY_GENRE":
      return entities.genre ? `Finding ${entities.genre} games...` : "Finding games by genre...";
    case "FIND_GAMES_BY_SIZE":
      return entities.maxSizeGB ? `Finding games under ${entities.maxSizeGB}GB...` : "Finding games by size...";
    case "COMPARE_GAMES":
      return entities.comparisonTarget
        ? `Comparing ${entities.comparisonTarget}...`
        : "Comparing games...";
    case "TRENDING":
      return "Showing trending games and software...";
    case "NEW_RELEASES":
      return "Showing new releases...";
    case "RECENTLY_VIEWED":
      return "Showing recently viewed...";
    case "HELP":
      return "Here's what I can help with...";
    case "SEARCH_GAME":
    case "SEARCH_SOFTWARE":
      return name ? `Searching for ${name}...` : "Searching...";
    default:
      if (confidence.level === "low") {
        return "I'm not sure what you're looking for. Try being more specific.";
      }
      return "Processing...";
  }
}

export function findMatchingSoftware(
  result: ParseResult,
  allSoftware: Software[]
): Software[] {
  const { primaryIntent, entities, resolvedAlias } = result;

  if (resolvedAlias) {
    const match = allSoftware.find((s) => s.id === resolvedAlias.id);
    if (match) return [match];
  }

  if (entities.gameTitle) {
    const titleLower = entities.gameTitle.toLowerCase();
    const match = allSoftware.find(
      (s) =>
        s.title.toLowerCase().includes(titleLower) ||
        s.id.toLowerCase().includes(titleLower.replace(/[^a-z0-9]+/g, "-"))
    );
    if (match) return [match];
  }

  if (entities.softwareTitle) {
    const titleLower = entities.softwareTitle.toLowerCase();
    const match = allSoftware.find(
      (s) =>
        s.title.toLowerCase().includes(titleLower) ||
        s.id.toLowerCase().includes(titleLower.replace(/[^a-z0-9]+/g, "-"))
    );
    if (match) return [match];
  }

  let results = [...allSoftware];

  if (entities.genre) {
    const genreLower = entities.genre.toLowerCase();
    results = results.filter(
      (s) =>
        s.subcategory.toLowerCase().includes(genreLower) ||
        s.description.toLowerCase().includes(genreLower) ||
        s.features.some((f) => f.toLowerCase().includes(genreLower))
    );
  }

  if (entities.platform) {
    const platformLower = entities.platform.toLowerCase();
    if (platformLower !== "pc") {
      results = results.filter((s) => s.platform === platformLower || s.platform === "cross-platform");
    }
  }

  if (entities.maxSizeGB) {
    results = results.filter((s) => {
      const sizeMatch = s.size.match(/([\d.]+)\s*(GB|MB|TB)/i);
      if (!sizeMatch) return true;
      const size = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2].toUpperCase();
      if (unit === "MB") return size / 1024 <= entities.maxSizeGB!;
      if (unit === "TB") return size * 1024 <= entities.maxSizeGB!;
      return size <= entities.maxSizeGB!;
    });
  }

  if (entities.searchTerms.length > 0) {
    const query = entities.searchTerms.join(" ");
    results.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aMatch = aTitle.includes(query) ? 10 : 0;
      const bMatch = bTitle.includes(query) ? 10 : 0;
      return bMatch - aMatch || b.rating - a.rating;
    });
  } else {
    results.sort((a, b) => b.downloads - a.downloads);
  }

  return results;
}

import type { Software } from "@/lib/data";
import { parseSizeGB } from "@/lib/data";
import { similarity, tokenSimilarity } from "@/lib/parser/fuzzyMatch";
import { normalizeForSearch, extractTokens } from "@/lib/parser/normalize";
import { fuzzyResolveAlias } from "@/lib/parser/aliases";

export interface SearchResult {
  software: Software;
  score: number;
  matchType: "exact_title" | "exact_alias" | "token_match" | "prefix_match" | "fuzzy_match" | "category_match" | "description_match";
}

export interface SearchFilters {
  platform?: string;
  category?: string;
  subcategory?: string;
  minRating?: number;
  maxSizeGB?: number;
}

export function intelligentSearch(
  query: string,
  allSoftware: Software[],
  filters?: SearchFilters
): SearchResult[] {
  const normalized = normalizeForSearch(query);
  const tokens = extractTokens(query);

  let items = allSoftware;
  if (filters?.platform && filters.platform !== "all") {
    items = items.filter(
      (s) => s.platform === filters.platform || s.platform === "cross-platform"
    );
  }
  if (filters?.category && filters.category !== "all") {
    items = items.filter((s) => s.category === filters.category);
  }
  if (filters?.subcategory && filters.subcategory !== "all") {
    items = items.filter((s) => s.subcategory === filters.subcategory);
  }
  if (filters?.minRating) {
    items = items.filter((s) => s.rating >= (filters.minRating as number));
  }
  if (filters?.maxSizeGB) {
    items = items.filter((s) => {
      const sizeGB = parseSizeGB(s.size);
      return sizeGB === null || sizeGB <= (filters.maxSizeGB as number);
    });
  }

  const aliasMatch = fuzzyResolveAlias(query);
  if (aliasMatch) {
    const match = items.find((s) => s.id === aliasMatch.id);
    if (match) {
      return [{
        software: match,
        score: 100,
        matchType: "exact_alias",
      }];
    }
  }

  const results: SearchResult[] = [];

  for (const item of items) {
    let score = 0;
    let matchType: SearchResult["matchType"] = "description_match";

    const titleLower = item.title.toLowerCase();
    const normalizedTitle = normalizeForSearch(item.title);

    if (titleLower === normalized || normalizedTitle === normalized) {
      score = 100;
      matchType = "exact_title";
    } else if (titleLower.startsWith(normalized) || normalizedTitle.startsWith(normalized)) {
      score = 90;
      matchType = "prefix_match";
    } else {
      const titleSim = similarity(normalized, titleLower);
      if (titleSim > 0.8) {
        score = titleSim * 85;
        matchType = "fuzzy_match";
      }
    }

    if (score === 0) {
      for (const token of tokens) {
        if (titleLower.includes(token)) {
          score += 15;
          matchType = "token_match";
        }
      }
    }

    if (score === 0) {
      const subSim = tokenSimilarity(normalized, item.subcategory.toLowerCase());
      if (subSim > 0.5) {
        score = subSim * 40;
        matchType = "category_match";
      }
    }

    if (score === 0) {
      const catSim = tokenSimilarity(normalized, item.category.toLowerCase());
      if (catSim > 0.5) {
        score = catSim * 25;
        matchType = "category_match";
      }
    }

    if (score === 0) {
      for (const token of tokens) {
        if (item.description.toLowerCase().includes(token)) {
          score += 3;
          matchType = "description_match";
        }
      }
    }

    if (score === 0) {
      for (const feature of item.features) {
        if (tokens.some((t) => feature.toLowerCase().includes(t))) {
          score += 5;
          matchType = "description_match";
          break;
        }
      }
    }

    if (score > 0) {
      score += Math.min(item.rating, 5);
      score += Math.min(item.downloads / 100000, 5);
      results.push({ software: item, score, matchType });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

export function getSearchSuggestions(
  query: string,
  allSoftware: Software[]
): string[] {
  if (query.length < 2) return [];
  const normalized = normalizeForSearch(query);
  const suggestions: string[] = [];

  const aliasMatch = fuzzyResolveAlias(query);
  if (aliasMatch) {
    suggestions.push(aliasMatch.canonical);
    suggestions.push(`${aliasMatch.canonical} requirements`);
    suggestions.push(`Download ${aliasMatch.canonical}`);
  }

  for (const item of allSoftware) {
    if (suggestions.length >= 8) break;
    const titleLower = item.title.toLowerCase();
    if (titleLower.includes(normalized) && !suggestions.includes(item.title)) {
      suggestions.push(item.title);
    }
  }

  if (suggestions.length < 8) {
    const genres = new Set(allSoftware.map((s) => s.subcategory));
    for (const genre of genres) {
      if (suggestions.length >= 8) break;
      if (genre.toLowerCase().includes(normalized) && !suggestions.includes(genre)) {
        suggestions.push(genre);
      }
    }
  }

  return suggestions.slice(0, 8);
}

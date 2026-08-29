export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

export function similarity(a: string, b: string): number {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();

  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.9;

  const aTokens = new Set(na.split(/\s+/));
  const bTokens = new Set(nb.split(/\s+/));
  let intersection = 0;
  for (const t of aTokens) {
    if (bTokens.has(t)) intersection++;
  }
  const union = aTokens.size + bTokens.size - intersection;
  const jaccard = union === 0 ? 0 : intersection / union;

  const maxLen = Math.max(na.length, nb.length);
  const levScore = maxLen === 0 ? 1 : 1 - levenshteinDistance(na, nb) / maxLen;

  return Math.max(jaccard, levScore);
}

export function tokenSimilarity(a: string, b: string): number {
  const aTokens = a.toLowerCase().split(/\s+/);
  const bTokens = b.toLowerCase().split(/\s+/);

  let totalScore = 0;
  let matched = 0;

  for (const at of aTokens) {
    let bestTokenScore = 0;
    for (const bt of bTokens) {
      const score = similarity(at, bt);
      if (score > bestTokenScore) bestTokenScore = score;
    }
    if (bestTokenScore > 0.5) {
      totalScore += bestTokenScore;
      matched++;
    }
  }

  return aTokens.length === 0 ? 0 : totalScore / aTokens.length;
}

export function findBestMatch(
  query: string,
  candidates: { id: string; title: string; aliases?: string[] }[]
): { id: string; score: number } | null {
  let bestMatch: { id: string; score: number } | null = null;

  for (const candidate of candidates) {
    let bestScore = similarity(query, candidate.title.toLowerCase());

    if (candidate.aliases) {
      for (const alias of candidate.aliases) {
        const score = similarity(query, alias.toLowerCase());
        if (score > bestScore) bestScore = score;
      }
    }

    const titleTokens = candidate.title.toLowerCase().split(/\s+/);
    for (const token of titleTokens) {
      if (token.length > 2 && query.includes(token)) {
        bestScore = Math.max(bestScore, 0.85);
      }
    }

    if (bestMatch === null || bestScore > bestMatch.score) {
      bestMatch = { id: candidate.id, score: bestScore };
    }
  }

  return bestMatch;
}

export function fuzzySearch(
  query: string,
  items: { id: string; title: string; aliases?: string[]; category?: string; subcategory?: string; description?: string }[],
  threshold: number = 0.3
): { id: string; score: number }[] {
  const results: { id: string; score: number }[] = [];

  for (const item of items) {
    let score = 0;

    score = Math.max(score, similarity(query, item.title.toLowerCase()) * 10);

    if (item.aliases) {
      for (const alias of item.aliases) {
        score = Math.max(score, similarity(query, alias.toLowerCase()) * 9.5);
      }
    }

    if (item.subcategory) {
      const subScore = tokenSimilarity(query, item.subcategory.toLowerCase());
      score = Math.max(score, subScore * 6);
    }

    if (item.category) {
      const catScore = tokenSimilarity(query, item.category.toLowerCase());
      score = Math.max(score, catScore * 4);
    }

    if (item.description) {
      const descScore = tokenSimilarity(query, item.description.toLowerCase());
      score = Math.max(score, descScore * 2);
    }

    const queryTokens = query.toLowerCase().split(/\s+/);
    for (const qt of queryTokens) {
      if (qt.length > 2 && item.title.toLowerCase().includes(qt)) {
        score = Math.max(score, 7);
      }
      if (qt.length > 2 && item.subcategory?.toLowerCase().includes(qt)) {
        score = Math.max(score, 5);
      }
    }

    if (score >= threshold * 10) {
      results.push({ id: item.id, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

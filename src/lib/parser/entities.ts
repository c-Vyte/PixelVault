export interface ExtractedEntities {
  gameTitle: string | null;
  softwareTitle: string | null;
  genre: string | null;
  platform: string | null;
  maxSizeGB: number | null;
  minRating: number | null;
  category: string | null;
  comparisonTarget: string | null;
  secondComparisonTarget: string | null;
  searchTerms: string[];
  year: number | null;
}

const GENRES = [
  "action", "adventure", "rpg", "shooter", "strategy", "racing", "simulation",
  "horror", "puzzle", "fighting", "sports", "stealth", "platformer", "roguelike",
  "soulslike", "survival", "open world", "indie", "mmorpg", "moba", "battle royale",
  "card game", "visual novel", "rhythm", "sandbox", "coop", "multiplayer",
  "first person", "third person", "top down", "isometric", "side scroller",
];

const PLATFORMS = ["windows", "mac", "android", "ios", "linux", "pc", "cross-platform"];

const GENRE_ALIASES: Record<string, string> = {
  fps: "shooter",
  tps: "shooter",
  "first person shooter": "shooter",
  "third person shooter": "shooter",
  arpg: "rpg",
  jrpg: "rpg",
  "action rpg": "rpg",
  "massively multiplayer": "mmorpg",
  "battle royal": "battle royale",
  hack: "action",
  slash: "action",
  "hack and slash": "action",
  "hack-n-slash": "action",
  stealth: "stealth",
  puzzle: "puzzle",
  platformer: "platformer",
  racer: "racing",
  racing: "racing",
  sim: "simulation",
  strategy: "strategy",
  rts: "strategy",
  "real time strategy": "strategy",
  "turn based": "strategy",
  survival: "survival",
  horror: "horror",
  "survival horror": "horror",
  indie: "indie",
  "open world": "open world",
  sandbox: "sandbox",
  coop: "coop",
  "co op": "coop",
  "co-op": "coop",
  multiplayer: "multiplayer",
  singleplayer: "single player",
  "single player": "single player",
  mmorpg: "mmorpg",
  moba: "moba",
  "card game": "card game",
  "visual novel": "visual novel",
  rhythm: "rhythm",
};

export function extractEntities(input: string, normalizedInput: string): ExtractedEntities {
  const lower = normalizedInput.toLowerCase();
  const entities: ExtractedEntities = {
    gameTitle: null,
    softwareTitle: null,
    genre: null,
    platform: null,
    maxSizeGB: null,
    minRating: null,
    category: null,
    comparisonTarget: null,
    secondComparisonTarget: null,
    searchTerms: [],
    year: null,
  };

  const compMatch = lower.match(/compare\s+(.+?)\s+(?:and|vs|versus|with)\s+(.+)/i);
  if (compMatch) {
    entities.comparisonTarget = compMatch[1].trim();
    entities.secondComparisonTarget = compMatch[2].trim();
    entities.gameTitle = compMatch[1].trim();
    return entities;
  }

  const sizeMatch = lower.match(/under\s+(\d+)\s*gb/);
  if (sizeMatch) {
    entities.maxSizeGB = parseInt(sizeMatch[1], 10);
  }

  const yearMatch = lower.match(/\b(20[12]\d)\b/);
  if (yearMatch) {
    entities.year = parseInt(yearMatch[1], 10);
  }

  const ratingMatch = lower.match(/(?:rated?|score|rating)\s*(?:above|over|more than|at least|minimum)\s*([\d.]+)/);
  if (ratingMatch) {
    entities.minRating = parseFloat(ratingMatch[1]);
    if (entities.minRating > 5) entities.minRating = entities.minRating / 2;
  }

  for (const [alias, genre] of Object.entries(GENRE_ALIASES)) {
    if (lower.includes(alias)) {
      entities.genre = genre;
      break;
    }
  }
  if (!entities.genre) {
    for (const genre of GENRES) {
      if (lower.includes(genre)) {
        entities.genre = genre;
        break;
      }
    }
  }

  for (const platform of PLATFORMS) {
    if (lower.includes(platform) || lower.includes(platform + " only")) {
      entities.platform = platform;
      break;
    }
  }
  if (lower.includes(" pc") || lower.includes("computer")) {
    entities.platform = "windows";
  }

  const cleaned = normalizedInput
    .replace(/\b(can|could|would|will|should|do|does|did|is|are|was|were|be|been|being|have|has|had|not|no|yes|please|thanks|thank|show|find|get|give|tell|me|us|about|some|any|all|need|want|like|run|play|download|install|check|see|look|that|this|the|a|an|my|your|our|their|his|her|its|it|i|we|you|they|he|she|on|in|for|of|with|by|from|to|at|or|and|but|if|then|than|so|because|how|what|when|where|which|who|whom|why|just|also|only|really|very|more|most|best|worst|good|great|new|old|big|small|fast|slow|light|heavy|easy|hard|free|paid|full|lite|pro|plus|ultra|mini|max|super|mega|hyper|turbo|extreme|ultimate|premium|basic|standard|advanced)\b/g, " ")
    .replace(/\b(game|games|software|app|apps|tool|tools|program|programs|application|applications|stuff|things|items|content|data|info|information|details|specs|requirements|specifications|system|pc|computer|laptop|machine|platform|windows|mac|android|ios|linux)\b/g, " ")
    .replace(/\b(under|over|less|more|than|above|below|before|after|released|year|rated|score|size|gb|mb|tb|gb)\b/g, " ")
    .replace(/\d+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const terms = cleaned.split(" ").filter((t) => t.length > 1);
  entities.searchTerms = terms;

  return entities;
}

export function extractComparisonTargets(input: string): { first: string; second: string } | null {
  const patterns = [
    /compare\s+(.+?)\s+(?:and|vs|versus|with)\s+(.+)/i,
    /(?:what|which)\s+(?:is\s+)?(?:better|worse|bigger|smaller)[,\s]+(.+?)\s+or\s+(.+)/i,
    /difference\s+between\s+(.+?)\s+and\s+(.+)/i,
    /(.+?)\s+vs\s+(.+)/i,
    /(.+?)\s+versus\s+(.+)/i,
  ];

  for (const p of patterns) {
    const m = input.match(p);
    if (m?.[1] && m?.[2]) {
      return { first: m[1].trim(), second: m[2].trim() };
    }
  }
  return null;
}

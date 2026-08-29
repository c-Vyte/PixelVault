export interface ConversationContext {
  currentGame: string | null;
  previousGame: string | null;
  currentSoftware: string | null;
  previousSoftware: string | null;
  currentIntent: string | null;
  previousIntent: string | null;
  lastSearchResults: string[];
  currentCategory: string | null;
  currentGenre: string | null;
  currentPlatform: string | null;
  recentQueries: string[];
  comparisonTarget: string | null;
}

const CONTEXT_KEY = "parser_context";
const MAX_RECENT = 10;

let context: ConversationContext = {
  currentGame: null,
  previousGame: null,
  currentSoftware: null,
  previousSoftware: null,
  currentIntent: null,
  previousIntent: null,
  lastSearchResults: [],
  currentCategory: null,
  currentGenre: null,
  currentPlatform: null,
  recentQueries: [],
  comparisonTarget: null,
};

export function getContext(): ConversationContext {
  if (typeof window === "undefined") return context;
  try {
    const stored = localStorage.getItem(CONTEXT_KEY);
    if (stored) {
      context = JSON.parse(stored);
    }
  } catch {}
  return context;
}

export function saveContext(ctx: Partial<ConversationContext>): void {
  context = { ...getContext(), ...ctx };
  if (context.recentQueries.length > MAX_RECENT) {
    context.recentQueries = context.recentQueries.slice(-MAX_RECENT);
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
    } catch {}
  }
}

export function addRecentQuery(query: string): void {
  const ctx = getContext();
  ctx.recentQueries = [...ctx.recentQueries.filter((q) => q !== query), query].slice(-MAX_RECENT);
  saveContext(ctx);
}

export function setCurrentGame(title: string | null): void {
  const ctx = getContext();
  saveContext({
    previousGame: ctx.currentGame,
    currentGame: title,
    currentSoftware: null,
  });
}

export function setCurrentSoftware(title: string | null): void {
  const ctx = getContext();
  saveContext({
    previousSoftware: ctx.currentSoftware,
    currentSoftware: title,
    currentGame: null,
  });
}

export function setCurrentIntent(intent: string): void {
  const ctx = getContext();
  saveContext({
    previousIntent: ctx.currentIntent,
    currentIntent: intent,
  });
}

export function setLastSearchResults(ids: string[]): void {
  saveContext({ lastSearchResults: ids });
}

export function setCurrentCategory(category: string | null): void {
  saveContext({ currentCategory: category });
}

export function setCurrentGenre(genre: string | null): void {
  saveContext({ currentGenre: genre });
}

export function setCurrentPlatform(platform: string | null): void {
  saveContext({ currentPlatform: platform });
}

export function setComparisonTarget(target: string | null): void {
  saveContext({ comparisonTarget: target });
}

export function clearContext(): void {
  context = {
    currentGame: null,
    previousGame: null,
    currentSoftware: null,
    previousSoftware: null,
    currentIntent: null,
    previousIntent: null,
    lastSearchResults: [],
    currentCategory: null,
    currentGenre: null,
    currentPlatform: null,
    recentQueries: [],
    comparisonTarget: null,
  };
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(CONTEXT_KEY);
    } catch {}
  }
}

export function resolvePronouns(input: string, ctx: ConversationContext): string {
  let resolved = input;

  if (/\b(it|this|that|the game|the software|the app|the tool)\b/i.test(input)) {
    if (ctx.currentGame) {
      resolved = resolved.replace(/\b(it|this|that|the game)\b/gi, ctx.currentGame);
    } else if (ctx.currentSoftware) {
      resolved = resolved.replace(/\b(it|this|that|the software|the app|the tool)\b/gi, ctx.currentSoftware);
    }
  }

  if (/\b(the requirements|the specs|the system requirements)\b/i.test(input)) {
    if (ctx.currentGame) {
      resolved = resolved.replace(/\b(the requirements|the specs|the system requirements)\b/gi, `${ctx.currentGame} requirements`);
    } else if (ctx.currentSoftware) {
      resolved = resolved.replace(/\b(the requirements|the specs|the system requirements)\b/gi, `${ctx.currentSoftware} requirements`);
    }
  }

  if (/\b(the first one|the second one|the last one|that one)\b/i.test(input) && ctx.lastSearchResults.length > 0) {
    resolved = resolved.replace(/\b(the first one)\b/gi, ctx.lastSearchResults[0] || "it");
    resolved = resolved.replace(/\b(the second one)\b/gi, ctx.lastSearchResults[1] || "it");
    resolved = resolved.replace(/\b(the last one)\b/gi, ctx.lastSearchResults[ctx.lastSearchResults.length - 1] || "it");
  }

  return resolved;
}

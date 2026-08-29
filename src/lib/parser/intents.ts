export type IntentType =
  | "SEARCH_GAME"
  | "SEARCH_SOFTWARE"
  | "OPEN_GAME"
  | "OPEN_SOFTWARE"
  | "GAME_REQUIREMENTS"
  | "SOFTWARE_REQUIREMENTS"
  | "CHECK_PC_COMPATIBILITY"
  | "GAME_RECOMMENDATION"
  | "SOFTWARE_RECOMMENDATION"
  | "SIMILAR_GAMES"
  | "SIMILAR_SOFTWARE"
  | "CATEGORY_SEARCH"
  | "TRENDING"
  | "NEW_RELEASES"
  | "RECENTLY_VIEWED"
  | "DOWNLOAD_GAME"
  | "DOWNLOAD_SOFTWARE"
  | "COMPARE_GAMES"
  | "FIND_GAMES_FOR_PC"
  | "FIND_LIGHTWEIGHT_GAMES"
  | "FIND_GAMES_BY_SIZE"
  | "FIND_GAMES_BY_GENRE"
  | "FIND_GAMES_BY_PLATFORM"
  | "HELP"
  | "UNKNOWN";

export interface IntentPattern {
  intent: IntentType;
  patterns: RegExp[];
  priority: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: "CHECK_PC_COMPATIBILITY",
    patterns: [
      /can\s+(my|i|we)\s+(pc|computer|laptop|system|machine)\s+(run|play|handle|execute)/i,
      /will\s+(it|this|the game|the software)\s+run/i,
      /will\s+\w+\s+run\s+on\s+(my|this|the)\s+(pc|computer|laptop|system)/i,
      /can\s+i\s+(run|play|execute)\s+.+\s+on\s+(my|this|the)\s+(pc|computer|laptop|system)/i,
      /is\s+my\s+(pc|computer|laptop|system)\s+(good enough|compatible|powerful|capable)/i,
      /check\s+(if\s+)?(my|this)\s+(pc|computer|laptop|system)\s+(can|will|runs?)/i,
      /(?:pc|computer|system)\s+compat(?:ible|ibility)/i,
      /will\s+this\s+(run|work|play)/i,
      /can\s+my\s+(pc|computer)\s+handle/i,
      /will\s+it\s+run\s+on/i,
      /run\s+on\s+my/i,
      /compatible\s+with\s+my/i,
      /my\s+(pc|computer|laptop|system)\s+can\s+(run|play|handle)/i,
      /does\s+my\s+(pc|computer)\s+meet/i,
      /what\s+are\s+the\s+(system\s+)?requirements/i,
      /specs?\s+(for|needed|required|necessary)/i,
      /requirements?\s+(for|of)/i,
    ],
    priority: 90,
  },
  {
    intent: "GAME_REQUIREMENTS",
    patterns: [
      /(?:show|get|what\s+are|list|tell)\s+(?:me\s+)?(?:the\s+)?(?:system\s+)?requirements?\s+(?:for|of)\s+(.+)/i,
      /requirements?\s+(?:for|of)\s+(.+)/i,
      /(.+)\s+requirements?\s+(?:specs?|info|details)/i,
      /what\s+do\s+i\s+need\s+(?:to\s+run|for)\s+(.+)/i,
      /system\s+(?:specs?|requirements?)\s+(?:for|of)\s+(.+)/i,
      /min(?:imum)?\s+(?:and\s+)?rec(?:ommended)?\s+(?:specs?|requirements?)\s+(?:for|of)\s+(.+)/i,
    ],
    priority: 85,
  },
  {
    intent: "SOFTWARE_REQUIREMENTS",
    patterns: [
      /(?:show|get|what\s+are|list|tell)\s+(?:me\s+)?(?:the\s+)?(?:system\s+)?requirements?\s+(?:for|of)\s+(.+)/i,
      /requirements?\s+(?:for|of)\s+(.+)/i,
      /what\s+do\s+i\s+need\s+(?:to\s+install|for)\s+(.+)/i,
    ],
    priority: 85,
  },
  {
    intent: "DOWNLOAD_GAME",
    patterns: [
      /download\s+(.+)/i,
      /get\s+(.+)\s+(?:now|download|installer)/i,
      /where\s+(?:can\s+i\s+)?(?:i\s+)?download\s+(.+)/i,
      /(?:i\s+)?(?:want|need)\s+to\s+download\s+(.+)/i,
    ],
    priority: 80,
  },
  {
    intent: "DOWNLOAD_SOFTWARE",
    patterns: [
      /download\s+(.+)/i,
      /get\s+(.+)\s+(?:now|download|installer)/i,
      /where\s+(?:can\s+i\s+)?(?:i\s+)?download\s+(.+)/i,
    ],
    priority: 80,
  },
  {
    intent: "SIMILAR_GAMES",
    patterns: [
      /(?:show|find|get|give)\s+(?:me\s+)?(?:some\s+)?(?:games?\s+)?(?:like|similar\s+to|similar|related\s+to)\s+(.+)/i,
      /games?\s+(?:like|similar\s+to|related\s+to)\s+(.+)/i,
      /something\s+(?:like|similar)\s+(?:to\s+)?(.+)/i,
      /more\s+(?:games?\s+)?(?:like|similar)\s+(?:to\s+)?(.+)/i,
      /other\s+games?\s+(?:like|similar)\s+(?:to\s+)?(.+)/i,
    ],
    priority: 75,
  },
  {
    intent: "SIMILAR_SOFTWARE",
    patterns: [
      /(?:show|find|get|give)\s+(?:me\s+)?(?:some\s+)?(?:software\s+)?(?:like|similar\s+to|alternatives?\s+to|alternatives?)\s+(.+)/i,
      /(?:software|tools?|apps?)\s+(?:like|similar\s+to|alternatives?\s+to)\s+(.+)/i,
      /something\s+(?:like|similar)\s+(?:to\s+)?(.+)/i,
      /alternatives?\s+(?:to|for)\s+(.+)/i,
    ],
    priority: 75,
  },
  {
    intent: "GAME_RECOMMENDATION",
    patterns: [
      /(?:show|find|get|give|recommend|suggest)\s+(?:me\s+)?(?:some\s+)?(?:good\s+)?(?:games?\s+)?(?:for|in|about)\s+(.+)/i,
      /(?:what|which)\s+games?\s+(?:should|would|can)\s+i\s+(?:play|try|get)/i,
      /recommend\s+(?:me\s+)?(?:a\s+)?(?:good\s+)?games?/i,
      /suggest\s+(?:me\s+)?(?:some\s+)?(?:good\s+)?games?/i,
      /good\s+games?\s+(?:for|in|about)\s+(.+)/i,
    ],
    priority: 70,
  },
  {
    intent: "SOFTWARE_RECOMMENDATION",
    patterns: [
      /(?:show|find|get|give|recommend|suggest)\s+(?:me\s+)?(?:some\s+)?(?:good\s+)?(?:software|tools?|apps?)\s+(?:for|in|about)\s+(.+)/i,
      /(?:what|which)\s+(?:software|tools?|apps?)\s+(?:should|would|can)\s+i\s+(?:use|try|get)/i,
      /recommend\s+(?:me\s+)?(?:a\s+)?(?:good\s+)?(?:software|tool|app)/i,
      /suggest\s+(?:me\s+)?(?:some\s+)?(?:good\s+)?(?:software|tool|app)/i,
      /(?:good|best)\s+(?:software|tools?|apps?)\s+(?:for|in|about)\s+(.+)/i,
    ],
    priority: 70,
  },
  {
    intent: "FIND_GAMES_FOR_PC",
    patterns: [
      /(?:find|show|get|give)\s+(?:me\s+)?(?:some\s+)?games?\s+(?:my\s+)?pc\s+(?:can\s+)?(?:run|play|handle|support)/i,
      /games?\s+(?:my\s+)?pc\s+can\s+(?:run|play|handle)/i,
      /(?:what|which)\s+games?\s+(?:can|will)\s+my\s+pc\s+(?:run|play|handle)/i,
      /games?\s+(?:that\s+)?(?:will|can)\s+run\s+on\s+my\s+pc/i,
      /find\s+games?\s+for\s+(?:my\s+)?(?:pc|computer|system|laptop)/i,
      /games?\s+(?:that\s+)?work\s+on\s+my\s+pc/i,
      /lightweight\s+games?/i,
      /games?\s+for\s+low[\s-]*end\s+(?:pc|computer|laptop|system)/i,
      /games?\s+for\s+(?:a\s+)?(?:weak|slow|old|budget)\s+(?:pc|computer|laptop)/i,
    ],
    priority: 88,
  },
  {
    intent: "FIND_LIGHTWEIGHT_GAMES",
    patterns: [
      /lightweight\s+games?/i,
      /games?\s+for\s+low[\s-]*end/i,
      /small\s+games?/i,
      /games?\s+under\s+(\d+)\s*gb/i,
      /games?\s+(?:that\s+)?(?:will|can)\s+run\s+on\s+(?:a\s+)?(?:weak|slow|old|budget|low[\s-]*end)/i,
      /games?\s+for\s+(?:my\s+)?(?:potato|old|weak)\s+pc/i,
    ],
    priority: 82,
  },
  {
    intent: "FIND_GAMES_BY_GENRE",
    patterns: [
      /(?:find|show|get|list)\s+(?:me\s+)?(?:some\s+)?(\w+)\s+games?/i,
      /(\w+)\s+games?/i,
      /games?\s+(?:in|of|from)\s+(?:the\s+)?(\w+)\s+genre/i,
      /best\s+(\w+)\s+games?/i,
    ],
    priority: 65,
  },
  {
    intent: "FIND_GAMES_BY_SIZE",
    patterns: [
      /games?\s+under\s+(\d+)\s*gb/i,
      /games?\s+(?:less|smaller)\s+than\s+(\d+)\s*gb/i,
      /small\s+(?:sized?\s+)?games?/i,
      /games?\s+(?:less|smaller)\s+than\s+(\d+)\s*gb/i,
      /games?\s+under\s+(\d+)\s*gb/i,
    ],
    priority: 68,
  },
  {
    intent: "COMPARE_GAMES",
    patterns: [
      /compare\s+(.+)\s+(?:and|vs|versus|with)\s+(.+)/i,
      /(?:what|which)\s+(?:is\s+)?(?:better|worse|bigger|smaller|faster|slower)[,\s]+(.+)\s+or\s+(.+)/i,
      /difference\s+between\s+(.+)\s+and\s+(.+)/i,
      /(.+)\s+vs\s+(.+)/i,
      /(.+)\s+versus\s+(.+)/i,
    ],
    priority: 72,
  },
  {
    intent: "TRENDING",
    patterns: [
      /(?:show|what|get|list)\s+(?:me\s+)?(?:the\s+)?(?:most\s+)?trending/i,
      /trending\s+(?:games?|software|apps?)/i,
      /popular\s+(?:games?|software|apps?)/i,
      /(?:what|which)\s+(?:games?|software)\s+(?:is|are)\s+trending/i,
      /top\s+(?:downloaded|popular|trending)/i,
    ],
    priority: 60,
  },
  {
    intent: "NEW_RELEASES",
    patterns: [
      /(?:show|what|get|list)\s+(?:me\s+)?(?:the\s+)?(?:new|latest|recent|newest)\s+(?:releases?|games?|software|apps?)/i,
      /new\s+(?:releases?|games?|software|apps?)/i,
      /latest\s+(?:releases?|games?|software|apps?)/i,
      /recently\s+(?:added|released|updated)/i,
    ],
    priority: 60,
  },
  {
    intent: "RECENTLY_VIEWED",
    patterns: [
      /(?:show|what|get|list)\s+(?:me\s+)?(?:my\s+)?recently\s+viewed/i,
      /recently\s+viewed/i,
      /(?:what|which)\s+(?:games?|software)\s+(?:did\s+i|have\s+i)\s+(?:recently\s+)?(?:view|see|visit|check)/i,
      /history/i,
      /my\s+history/i,
    ],
    priority: 55,
  },
  {
    intent: "FIND_GAMES_BY_PLATFORM",
    patterns: [
      /(?:find|show|get)\s+(?:me\s+)?(?:some\s+)?(\w+)\s+games?/i,
      /games?\s+(?:for|on)\s+(windows|mac|android|ios|linux|pc)/i,
      /(\w+)\s+(?:only\s+)?games?/i,
    ],
    priority: 55,
  },
  {
    intent: "HELP",
    patterns: [
      /^help$/i,
      /^help\s+me$/i,
      /what\s+can\s+(?:i|you|we)\s+do/i,
      /how\s+(?:do\s+i|can\s+i|to)\s+(?:use|search|find|download)/i,
      /what\s+(?:are\s+)?(?:the\s+)?(?:available\s+)?(?:commands?|options?|features?)/i,
      /how\s+does\s+this\s+(?:work|site|system)/i,
    ],
    priority: 40,
  },
];

export interface ClassifiedIntent {
  intent: IntentType;
  confidence: number;
  matchedPattern?: RegExp;
}

export function classifyIntent(normalizedInput: string): ClassifiedIntent[] {
  const results: ClassifiedIntent[] = [];

  for (const intentPattern of INTENT_PATTERNS) {
    for (const pattern of intentPattern.patterns) {
      const match = normalizedInput.match(pattern);
      if (match) {
        let confidence = intentPattern.priority / 100;
        if (match[1] && match[1].length > 2) confidence = Math.min(confidence + 0.1, 1.0);
        results.push({
          intent: intentPattern.intent,
          confidence,
          matchedPattern: pattern,
        });
        break;
      }
    }
  }

  results.sort((a, b) => b.confidence - a.confidence);
  return results;
}

export function getTopIntent(normalizedInput: string): ClassifiedIntent | null {
  const intents = classifyIntent(normalizedInput);
  return intents.length > 0 ? intents[0] : null;
}

export function normalize(input: string): string {
  let text = input.trim();

  text = text.toLowerCase();

  text = text.replace(/['']/g, "'");
  text = text.replace(/[""]/g, '"');
  text = text.replace(/…/g, "...");
  text = text.replace(/[–—]/g, "-");
  text = text.replace(/\.{4,}/g, "...");
  text = text.replace(/[!]{2,}/g, "!");
  text = text.replace(/[?]{2,}/g, "?");

  text = text.replace(/\b(gta5|gta v|gta 5)\b/g, "gta v");
  text = text.replace(/\b(cyberpunk2077|cyberpunk 2077|cyber punk 2077|cp2077|cp 2077)\b/g, "cyberpunk 2077");
  text = text.replace(/\b(rdr2|rdr 2|red dead 2)\b/g, "red dead redemption 2");
  text = text.replace(/\b(bg3|bg 3|baldurs gate 3|baldur's gate 3)\b/g, "baldur's gate 3");
  text = text.replace(/\b(tw3|tw 3|witcher 3|the witcher 3)\b/g, "the witcher 3");
  text = text.replace(/\b(gtav|gtasan)\b/g, "gta");

  text = text.replace(/\b(can|could|would|will|should)\s+(i|we|you|my|our|the)\b/g, "$1 $2");
  text = text.replace(/\b(wanna|gonna|gotta|lemme|gimme)\b/g, (m) => {
    const map: Record<string, string> = { wanna: "want to", gonna: "going to", gotta: "got to", lemme: "let me", gimme: "give me" };
    return map[m] || m;
  });

  text = text.replace(/\b(pls|plz|plox|pls)\b/g, "please");
  text = text.replace(/\b(thx|ty|tnx|tq)\b/g, "thank you");
  text = text.replace(/\bcuz\b/g, "because");
  text = text.replace(/\bwo\b/g, "without");

  text = text.replace(/\b(pc|personal computer)\b/g, "pc");
  text = text.replace(/\b(os|operating system)\b/g, "os");
  text = text.replace(/\b(vidya|vid)\b/g, "game");
  text = text.replace(/\b(sw|soft)\b/g, "software");
  text = text.replace(/\b(sys)\b/g, "system");
  text = text.replace(/\b(req|reqs)\b/g, "requirements");
  text = text.replace(/\b(rec|recs)\b/g, "recommended");
  text = text.replace(/\b(min)\b/g, "minimum");
  text = text.replace(/\b(gpu|gfx)\b/g, "gpu");
  text = text.replace(/\b(cpu)\b/g, "cpu");
  text = text.replace(/\b(ram)\b/g, "ram");
  text = text.replace(/\b(vram)\b/g, "vram");
  text = text.replace(/\b(ssd)\b/g, "ssd");
  text = text.replace(/\b(hdd)\b/g, "hdd");

  text = text.replace(/\s+/g, " ");
  text = text.replace(/\bthe\s+the\b/g, "the");
  text = text.replace(/\ba\s+a\b/g, "a");

  return text.trim();
}

export function normalizeForSearch(input: string): string {
  let text = normalize(input);
  text = text.replace(/[^\w\s]/g, " ");
  text = text.replace(/\s+/g, " ");
  return text.trim();
}

export function extractTokens(input: string): string[] {
  const normalized = normalizeForSearch(input);
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "it", "this", "that", "are", "was",
    "were", "be", "been", "being", "have", "has", "had", "do", "does",
    "did", "will", "would", "could", "should", "may", "might", "can",
    "i", "me", "my", "we", "our", "you", "your", "he", "she", "they",
    "them", "his", "her", "its", "their", "what", "which", "who", "whom",
    "how", "when", "where", "why", "show", "find", "get", "give", "tell",
    "me", "us", "about", "some", "any", "all", "need", "want", "like",
    "run", "play", "download", "install", "check", "see", "look",
  ]);

  return normalized
    .split(" ")
    .filter((t) => t.length > 1 && !stopWords.has(t));
}

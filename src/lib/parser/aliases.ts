export interface AliasEntry {
  canonical: string;
  id: string;
  aliases: string[];
  category?: string;
  type: "game" | "software";
}

const ALIASES: AliasEntry[] = [
  { id: "gta5", canonical: "Grand Theft Auto V", aliases: ["gta", "gta 5", "gta v", "gta5", "grand theft auto", "grand theft auto v", "grand theft auto 5"], type: "game" },
  { id: "cyberpunk-2077", canonical: "Cyberpunk 2077", aliases: ["cyberpunk", "cyberpunk 2077", "cyber punk", "cyberpunk2077", "cp2077", "cp 2077"], type: "game" },
  { id: "elden-ring", canonical: "Elden Ring", aliases: ["elden ring", "eldenring", "elden ring"], type: "game" },
  { id: "red-dead-redemption-2", canonical: "Red Dead Redemption 2", aliases: ["rdr2", "rdr 2", "red dead", "red dead 2", "red dead redemption", "red dead redemption 2"], type: "game" },
  { id: "baldurs-gate-3", canonical: "Baldur's Gate 3", aliases: ["bg3", "bg 3", "baldurs gate", "baldurs gate 3", "baldur's gate", "baldur's gate 3"], type: "game" },
  { id: "the-witcher-3", canonical: "The Witcher 3", aliases: ["witcher", "witcher 3", "tw3", "tw 3", "the witcher", "the witcher 3", "witcher wild hunt"], type: "game" },
  { id: "fortnite", canonical: "Fortnite", aliases: ["fortnite", "fortnite battle royale", "fortnite save the world"], type: "game" },
  { id: "valorant", canonical: "Valorant", aliases: ["valorant"], type: "game" },
  { id: "counter-strike-2", canonical: "Counter-Strike 2", aliases: ["cs2", "cs 2", "counter strike", "counter strike 2", "csgo", "cs:go"], type: "game" },
  { id: "diablo-iv", canonical: "Diablo IV", aliases: ["diablo", "diablo 4", "diablo iv", "diablo4", "diablo iv"], type: "game" },
  { id: "god-of-war-ragnarok", canonical: "God of War Ragnarok", aliases: ["god of war", "god of war ragnarok", "gow", "gow ragnarok"], type: "game" },
  { id: "minecraft", canonical: "Minecraft", aliases: ["minecraft", "mine craft"], type: "game" },
  { id: "fortnite", canonical: "Fortnite", aliases: ["fortnite"], type: "game" },
  { id: "league-of-legends", canonical: "League of Legends", aliases: ["lol", "league", "league of legends"], type: "game" },
  { id: "apex-legends", canonical: "Apex Legends", aliases: ["apex", "apex legends"], type: "game" },
  { id: "overwatch-2", canonical: "Overwatch 2", aliases: ["overwatch", "overwatch 2", "ow2", "ow 2"], type: "game" },
  { id: "rainbow-six-siege", canonical: "Rainbow Six Siege", aliases: ["r6", "r6s", "rainbow six", "rainbow six siege"], type: "game" },
  { id: "pubg", canonical: "PUBG", aliases: ["pubg", "pubg battlegrounds", "playerunknown battlegrounds"], type: "game" },
  { id: "starfield", canonical: "Starfield", aliases: ["starfield"], type: "game" },
  { id: "hogwarts-legacy", canonical: "Hogwarts Legacy", aliases: ["hogwarts", "hogwarts legacy"], type: "game" },
  { id: "palworld", canonical: "Palworld", aliases: ["palworld", "pal world"], type: "game" },
  { id: "helldivers-2", canonical: "Helldivers 2", aliases: ["helldivers", "helldivers 2"], type: "game" },
  { id: "resident-evil-4", canonical: "Resident Evil 4", aliases: ["re4", "re 4", "resident evil", "resident evil 4"], type: "game" },
  { id: "call-of-duty-modern-warfare", canonical: "Call of Duty: Modern Warfare", aliases: ["cod", "cod mw", "call of duty", "modern warfare", "cod modern warfare"], type: "game" },
  { id: "doom-eternal", canonical: "DOOM Eternal", aliases: ["doom", "doom eternal"], type: "game" },
  { id: "dark-souls-3", canonical: "Dark Souls 3", aliases: ["ds3", "ds 3", "dark souls", "dark souls 3"], type: "game" },
  { id: "sekiro", canonical: "Sekiro: Shadows Die Twice", aliases: ["sekiro", "sekiro shadows die twice"], type: "game" },
  { id: "death-stranding", canonical: "Death Stranding", aliases: ["death stranding"], type: "game" },
  { id: "horizon-zero-dawn", canonical: "Horizon Zero Dawn", aliases: ["hzd", "horizon", "horizon zero dawn"], type: "game" },
  { id: "spider-man", canonical: "Marvel's Spider-Man", aliases: ["spider man", "spider-man", "marvel spider man"], type: "game" },
  { id: "assassins-creed-valhalla", canonical: "Assassin's Creed Valhalla", aliases: ["acv", "ac v", "assassins creed", "assassins creed valhalla", "ac valhalla"], type: "game" },
  { id: "far-cry-6", canonical: "Far Cry 6", aliases: ["fc6", "fc 6", "far cry", "far cry 6"], type: "game" },
  { id: " battlefield-2042", canonical: "Battlefield 2042", aliases: ["bf2042", "bf 2042", "battlefield", "battlefield 2042"], type: "game" },
  { id: "total-war-warhammer-3", canonical: "Total War: Warhammer 3", aliases: ["tw warhammer 3", "total war warhammer", "total war warhammer 3"], type: "game" },
  { id: "cities-skylines-2", canonical: "Cities Skylines 2", aliases: ["cities skylines", "cities skylines 2", "cs2 cities"], type: "game" },
  { id: "civilization-vi", canonical: "Civilization VI", aliases: ["civ 6", "civ6", "civilization", "civilization vi"], type: "game" },
  { id: "simcity", canonical: "SimCity", aliases: ["simcity", "sim city"], type: "game" },
  { id: "the-sims-4", canonical: "The Sims 4", aliases: ["sims", "sims 4", "the sims", "the sims 4"], type: "game" },
  { id: "f1-24", canonical: "F1 24", aliases: ["f1", "f1 24", "formula 1"], type: "game" },
  { id: "forza-horizon-5", canonical: "Forza Horizon 5", aliases: ["forza", "forza horizon", "forza horizon 5", "fh5"], type: "game" },
  { id: "need-for-speed-heat", canonical: "Need for Speed Heat", aliases: ["nfs", "need for speed", "nfs heat"], type: "game" },
  { id: "the-last-of-us-part-1", canonical: "The Last of Us Part 1", aliases: ["tlou", "last of us", "the last of us", "tlou part 1"], type: "game" },
  { id: "uncharted", canonical: "Uncharted", aliases: ["uncharted", "uncharted legacy of thieves"], type: "game" },
  { id: "ghost-of-tsushima", canonical: "Ghost of Tsushima", aliases: ["ghost of tsushima", "ghost tsushima"], type: "game" },
  { id: "Returnal", canonical: "Returnal", aliases: ["returnal"], type: "game" },
  { id: "ratchet-and-clank", canonical: "Ratchet & Clank", aliases: ["ratchet", "ratchet and clank", "ratchet clank"], type: "game" },
  { id: "arma-3", canonical: "Arma 3", aliases: ["arma", "arma 3", "arma3"], type: "game" },
  { id: "dayz", canonical: "DayZ", aliases: ["dayz", "day z"], type: "game" },
  { id: "rust", canonical: "Rust", aliases: ["rust"], type: "game" },
  { id: "valheim", canonical: "Valheim", aliases: ["valheim"], type: "game" },
  { id: "subnautica", canonical: "Subnautica", aliases: ["subnautica"], type: "game" },
  { id: "no-mans-sky", canonical: "No Man's Sky", aliases: ["nms", "no mans sky", "no man's sky"], type: "game" },
  { id: "stardew-valley", canonical: "Stardew Valley", aliases: ["stardew", "stardew valley"], type: "game" },
  { id: "hollow-knight", canonical: "Hollow Knight", aliases: ["hollow knight", "hollowknight"], type: "game" },
  { id: "celeste", canonical: "Celeste", aliases: ["celeste"], type: "game" },
  { id: "cuphead", canonical: "Cuphead", aliases: ["cuphead"], type: "game" },
  { id: "undertale", canonical: "Undertale", aliases: ["undertale"], type: "game" },
  { id: "outer-wilds", canonical: "Outer Wilds", aliases: ["outer wilds"], type: "game" },
  { id: "disco-elysium", canonical: "Disco Elysium", aliases: ["disco elysium"], type: "game" },
  { id: "hades", canonical: "Hades", aliases: ["hades"], type: "game" },
  { id: "it-takes-two", canonical: "It Takes Two", aliases: ["it takes two"], type: "game" },
  { id: "sifu", canonical: "Sifu", aliases: ["sifu"], type: "game" },
  { id: "stray", canonical: "Stray", aliases: ["stray"], type: "game" },
  { id: "atomic-heart", canonical: "Atomic Heart", aliases: ["atomic heart", "atomicheart"], type: "game" },
  { id: "lies-of-p", canonical: "Lies of P", aliases: ["lies of p", "liesofp"], type: "game" },
  { id: "alan-wake-2", canonical: "Alan Wake 2", aliases: ["alan wake", "alan wake 2"], type: "game" },
  { id: "black-myth-wukong", canonical: "Black Myth: Wukong", aliases: ["black myth", "black myth wukong", "wukong"], type: "game" },

  { id: "photoshop", canonical: "Adobe Photoshop", aliases: ["photoshop", "adobe photoshop", "ps"], type: "software" },
  { id: "premiere-pro", canonical: "Adobe Premiere Pro", aliases: ["premiere", "premiere pro", "adobe premiere"], type: "software" },
  { id: "after-effects", canonical: "Adobe After Effects", aliases: ["after effects", "ae", "adobe after effects"], type: "software" },
  { id: "illustrator", canonical: "Adobe Illustrator", aliases: ["illustrator", "ai", "adobe illustrator"], type: "software" },
  { id: "blender", canonical: "Blender", aliases: ["blender"], type: "software" },
  { id: "figma", canonical: "Figma", aliases: ["figma"], type: "software" },
  { id: "vscode", canonical: "Visual Studio Code", aliases: ["vscode", "vs code", "visual studio code"], type: "software" },
  { id: "notion", canonical: "Notion", aliases: ["notion"], type: "software" },
  { id: "obs-studio", canonical: "OBS Studio", aliases: ["obs", "obs studio", "obs studio"], type: "software" },
  { id: "vlc", canonical: "VLC Media Player", aliases: ["vlc", "vlc player", "vlc media player"], type: "software" },
  { id: "7zip", canonical: "7-Zip", aliases: ["7zip", "7-zip", "7 zip"], type: "software" },
  { id: "winrar", canonical: "WinRAR", aliases: ["winrar", "win rar"], type: "software" },
  { id: "steam", canonical: "Steam", aliases: ["steam", "steam client"], type: "software" },
  { id: "epic-games", canonical: "Epic Games Launcher", aliases: ["epic", "epic games", "epic games launcher"], type: "software" },
  { id: "discord", canonical: "Discord", aliases: ["discord"], type: "software" },
  { id: "spotify", canonical: "Spotify", aliases: ["spotify"], type: "software" },
  { id: "chrome", canonical: "Google Chrome", aliases: ["chrome", "google chrome"], type: "software" },
  { id: "firefox", canonical: "Mozilla Firefox", aliases: ["firefox", "mozilla firefox"], type: "software" },
  { id: "brave", canonical: "Brave Browser", aliases: ["brave", "brave browser"], type: "software" },
  { id: "telegram", canonical: "Telegram", aliases: ["telegram", "tg"], type: "software" },
  { id: "whatsapp", canonical: "WhatsApp", aliases: ["whatsapp", "wa"], type: "software" },
  { id: "slack", canonical: "Slack", aliases: ["slack"], type: "software" },
  { id: "zoom", canonical: "Zoom", aliases: ["zoom", "zoom meeting"], type: "software" },
  { id: "teamviewer", canonical: "TeamViewer", aliases: ["teamviewer", "team viewer"], type: "software" },
  { id: "anydesk", canonical: "AnyDesk", aliases: ["anydesk", "any desk"], type: "software" },
  { id: "fl-studio", canonical: "FL Studio", aliases: ["fl studio", "fl", "fruity loops"], type: "software" },
  { id: "ableton", canonical: "Ableton Live", aliases: ["ableton", "ableton live"], type: "software" },
  { id: "davinci-resolve", canonical: "DaVinci Resolve", aliases: ["davinci", "davinci resolve", "da vinci resolve"], type: "software" },
  { id: "handbrake", canonical: "HandBrake", aliases: ["handbrake"], type: "software" },
  { id: "gimp", canonical: "GIMP", aliases: ["gimp"], type: "software" },
  { id: "audacity", canonical: "Audacity", aliases: ["audacity"], type: "software" },
  { id: "unity", canonical: "Unity", aliases: ["unity", "unity3d", "unity 3d"], type: "software" },
  { id: "unreal-engine", canonical: "Unreal Engine", aliases: ["unreal", "unreal engine", "ue5", "ue4"], type: "software" },
];

export function resolveAlias(input: string): AliasEntry | null {
  const normalized = input.toLowerCase().trim();
  for (const entry of ALIASES) {
    if (entry.id === normalized) return entry;
    if (entry.canonical.toLowerCase() === normalized) return entry;
    for (const alias of entry.aliases) {
      if (alias === normalized) return entry;
    }
  }
  return null;
}

export function fuzzyResolveAlias(input: string): AliasEntry | null {
  const exact = resolveAlias(input);
  if (exact) return exact;

  const normalized = input.toLowerCase().trim();
  let bestMatch: AliasEntry | null = null;
  let bestScore = 0;

  for (const entry of ALIASES) {
    for (const alias of entry.aliases) {
      const score = similarity(normalized, alias);
      if (score > bestScore && score > 0.6) {
        bestScore = score;
        bestMatch = entry;
      }
    }
    const titleScore = similarity(normalized, entry.canonical.toLowerCase());
    if (titleScore > bestScore && titleScore > 0.6) {
      bestScore = titleScore;
      bestMatch = entry;
    }
  }

  return bestMatch;
}

export function getAllAliases(): AliasEntry[] {
  return ALIASES;
}

export function getAliasesForType(type: "game" | "software"): AliasEntry[] {
  return ALIASES.filter((a) => a.type === type);
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;

  const aTokens = new Set(a.split(/\s+/));
  const bTokens = new Set(b.split(/\s+/));
  let intersection = 0;
  for (const t of aTokens) {
    if (bTokens.has(t)) intersection++;
  }
  const union = aTokens.size + bTokens.size - intersection;
  if (union === 0) return 0;
  const jaccard = intersection / union;

  const lev = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  const levScore = maxLen === 0 ? 1 : 1 - lev / maxLen;

  return Math.max(jaccard, levScore);
}

function levenshtein(a: string, b: string): number {
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

export interface SiteTheme {
  id: string;
  name: string;
  mode: "dark" | "light";
  description: string;
  swatch: [string, string, string];
}

export const SITE_THEMES: SiteTheme[] = [
  {
    id: "neon-violet",
    name: "Neon Violet",
    mode: "dark",
    description: "Signature PixelVault look - electric purple with rose accents.",
    swatch: ["#7c3aed", "#f43f5e", "#0f0f23"],
  },
  {
    id: "midnight-teal",
    name: "Midnight Teal",
    mode: "dark",
    description: "Deep ocean dark theme with teal and cyan highlights.",
    swatch: ["#14b8a6", "#22d3ee", "#071a1f"],
  },
  {
    id: "cyber-blue",
    name: "Cyber Blue",
    mode: "dark",
    description: "Classic tech blue with cyan accents on navy.",
    swatch: ["#3b82f6", "#06b6d4", "#060d1f"],
  },
  {
    id: "crimson-noir",
    name: "Crimson Noir",
    mode: "dark",
    description: "Aggressive red-on-black gaming aesthetic with ember orange.",
    swatch: ["#ef4444", "#f97316", "#120809"],
  },
  {
    id: "gold-ember",
    name: "Gold Ember",
    mode: "dark",
    description: "Premium gold and amber on charcoal - premium vault feel.",
    swatch: ["#d4a843", "#f59e0b", "#12100a"],
  },
  {
    id: "forest-mint",
    name: "Forest Mint",
    mode: "dark",
    description: "Fresh emerald green with lime accents on deep forest.",
    swatch: ["#34d399", "#a3e635", "#08130c"],
  },
  {
    id: "arctic-light",
    name: "Arctic Light",
    mode: "light",
    description: "Clean bright theme - crisp blue on white.",
    swatch: ["#2563eb", "#0891b2", "#f2f6fb"],
  },
  {
    id: "sepia-paper",
    name: "Sepia Paper",
    mode: "light",
    description: "Warm vintage paper tones for easy reading.",
    swatch: ["#a16207", "#c2410c", "#f5efe3"],
  },
];

export const DEFAULT_SITE_THEME = "neon-violet";

const THEME_IDS = new Set(SITE_THEMES.map((t) => t.id));

export function isValidTheme(id: string | null | undefined): boolean {
  return !!id && THEME_IDS.has(id);
}

export function getStoredSiteTheme(): string {
  if (typeof window === "undefined") return DEFAULT_SITE_THEME;
  const stored = localStorage.getItem("siteTheme");
  return isValidTheme(stored) ? stored! : DEFAULT_SITE_THEME;
}

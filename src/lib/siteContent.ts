export const siteContentStorageKey = "siteContent";

export type SiteFont = "geist" | "mono" | "system";
export type SiteDensity = "compact" | "comfortable" | "airy";
export type SiteRadius = "sharp" | "soft" | "round";

export interface SiteContent {
  siteName: string;
  siteDescription: string;
  adminEmail: string;
  navigation: {
    games: string;
    software: string;
    ebooks: string;
    pcCheck: string;
    faq: string;
    contact: string;
    searchPlaceholder: string;
    pcCheckCta: string;
  };
  footer: {
    description: string;
    categoriesTitle: string;
    supportTitle: string;
    legalTitle: string;
    contactLabel: string;
    requestLabel: string;
    faqLabel: string;
    termsLabel: string;
    privacyLabel: string;
    dmcaLabel: string;
    onlineLabel: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    highlightedTitle: string;
    description: string;
    primaryLabel: string;
    secondaryLabel: string;
    featuredGameId: string;
  };
  contact: {
    whatsappNumber: string;
    whatsappMessage: string;
    whatsappLabel: string;
  };
  design: {
    heroImage: string;
    secondaryImageOne: string;
    secondaryImageTwo: string;
    font: SiteFont;
    density: SiteDensity;
    radius: SiteRadius;
    accentColor: string;
    surfaceColor: string;
    showHero: boolean;
    showFeatures: boolean;
    showLatest: boolean;
  };
}

export const defaultSiteContent: SiteContent = {
  siteName: "PixelVault",
  siteDescription: "Your ultimate gaming & software vault",
  adminEmail: "admin@pixelvault.com",
  navigation: {
    games: "Games",
    software: "Software",
    ebooks: "Ebooks",
    pcCheck: "PC check",
    faq: "FAQ",
    contact: "Contact",
    searchPlaceholder: "Search...",
    pcCheckCta: "Find my games",
  },
  footer: {
    description: "Your trusted gaming & software vault. Fast, safe, and updated daily.",
    categoriesTitle: "Categories",
    supportTitle: "Support",
    legalTitle: "Legal",
    contactLabel: "Contact Us",
    requestLabel: "Software Request",
    faqLabel: "FAQ",
    termsLabel: "Terms of Service",
    privacyLabel: "Privacy Policy",
    dmcaLabel: "DMCA",
    onlineLabel: "ONLINE",
  },
  hero: {
    eyebrow: "Featured in the vault",
    title: "Explore the",
    highlightedTitle: "Lands Between",
    description: "Discover Elden Ring and a growing library of games, software, and apps with clear requirements and trusted official links.",
    primaryLabel: "View Elden Ring",
    secondaryLabel: "Browse games",
    featuredGameId: "elden-ring",
  },
  contact: {
    whatsappNumber: "+233 53 336 9112",
    whatsappMessage: "Hello, I would like to request software or a game from PixelVault.",
    whatsappLabel: "WhatsApp support",
  },
  design: {
    heroImage: "/images/games/eldenring.jpg",
    secondaryImageOne: "/images/games/baldursgate3.jpg",
    secondaryImageTwo: "/images/games/palworld.jpg",
    font: "geist",
    density: "comfortable",
    radius: "soft",
    accentColor: "#7B45F0",
    surfaceColor: "#0d0918",
    showHero: true,
    showFeatures: true,
    showLatest: true,
  },
};

export function readSiteContent(): SiteContent {
  if (typeof window === "undefined") return defaultSiteContent;

  try {
    const stored = localStorage.getItem(siteContentStorageKey);
    if (!stored) return defaultSiteContent;
    const parsed = JSON.parse(stored) as Partial<SiteContent>;
    return {
      ...defaultSiteContent,
      ...parsed,
      siteName: (parsed.siteName === "404" || !parsed.siteName) ? "PixelVault" : parsed.siteName,
      navigation: { ...defaultSiteContent.navigation, ...(parsed.navigation || {}) },
      footer: { ...defaultSiteContent.footer, ...(parsed.footer || {}) },
      hero: { ...defaultSiteContent.hero, ...(parsed.hero || {}) },
      contact: { ...defaultSiteContent.contact, ...(parsed.contact || {}) },
      design: { ...defaultSiteContent.design, ...(parsed.design || {}) },
    };
  } catch {
    return defaultSiteContent;
  }
}

export function saveSiteContent(content: SiteContent): void {
  localStorage.setItem(siteContentStorageKey, JSON.stringify(content));
  window.dispatchEvent(new CustomEvent("site-content-changed"));
}

export function applySiteDesign(content: SiteContent): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--site-accent", content.design.accentColor);
  root.style.setProperty("--site-surface", content.design.surfaceColor);
  root.dataset.siteFont = content.design.font;
  root.dataset.siteDensity = content.design.density;
  root.dataset.siteRadius = content.design.radius;
}

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Space_Grotesk, JetBrains_Mono, Inter, Cinzel } from "next/font/google";
import "./globals.css";
import { ThemeAndToastProvider } from "@/components/ThemeAndToastProvider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "700"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600"],
});

/**
 * Admin display face.
 * Bavaria Gates / Gimolla / Circus Ace are commercial fonts, so they are
 * declared via @font-face in globals.css (local install or self-hosted files).
 * Cinzel is the bundled free lookalike that renders when they aren't present.
 */
const cinzel = Cinzel({
  subsets: ["latin"],
  variable: "--font-admin-fallback",
  weight: ["400", "600", "700", "900"],
});

export const metadata: Metadata = {
  title: "PixelVault // High-Velocity Digital Gaming & Software Archive",
  description:
    "Curated digital vault for PC games, repacks, pro Windows apps, 4K HDR cinema REMUXes, engineering ebooks, and AAA tutorials. 100% client-side IndexedDB architecture.",
  keywords: [
    "PixelVault",
    "PC Game Repacks",
    "FitGirl Repacks",
    "Windows Software Download",
    "4K HDR Remux",
    "Game Dev Ebooks",
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const themeInitializer = `
    try {
      var id = localStorage.getItem('pixelvault_theme') || 'cyber-vault';
      var light = id === 'vaporwave-day' || id === 'clean-studio';
      document.documentElement.setAttribute('data-site-theme', id);
      document.documentElement.setAttribute('data-site-mode', light ? 'light' : 'dark');
      document.documentElement.style.colorScheme = light ? 'light' : 'dark';
    } catch (_) {}
  `;

  return (
    <html
      lang="en"
      data-site-theme="cyber-vault"
      data-site-mode="dark"
      suppressHydrationWarning
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${inter.variable} ${cinzel.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body className="min-h-screen selection:bg-[var(--primary)] selection:text-[var(--primary-foreground)]">
        <ThemeAndToastProvider>{children}</ThemeAndToastProvider>
      </body>
    </html>
  );
}

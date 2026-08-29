import type { Metadata } from "next";
import { Geist, Geist_Mono, Russo_One, Chakra_Petch } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackToTop from "@/components/BackToTop";
import CookieBanner from "@/components/CookieBanner";
import ThemeProvider from "@/components/ThemeProvider";
import DataInit from "@/components/DataInit";
import { SITE_URL } from "@/lib/siteConfig";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const russoOne = Russo_One({
  variable: "--font-display",
  weight: "400",
  subsets: ["latin"],
});

const chakraPetch = Chakra_Petch({
  variable: "--font-chakra",
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "PixelVault - Gaming & Software Vault",
  description:
    "Download games, software for Windows, Mac, Android. PC games, ebooks, and more. Your trusted gaming vault.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "PixelVault - Gaming & Software Vault",
    description:
      "Download games, software for Windows, Mac, Android. PC games, ebooks, and more. Your trusted gaming vault.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col transition-colors duration-200">
        <ThemeProvider>
          <DataInit>
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
            <BackToTop />
            <CookieBanner />
          </DataInit>
        </ThemeProvider>
      </body>
    </html>
  );
}

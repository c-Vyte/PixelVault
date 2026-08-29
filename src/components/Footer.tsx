"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { categories } from "@/lib/data";
import BrandLogo from "@/components/BrandLogo";
import { defaultSiteContent, readSiteContent, type SiteContent } from "@/lib/siteContent";

export default function Footer() {
  const [content, setContent] = useState<SiteContent>(defaultSiteContent);

  useEffect(() => {
    const loadContent = () => setContent(readSiteContent());
    loadContent();
    window.addEventListener("site-content-changed", loadContent);
    return () => window.removeEventListener("site-content-changed", loadContent);
  }, []);

  return (
    <footer className="bg-black border-t border-gray-800/50 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <BrandLogo href="/" className="mb-4" />
            <p className="text-gray-500 text-sm leading-relaxed">
              {content.footer.description}
            </p>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-white font-bold mb-4 uppercase tracking-[0.15em] text-xs">{content.footer.categoriesTitle}</h3>
            <ul className="space-y-2">
              {categories.map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={`/category/${cat.id}`}
                    className="text-gray-500 hover:text-amber-500 text-sm transition-colors"
                  >
                    {cat.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-bold mb-4 uppercase tracking-[0.15em] text-xs">{content.footer.supportTitle}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/contact" className="text-gray-500 hover:text-red-500 text-sm transition-colors">
                  {content.footer.contactLabel}
                </Link>
              </li>
              <li>
                <Link href="/request" className="text-gray-500 hover:text-red-500 text-sm transition-colors">
                  {content.footer.requestLabel}
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-gray-500 hover:text-red-500 text-sm transition-colors">
                  {content.footer.faqLabel}
                </Link>
              </li>
              <li>
                <Link href="/speedtest" className="text-gray-500 hover:text-red-500 text-sm transition-colors">
                  Speed Test
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-bold mb-4 uppercase tracking-[0.15em] text-xs">{content.footer.legalTitle}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/terms" className="text-gray-500 hover:text-red-500 text-sm transition-colors">
                  {content.footer.termsLabel}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-500 hover:text-red-500 text-sm transition-colors">
                  {content.footer.privacyLabel}
                </Link>
              </li>
              <li>
                <Link href="/dmca" className="text-gray-500 hover:text-red-500 text-sm transition-colors">
                  {content.footer.dmcaLabel}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-800/50 mt-8 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-600 text-xs font-mono">
            © {new Date().getFullYear()} PixelVault. All Rights Reserved.
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-gray-600 text-xs font-mono">{content.footer.onlineLabel}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { softwareData } from "@/lib/data";
import { defaultSiteContent, readSiteContent, type SiteContent } from "@/lib/siteContent";

export default function HeroBanner() {
  const [content, setContent] = useState<SiteContent>(defaultSiteContent);

  useEffect(() => {
    const loadContent = () => setContent(readSiteContent());
    loadContent();
    window.addEventListener("site-content-changed", loadContent);
    return () => window.removeEventListener("site-content-changed", loadContent);
  }, []);

  const featuredGame = softwareData.find((game) => game.id === content.hero.featuredGameId) || softwareData.find((game) => game.id === "elden-ring");

  if (!content.design.showHero) return null;

  return (
    <section className="relative isolate overflow-hidden border-b border-[#A981FF]/20" style={{ backgroundColor: content.design.surfaceColor }}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_35%,rgba(123,69,240,0.34),transparent_34rem)]" />
      <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-gradient-to-l from-[#34117E]/70 via-[#491AB1]/20 to-transparent lg:block" />

      <div className="relative mx-auto grid min-h-[480px] max-w-7xl items-center gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-14">
        <div className="relative z-10 max-w-xl">
          <div className="mb-6 flex items-center gap-4">
            <div className="h-1 w-12 bg-[#7B45F0]" />
            <span className="text-xs font-black uppercase tracking-[0.3em] text-[#A981FF]">{content.hero.eyebrow}</span>
          </div>
          <h1 className="max-w-lg text-5xl font-black uppercase leading-[0.92] tracking-tight text-white sm:text-7xl">
            {content.hero.title} <span className="text-[#A981FF]">{content.hero.highlightedTitle}</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-300">
            {content.hero.description}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/software/${featuredGame?.id || "elden-ring"}`} className="cyber-btn rounded-lg px-6 py-3 text-sm font-bold uppercase tracking-[0.14em]">{content.hero.primaryLabel}</Link>
            <Link href="/category/pc-games" className="glass-light rounded-lg px-6 py-3 text-sm font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-white/10">{content.hero.secondaryLabel}</Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-5 text-xs font-bold uppercase tracking-wider text-[#B796EE]">
            <span>System requirements</span>
            <span>Official sources</span>
            <span>Updated library</span>
          </div>
        </div>

        <div className="relative mx-auto h-[520px] w-full max-w-2xl sm:h-[600px]">
          <div className="absolute inset-8 overflow-hidden rounded-[2rem] border border-[#A981FF]/30 shadow-[0_24px_80px_rgba(52,17,126,0.45)] sm:inset-12">
            <img src={content.design.heroImage || featuredGame?.icon || "/images/games/eldenring.jpg"} alt={featuredGame?.title || "Featured game"} fetchPriority="high" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d0918] via-transparent to-[#491AB1]/20" />
            <div className="absolute bottom-6 left-6">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-[#D0BCFC]">Action RPG</p>
              <p className="mt-2 text-2xl font-black uppercase text-white">{featuredGame?.title || "Elden Ring"}</p>
            </div>
          </div>
          <div className="absolute right-0 top-8 hidden w-64 rotate-6 overflow-hidden rounded-xl border border-[#A981FF]/30 bg-[#17102a] p-2 shadow-xl sm:block">
            <img src={content.design.secondaryImageOne} alt="Featured game" className="h-48 w-full rounded-lg object-cover" />
            <p className="px-1 py-2 text-xs font-bold text-white">Baldur&apos;s Gate 3</p>
          </div>
          <div className="absolute bottom-6 left-0 hidden w-64 -rotate-6 overflow-hidden rounded-xl border border-[#A981FF]/30 bg-[#17102a] p-2 shadow-xl sm:block">
            <img src={content.design.secondaryImageTwo} alt="Featured game" className="h-48 w-full rounded-lg object-cover" />
            <p className="px-1 py-2 text-xs font-bold text-white">Palworld</p>
          </div>
        </div>
      </div>
    </section>
  );
}

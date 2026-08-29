"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { categories, getPublishedSoftwareList, type Software } from "@/lib/data";
import SoftwareCard from "@/components/SoftwareCard";
import TrendingSection from "@/components/TrendingSection";
import RecentlyViewed from "@/components/RecentlyViewed";
import HeroBanner from "@/components/HeroBanner";
import { defaultSiteContent, readSiteContent, type SiteContent } from "@/lib/siteContent";

export default function Home() {
  const [softwareList, setSoftwareList] = useState<Software[]>([]);
  const [siteContent, setSiteContent] = useState<SiteContent>(defaultSiteContent);
  const [latestCategory, setLatestCategory] = useState<string | null>(null);
  const [latestPlatform, setLatestPlatform] = useState<string | null>(null);
  const [latestSort, setLatestSort] = useState<string>("newest");

  useEffect(() => {
    getPublishedSoftwareList().then((list) => {
      if (list.length > 0) {
        setSoftwareList(list);
      }
    });
  }, []);

  useEffect(() => {
    const loadContent = () => setSiteContent(readSiteContent());
    loadContent();
    window.addEventListener("site-content-changed", loadContent);
    return () => window.removeEventListener("site-content-changed", loadContent);
  }, []);

  const featuredSoftware = softwareList.slice(0, 4);

  const latestSoftware = useMemo(() => {
    let items = softwareList.slice(4);
    if (latestCategory) {
      items = items.filter((s) => s.category === latestCategory);
    }
    if (latestPlatform) {
      items = items.filter((s) => s.platform === latestPlatform || s.platform === "cross-platform");
    }
    switch (latestSort) {
      case "rating":
        items = [...items].sort((a, b) => b.rating - a.rating);
        break;
      case "downloads":
        items = [...items].sort((a, b) => b.downloads - a.downloads);
        break;
      case "name":
        items = [...items].sort((a, b) => a.title.localeCompare(b.title));
        break;
      default:
        items = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return items.slice(0, 12);
  }, [softwareList, latestCategory, latestPlatform, latestSort]);

  return (
    <div>
      <HeroBanner />

      {/* THE VAULT section - Battlefield "THE MUST HAVE GAME" style */}
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d0d] via-[#111] to-[#0d0d0d]" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left - Text */}
            <div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-1 bg-amber-500" />
                <span className="text-amber-500 font-black text-sm tracking-[0.3em] uppercase">
                  The Vault
                </span>
              </div>

              <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight mb-4 leading-tight">
                THE MUST HAVE <span className="text-amber-500">GAMES</span>
              </h2>
              <p className="text-amber-500/80 font-bold text-sm uppercase tracking-[0.2em] mb-6">
                Updated Daily • Verified Safe
              </p>

              <p className="text-gray-400 text-lg leading-relaxed mb-8 max-w-lg">
                Stay up to date with the latest games and software. Our library is constantly growing with verified downloads, detailed descriptions, and system requirements.
              </p>

              <div className="flex items-center gap-4">
                <Link
                  href="/category/pc-games"
                  className="cyber-btn px-8 py-4 rounded-lg font-bold text-sm uppercase tracking-[0.2em]"
                >
                  Browse Library
                </Link>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-sm">Follow us</span>
                    <div className="flex gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center hover:bg-amber-600/20 transition-colors cursor-pointer">
                      <span className="text-xs">DC</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right - Featured Cards */}
            <div className="relative">
              <div className="absolute -top-4 -right-4 w-full h-full bg-amber-600/5 rounded-2xl transform rotate-3" />
              <div className="relative space-y-4">
                {featuredSoftware.slice(0, 3).map((sw, i) => (
                  <Link
                    key={sw.id}
                    href={`/software/${sw.id}`}
                    className={`group relative flex h-64 rounded-2xl overflow-hidden bg-gray-900/50 border border-gray-800 hover:border-amber-500/30 transition-all ${i === 0 ? "ring-2 ring-amber-500/20" : ""}`}
                  >
                    <img
                      src={sw.poster || sw.icon}
                      alt={sw.title}
                      className="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#071014]/90 via-[#071014]/50 to-transparent" />
                    <div className="relative z-10 flex items-center justify-between p-6 w-full">
                      <div className="flex items-center gap-4">
                        <img
                          src={sw.icon}
                          alt={sw.title}
                          className="w-20 h-20 rounded-lg object-cover border border-amber-500/30 shadow-xl"
                        />
                        <div className="min-w-0">
                          <h3 className="text-white font-bold text-lg truncate group-hover:text-amber-500 transition-colors">
                            {sw.title}
                          </h3>
                          <p className="text-gray-400 text-sm mt-1">{sw.platform}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white text-lg font-bold">{sw.rating}</span>
                        <svg className="w-6 h-6 text-white/50 group-hover:text-amber-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories - Battlefield "CUSTOMIZE YOUR SOLDIERS" style */}
      {siteContent.design.showFeatures && <section className="relative py-10 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-[40%] h-full bg-gradient-to-r from-amber-900/10 to-transparent" />
          <div className="absolute bottom-0 right-0 w-[30%] h-full bg-gradient-to-l from-amber-900/5 to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 mb-12">
            <div className="w-16 h-1 bg-amber-500" />
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
              SELECT YOUR <span className="text-amber-500">CATEGORY</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {categories.map((cat, i) => (
              <Link
                key={cat.id}
                href={`/category/${cat.id}`}
                className="group relative"
              >
                <div className={`relative p-6 rounded-xl border transition-all ${
                  i === 0
                    ? "bg-amber-600/10 border-amber-500/30 hover:bg-amber-600/20"
                    : "bg-gray-900/50 border-gray-800 hover:border-amber-500/30"
                }`}>
                  <div className="mb-3 h-1 w-10 bg-amber-500/70" />
                  <h3 className="text-white font-bold text-sm uppercase tracking-wider">{cat.name}</h3>
                  <p className="text-gray-500 text-xs mt-1">{cat.description}</p>
                  {i === 0 && (
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-0.5 bg-amber-500 text-black text-xs font-bold rounded">POPULAR</span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <TrendingSection />
        <RecentlyViewed />
      </div>

      {/* Features - Battlefield "NEVER BE THE SAME" style */}
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d0d] via-[#111] to-[#0d0d0d]" />
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-16 h-1 bg-amber-500" />
              <span className="text-amber-500 font-black text-sm tracking-[0.3em] uppercase">
                Why Choose Us
              </span>
              <div className="w-16 h-1 bg-amber-500" />
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight">
              NEVER BE THE <span className="text-amber-500">SAME</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="glass-feature p-8 rounded-xl text-center group hover:bg-amber-600/5 transition-all">
              <div className="w-16 h-16 bg-amber-600/10 rounded-xl flex items-center justify-center mx-auto mb-6 group-hover:bg-amber-600/20 transition-colors">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">01</span>
              </div>
              <h3 className="text-white font-bold text-lg mb-3 uppercase tracking-wider">Safe Downloads</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Every file is scanned and verified before being listed. Your security is our priority.</p>
            </div>

            <div className="glass-feature p-8 rounded-xl text-center group hover:bg-amber-600/5 transition-all">
              <div className="w-16 h-16 bg-amber-600/10 rounded-xl flex items-center justify-center mx-auto mb-6 group-hover:bg-amber-600/20 transition-colors">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">02</span>
              </div>
              <h3 className="text-white font-bold text-lg mb-3 uppercase tracking-wider">Fast Speed</h3>
              <p className="text-gray-400 text-sm leading-relaxed">High-speed download servers ensure you get your files quickly and reliably.</p>
            </div>

            <div className="glass-feature p-8 rounded-xl text-center group hover:bg-amber-600/5 transition-all">
              <div className="w-16 h-16 bg-amber-600/10 rounded-xl flex items-center justify-center mx-auto mb-6 group-hover:bg-amber-600/20 transition-colors">
                <span className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">03</span>
              </div>
              <h3 className="text-white font-bold text-lg mb-3 uppercase tracking-wider">Multi-Platform</h3>
              <p className="text-gray-400 text-sm leading-relaxed">Windows, Mac, Android — we cover all major platforms with daily updates.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Software Grid */}
      {siteContent.design.showLatest && <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-1 bg-amber-500" />
            <h2 className="text-2xl font-black text-white uppercase tracking-tight">Latest Additions</h2>
          </div>
          <Link href="/category/windows" className="text-amber-500 hover:text-amber-400 text-sm font-bold uppercase tracking-[0.15em]">
            View All →
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select
            value={latestCategory || "all"}
            onChange={(e) => setLatestCategory(e.target.value === "all" ? null : e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 bg-gray-800 text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            value={latestPlatform || "all"}
            onChange={(e) => setLatestPlatform(e.target.value === "all" ? null : e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 bg-gray-800 text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All platforms</option>
            <option value="windows">Windows</option>
            <option value="mac">Mac</option>
            <option value="android">Android</option>
          </select>
          <select
            value={latestSort}
            onChange={(e) => setLatestSort(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 bg-gray-800 text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="newest">Newest First</option>
            <option value="rating">Top Rated</option>
            <option value="downloads">Most Downloaded</option>
            <option value="name">A → Z</option>
          </select>
          {(latestCategory || latestPlatform || latestSort !== "newest") && (
            <button
              onClick={() => { setLatestCategory(null); setLatestPlatform(null); setLatestSort("newest"); }}
              className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
            >
              Clear
            </button>
          )}
          <span className="ml-auto text-xs text-gray-500">{latestSoftware.length} items</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {latestSoftware.map((sw) => (
            <SoftwareCard key={sw.id} software={sw} />
          ))}
        </div>
      </section>}

      <section className="relative overflow-hidden border-y border-gray-800 bg-gray-900/60 py-10">
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-amber-900/10 to-transparent" />
        <div className="relative z-10 mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-4 sm:px-6 lg:flex-row lg:items-center lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-[0.3em] text-amber-500">New tool</p>
            <h2 className="mt-3 text-3xl font-black uppercase tracking-tight text-white md:text-4xl">Can your PC run it?</h2>
            <p className="mt-4 text-gray-400">Get game recommendations based on your RAM, graphics card, CPU threads, and the requirements in our library.</p>
          </div>
          <Link href="/pc-check" className="cyber-btn shrink-0 rounded-lg px-7 py-4 text-sm font-bold uppercase tracking-[0.18em]">Check my PC</Link>
        </div>
      </section>

      {/* CTA - Battlefield style */}
      <section className="relative py-12 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-[50%] h-full bg-gradient-to-r from-amber-900/15 to-transparent transform skew-x-[-12deg]" />
          <div className="absolute bottom-0 right-0 w-[40%] h-full bg-gradient-to-l from-amber-900/10 to-transparent transform skew-x-[-12deg]" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="w-16 h-1 bg-amber-500" />
              <span className="text-amber-500 font-black text-sm tracking-[0.3em] uppercase">
                Join The Vault
              </span>
              <div className="w-16 h-1 bg-amber-500" />
            </div>

            <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tight mb-6">
              HAVE SOFTWARE TO <span className="text-amber-500">SHARE?</span>
            </h2>

            <p className="text-gray-400 text-lg mb-10 max-w-lg mx-auto">
              Submit your software to be featured on PixelVault and reach millions of users worldwide.
            </p>

            <div className="flex items-center justify-center gap-4">
              <Link
                href="/admin/software/edit"
                className="cyber-btn px-10 py-5 rounded-lg font-bold text-sm uppercase tracking-[0.2em]"
              >
                Submit Software
              </Link>
              <Link
                href="/request"
                className="px-10 py-5 rounded-lg font-bold text-sm uppercase tracking-[0.2em] glass-light text-gray-300 hover:text-white hover:border-amber-500/50 transition-all border border-transparent"
              >
                Request Software
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

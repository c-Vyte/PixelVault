"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SoftwareCard } from "@/components/SoftwareCard";
import { getSoftwareList, Software } from "@/lib/data";
import {
  AcademicCapIcon,
  AppleMacIcon,
  BookOpenIcon,
  FilmIcon,
  GamepadIcon,
  SearchIcon,
  SmartphoneIcon,
  TvSeriesIcon,
  WindowsIcon,
} from "@/components/icons";

function CompactFeatureCard({ item, rotate }: { item: Software; rotate: string }) {
  return (
    <Link
      href={`/software/${item.id}`}
      className={`site-card absolute z-20 w-44 overflow-hidden rounded-xl border p-2 shadow-xl shadow-black/30 transition-transform hover:scale-105 sm:w-56 ${rotate}`}
    >
      <div className="site-card-elevated relative aspect-[1.55] overflow-hidden rounded-lg">
        <img src={item.icon} alt={item.title} className="h-full w-full object-cover opacity-85" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0718] via-transparent to-transparent" />
        <span className="media-overlay-text absolute left-2 top-2 rounded bg-black/35 px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase">
          featured game
        </span>
        <h3 className="media-overlay-text absolute bottom-2 left-2 right-2 line-clamp-1 text-[10px] font-black">
          {item.title}
        </h3>
      </div>
    </Link>
  );
}

function MustHaveRow({ item, index }: { item: Software; index: number }) {
  return (
    <Link
      href={`/software/${item.id}`}
      className="site-card group relative flex min-h-28 items-center gap-4 overflow-hidden rounded-xl border p-4 transition-all hover:-translate-y-0.5"
    >
      <img src={item.icon} alt={item.title} className="absolute inset-0 h-full w-full object-cover opacity-35 transition-opacity group-hover:opacity-45" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#06080d] via-[#06080d]/75 to-transparent" />
      <img src={item.poster || item.icon} alt={item.title} className="relative z-10 h-14 w-14 rounded object-cover ring-1 ring-white/15" />
      <div className="relative z-10 min-w-0 flex-1">
        <h3 className="media-overlay-text line-clamp-1 text-sm font-black">{item.title}</h3>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">{item.platform} / {item.size}</p>
      </div>
      <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-black/20 font-mono text-xs text-white">
        {index + 1}
      </span>
    </Link>
  );
}

export default function PixelVaultHomePage() {
  const [softwareList, setSoftwareList] = useState<Software[]>([]);
  const [heroSearchQuery, setHeroSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getSoftwareList().then((list) => {
      setSoftwareList(list.filter((item) => item.status === "published"));
      setIsLoading(false);
    });
    const handleDataChanged = () => {
      getSoftwareList().then((list) => setSoftwareList(list.filter((item) => item.status === "published")));
    };
    window.addEventListener("software-data-changed", handleDataChanged);
    return () => window.removeEventListener("software-data-changed", handleDataChanged);
  }, []);

  const heroItem = softwareList[1] || softwareList[0];
  const floatingOne = softwareList[2] || heroItem;
  const floatingTwo = softwareList[3] || heroItem;
  const mustHave = softwareList.slice(0, 3);
  const trending = softwareList.slice(0, 12);
  const categoryData = useMemo(
    () => [
      { href: "/windows", label: "Windows", sub: "Software for Windows operating system", badge: "Popular", icon: WindowsIcon, count: softwareList.filter((i) => i.category === "windows").length },
      { href: "/windows", label: "Mac", sub: "Software for macOS", icon: AppleMacIcon, count: softwareList.filter((i) => i.platform === "mac" || i.platform === "cross-platform").length },
      { href: "/windows", label: "Android Apps", sub: "Android applications", icon: SmartphoneIcon, count: softwareList.filter((i) => i.platform === "android").length },
      { href: "/pc-games", label: "PC Games", sub: "Games for PC", icon: GamepadIcon, count: softwareList.filter((i) => i.category === "pc-games").length },
      { href: "/ebooks", label: "Ebooks", sub: "Digital books and publications", icon: BookOpenIcon, count: softwareList.filter((i) => i.category === "ebooks").length },
      { href: "/movies", label: "Movies", sub: "Movies and films in HD quality", icon: FilmIcon, count: softwareList.filter((i) => i.category === "movies").length },
      { href: "/movies", label: "Korean Movies & Series", sub: "Korean movies and series", icon: TvSeriesIcon, count: softwareList.filter((i) => i.category === "movies").length },
      { href: "/tutorials", label: "Tutorials", sub: "Learning guides and tutorials", icon: AcademicCapIcon, count: softwareList.filter((i) => i.category === "tutorials").length },
    ],
    [softwareList]
  );

  return (
    <div className="site-shell min-h-screen">
      <Header />

      <main>
        <section className="site-section relative overflow-hidden border-b">
          <div className="relative mx-auto grid min-h-[650px] max-w-[1440px] grid-cols-1 items-center gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div className="max-w-2xl">
              <div className="mb-5 flex items-center gap-3">
                <span className="site-primary-bg h-px w-16" />
                <span className="site-primary-text font-mono text-[10px] font-black uppercase tracking-[0.24em]">Approach to the vault</span>
              </div>
              <h1 className="site-text font-display text-5xl font-black uppercase leading-[0.9] tracking-[-0.06em] sm:text-7xl lg:text-8xl">
                Explore the<br />
                <span className="site-primary-text">Lands</span><br />
                Between
              </h1>
              <p className="site-muted mt-6 max-w-xl text-sm font-medium leading-7 sm:text-base">
                Discover Elden Ring and a growing library of games, software, and apps with clear metadata, parts, and trusted official links.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/pc-games" className="site-primary-bg site-primary-border rounded-md border px-5 py-3 font-mono text-[10px] font-black uppercase tracking-[0.18em] transition-opacity hover:opacity-85">
                  View Elden Ring
                </Link>
                <Link href="/pc-games" className="site-theme-button site-card-elevated site-card-border site-text rounded-md border px-5 py-3 font-mono text-[10px] font-black uppercase tracking-[0.18em] transition-all">
                  Browse Games
                </Link>
              </div>
              <div className="site-primary-text mt-7 flex flex-wrap gap-6 font-mono text-[9px] font-black uppercase tracking-[0.18em]">
                <span>System requirements</span>
                <span>Official sources</span>
                <span>Updated library</span>
              </div>
            </div>

            <div className="relative mx-auto h-[420px] w-full max-w-[650px]">
              {heroItem && (
                <Link href={`/software/${heroItem.id}`} className="site-card absolute bottom-10 right-5 z-10 block w-[82%] overflow-hidden rounded-2xl border shadow-2xl transition-transform hover:scale-[1.01]">
                  <img src={heroItem.icon} alt={heroItem.title} className="h-[310px] w-full object-cover opacity-90" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                </Link>
              )}
              {floatingOne && <CompactFeatureCard item={floatingOne} rotate="right-0 top-6 rotate-6" />}
              {floatingTwo && <CompactFeatureCard item={floatingTwo} rotate="left-6 bottom-0 -rotate-6" />}
            </div>
          </div>
        </section>

        <section className="site-section-alt border-b">
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:px-8">
            <div className="flex flex-col justify-center">
              <div className="mb-5 flex items-center gap-3">
                <span className="site-primary-bg h-px w-16" />
                <span className="site-primary-text font-mono text-[10px] font-black uppercase tracking-[0.24em]">The Vault</span>
              </div>
              <h2 className="site-text font-display text-3xl font-black uppercase leading-none tracking-[-0.04em] sm:text-5xl">
                The must have games
              </h2>
              <p className="site-accent-text mt-4 max-w-lg font-mono text-[11px] font-bold uppercase tracking-[0.12em]">
                Updated daily · Verified apps
              </p>
              <p className="site-muted mt-4 max-w-xl text-sm leading-7">
                Stay up to date with the latest games and software. Our library is constantly growing with verified downloads, detailed descriptions, and system requirements.
              </p>
              <div className="mt-8 flex items-center gap-4">
                <Link href="/pc-games" className="site-primary-bg site-primary-border rounded-md border px-5 py-3 font-mono text-[10px] font-black uppercase tracking-[0.18em] hover:opacity-85">
                  Browse library
                </Link>
                <span className="site-muted font-mono text-[10px] uppercase tracking-[0.18em]">Follow us</span>
              </div>
            </div>
            <div className="space-y-5">
              {mustHave.map((item, index) => (
                <MustHaveRow key={item.id} item={item} index={index} />
              ))}
            </div>
          </div>
        </section>

        <section className="site-section">
          <div className="mx-auto max-w-[1440px] px-4 py-16 sm:px-6 lg:px-8">
            <div className="mb-8 flex items-center gap-3">
              <span className="site-primary-bg h-px w-16" />
              <h2 className="site-text font-display text-2xl font-black uppercase tracking-[-0.04em] sm:text-3xl">
                Select your <span className="site-primary-text">category</span>
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-5">
              {categoryData.map((cat, index) => {
                const Icon = cat.icon;
                const popular = Boolean(cat.badge);
                return (
                  <Link
                    key={`${cat.label}-${index}`}
                    href={cat.href}
                    className={`site-card group relative rounded-xl border p-4 transition-all hover:-translate-y-1 ${
                      popular ? "site-primary-border" : ""
                    }`}
                  >
                    {popular && <span className="site-primary-bg absolute right-3 top-3 rounded px-2 py-0.5 font-mono text-[8px] font-black uppercase">Popular</span>}
                    <Icon className="site-accent-text mb-3 h-5 w-5" />
                    <h3 className="site-text font-mono text-[11px] font-black uppercase tracking-[0.14em]">{cat.label}</h3>
                    <p className="site-muted mt-1 line-clamp-1 text-[11px]">{cat.sub}</p>
                    <p className="site-primary-text mt-2 font-mono text-[9px] uppercase tracking-[0.14em]">{cat.count} items</p>
                  </Link>
                );
              })}
            </div>

            <div className="mt-14 mb-6 flex items-center justify-between">
              <h2 className="site-text font-display text-2xl font-black">Trending Now</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (heroSearchQuery.trim()) window.location.href = `/pc-games?search=${encodeURIComponent(heroSearchQuery.trim())}`;
                }}
                className="site-card-elevated site-card-border hidden w-72 items-center gap-2 rounded-lg border px-3 py-2 md:flex"
              >
                <SearchIcon className="site-primary-text h-4 w-4" />
                <input value={heroSearchQuery} onChange={(e) => setHeroSearchQuery(e.target.value)} placeholder="Search library" className="site-text w-full bg-transparent font-mono text-[11px] placeholder:text-[var(--muted)] focus:outline-none" />
              </form>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="site-card h-80 animate-pulse rounded-xl border" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {trending.map((item) => <SoftwareCard key={item.id} item={item} />)}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

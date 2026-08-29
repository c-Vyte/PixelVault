"use client";

import { useEffect } from "react";
import { applySiteDesign, readSiteContent } from "@/lib/siteContent";
import { getSoftwareList, saveSoftwareList, type Software } from "@/lib/data";

const SOURCES = [
  "/data/fitgirl-index.json",
  "/data/xzy-index.json",
  "/data/elamigos-index.json",
];

function toSoftware(raw: any): Software | null {
  if (!raw?.title) return null;
  const now = new Date().toISOString().split("T")[0];
  return {
    id: raw.id || `seed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: raw.title,
    description: typeof raw.description === "string" ? raw.description.slice(0, 500) : "",
    category: raw.category || "pc-games",
    subcategory: raw.subcategory || "",
    platform: raw.platform || "windows",
    version: raw.version || "",
    size: raw.size || raw.repackSize || "",
    downloads: 0,
    rating: 4,
    icon: raw.icon || raw.poster || "",
    poster: raw.poster || raw.icon || "",
    screenshots: Array.isArray(raw.screenshots) ? raw.screenshots.slice(0, 10) : [],
    downloadLinks: Array.isArray(raw.downloadLinks) && raw.downloadLinks.length ? raw.downloadLinks : Array.isArray(raw.downloads) && raw.downloads.length ? raw.downloads : [{ name: "Download", url: "", type: "official" as const }],
    downloadsByHoster: raw.downloadsByHoster || undefined,
    features: Array.isArray(raw.features) ? raw.features.slice(0, 8) : [],
    systemRequirements: typeof raw.systemRequirements === "string" ? raw.systemRequirements.slice(0, 2000) : "",
    videoUrl: raw.videoUrl || undefined,
    password: raw.password || undefined,
    createdAt: raw.createdAt || now,
    updatedAt: now,
  };
}

async function autoSeed() {
  try {
    const existing = await getSoftwareList();
    const existingTitles = new Set(existing.map((s) => s.title.toLowerCase().trim()));

    let fetched: any[] = [];
    for (const url of SOURCES) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const data = await res.json();
        const items = Array.isArray(data) ? data : data.items || [];
        if (items.length) fetched.push(...items);
      } catch {}
    }
    if (fetched.length === 0) return;

    const versionKey = `seed-${fetched.length}`;
    if (localStorage.getItem("dataVersion") === versionKey) return;

    const toAdd: Software[] = [];
    for (const raw of fetched) {
      const sw = toSoftware(raw);
      if (!sw || !sw.title) continue;
      const hasLinks = sw.downloadLinks.some((l) => l.url && l.url.startsWith("http"));
      if (!hasLinks) continue;
      const key = sw.title.toLowerCase().trim();
      if (existingTitles.has(key) || toAdd.some((x) => x.title.toLowerCase().trim() === key)) continue;
      if (sw.title.length > 200) continue;
      toAdd.push(sw);
      existingTitles.add(key);
      if (toAdd.length >= 5000) break;
    }

    if (toAdd.length === 0) {
      localStorage.setItem("dataVersion", versionKey);
      return;
    }

    const ok = await saveSoftwareList([...existing, ...toAdd]);
    if (ok) {
      localStorage.setItem("dataVersion", versionKey);
      window.dispatchEvent(new Event("software-data-changed"));
    }
  } catch {}
}

export default function DataInit({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apply = () => applySiteDesign(readSiteContent());
    apply();
    window.addEventListener("site-content-changed", apply);
    autoSeed();
    return () => window.removeEventListener("site-content-changed", apply);
  }, []);

  return <>{children}</>;
}

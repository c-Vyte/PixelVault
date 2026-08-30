"use client";

import { useState } from "react";
import { getSoftwareList, saveSoftwareList, categories, type Software } from "@/lib/data";
import { useToast } from "@/components/admin/Toast";

interface AiMeta {
  found?: boolean;
  title?: string;
  description?: string;
  features?: string[];
  tags?: string[];
  category?: string;
  platform?: string;
  version?: string;
  size?: string;
}

interface ResultItem {
  title: string;
  meta: AiMeta | null;
  provider: string;
  error?: string;
}

const PLATFORMS = ["windows", "mac", "android", "ios", "cross-platform"];
const CATEGORY_IDS = categories.map((c) => c.id);

function makeId(title: string): string {
  return `ai-${Date.now()}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;
}

export default function AiFetchPage() {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedTitles, setSavedTitles] = useState<Set<string>>(new Set());

  const generate = async () => {
    const titles = input
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);

    if (titles.length === 0) {
      toast("Enter at least one title.", "error");
      return;
    }

    setLoading(true);
    setResults([]);
    try {
      const res = await fetch("/api/ai/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titles }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "AI fetch failed.", "error");
        return;
      }
      setResults(data.results || []);
      const okCount = (data.results || []).filter((r: ResultItem) => r.meta?.found !== false && r.meta).length;
      toast(`${okCount}/${titles.length} titles enriched.`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Request failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateMeta = (idx: number, patch: Partial<AiMeta>) => {
    setResults((prev) =>
      prev.map((r, i) => (i === idx && r.meta ? { ...r, meta: { ...r.meta, ...patch } } : r))
    );
  };

  const saveOne = async (item: ResultItem) => {
    if (!item.meta) return;
    setSavingId(item.title);
    try {
      const existing = await getSoftwareList();
      const finalTitle = item.meta.title?.trim() || item.title;
      if (existing.some((s) => s.title.toLowerCase().trim() === finalTitle.toLowerCase())) {
        toast(`"${finalTitle}" already exists in the library.`, "error");
        return;
      }
      const now = new Date().toISOString().split("T")[0];

      // Best-effort: grab a real banner from the internet for the AI entry.
      let banner = "";
      try {
        const r = await fetch("/api/ai/fetch-banner", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: finalTitle }),
        });
        if (r.ok) {
          const d = await r.json();
          if (d.banner) banner = d.banner;
        }
      } catch { /* keep placeholder */ }

      const placeholder = (w: number, h: number, bg: string) =>
        `https://placehold.co/${w}x${h}/${bg}/ffffff?text=${encodeURIComponent(finalTitle.slice(0, 20))}`;
      const entry: Software = {
        id: makeId(finalTitle),
        title: finalTitle,
        description: item.meta.description || "",
        category: item.meta.category && CATEGORY_IDS.includes(item.meta.category) ? item.meta.category : "pc-games",
        subcategory: "",
        platform: (PLATFORMS.includes(item.meta.platform || "") ? item.meta.platform : "windows") as Software["platform"],
        version: item.meta.version || "",
        size: item.meta.size || "",
        downloads: 0,
        rating: 4,
        icon: banner || placeholder(616, 352, "7c3aed"),
        poster: banner || placeholder(600, 900, "4c1d95"),
        screenshots: banner ? [banner] : [],
        downloadLinks: [{ name: "Download", url: "", type: "official" }],
        features: Array.isArray(item.meta.features) ? item.meta.features : [],
        systemRequirements: "",
        createdAt: now,
        updatedAt: now,
      };
      const saved = await saveSoftwareList([...existing, entry]);
      if (!saved) {
        toast(`Saved "${finalTitle}" locally but storage may be full - data may not persist.`, "error");
        return;
      }
      window.dispatchEvent(new Event("software-data-changed"));
      setSavedTitles((prev) => new Set(prev).add(item.title));
      toast(`Saved "${finalTitle}" to library.`, "success");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">AI Fetch</h1>
        <p className="text-blue-300/50 text-sm">
          Generate metadata for games &amp; software using free LLM providers (Groq → Gemini → Mistral → Z.ai fallback).
          Enter one title per line, up to 20.
        </p>
      </div>

      <div className="bg-[#111827] rounded-xl p-5 border border-blue-900/30 mb-6">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={5}
          placeholder={"Elden Ring\nBlender\nGTA V"}
          className="w-full bg-[#0b1120] border border-blue-900/40 rounded-lg p-3 text-sm text-white placeholder-blue-300/30 focus:outline-none focus:border-indigo-500 resize-y font-mono"
        />
        <div className="flex items-center justify-between mt-3">
          <span className="text-blue-300/40 text-xs">
            {input.split("\n").filter((t) => t.trim()).length}/20 titles
          </span>
          <button
            onClick={generate}
            disabled={loading}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors ${
              loading
                ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                : "bg-indigo-600 hover:bg-indigo-500 text-white"
            }`}
          >
            {loading ? "Generating..." : "Generate with AI"}
          </button>
        </div>
      </div>

      {loading && (
        <div className="bg-[#111827] rounded-xl p-8 border border-blue-900/30 mb-6 flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-blue-300/60 text-sm">Asking the AI about your titles...</p>
        </div>
      )}

      <div className="space-y-4">
        {results.map((item, idx) => (
          <div key={`${item.title}-${idx}`} className="bg-[#111827] rounded-xl p-5 border border-blue-900/30">
            {!item.meta ? (
              <div>
                <p className="text-white font-bold">{item.title}</p>
                <p className="text-red-400 text-sm mt-1">Failed: {item.error || "no response"}</p>
              </div>
            ) : item.meta.found === false ? (
              <div>
                <p className="text-white font-bold">{item.title}</p>
                <p className="text-yellow-400/80 text-sm mt-1">
                  AI could not identify a real game/software with this name.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    <input
                      value={item.meta.title || ""}
                      onChange={(e) => updateMeta(idx, { title: e.target.value })}
                      className="bg-transparent text-white font-bold text-lg w-full border-b border-transparent hover:border-blue-800 focus:border-indigo-500 focus:outline-none"
                    />
                    <p className="text-blue-300/40 text-xs mt-1">
                      via {item.provider}
                      {savedTitles.has(item.title) && <span className="text-emerald-400 ml-2">✓ saved</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => saveOne(item)}
                    disabled={savingId === item.title || savedTitles.has(item.title)}
                    className={`shrink-0 px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
                      savedTitles.has(item.title)
                        ? "bg-emerald-900/40 text-emerald-400 cursor-default"
                        : savingId === item.title
                        ? "bg-gray-700 text-gray-400"
                        : "bg-emerald-600 hover:bg-emerald-500 text-white"
                    }`}
                  >
                    {savedTitles.has(item.title) ? "Saved" : savingId === item.title ? "Saving..." : "Save to Library"}
                  </button>
                </div>

                <textarea
                  value={item.meta.description || ""}
                  onChange={(e) => updateMeta(idx, { description: e.target.value })}
                  rows={3}
                  placeholder="Description"
                  className="w-full bg-[#0b1120] border border-blue-900/40 rounded-lg p-3 text-sm text-blue-100/90 focus:outline-none focus:border-indigo-500 resize-y mb-3"
                />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <label className="block">
                    <span className="text-blue-300/50 text-xs block mb-1">Category</span>
                    <select
                      value={item.meta.category || "pc-games"}
                      onChange={(e) => updateMeta(idx, { category: e.target.value })}
                      className="w-full bg-[#0b1120] border border-blue-900/40 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      {CATEGORY_IDS.map((slug) => (
                        <option key={slug} value={slug}>{slug}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-blue-300/50 text-xs block mb-1">Platform</span>
                    <select
                      value={item.meta.platform || "windows"}
                      onChange={(e) => updateMeta(idx, { platform: e.target.value })}
                      className="w-full bg-[#0b1120] border border-blue-900/40 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-blue-300/50 text-xs block mb-1">Version</span>
                    <input
                      value={item.meta.version || ""}
                      onChange={(e) => updateMeta(idx, { version: e.target.value })}
                      className="w-full bg-[#0b1120] border border-blue-900/40 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-blue-300/50 text-xs block mb-1">Size</span>
                    <input
                      value={item.meta.size || ""}
                      onChange={(e) => updateMeta(idx, { size: e.target.value })}
                      className="w-full bg-[#0b1120] border border-blue-900/40 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </label>
                </div>

                {(item.meta.tags?.length || 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {item.meta.tags!.map((tag) => (
                      <span key={tag} className="px-2 py-0.5 rounded-full bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {(item.meta.features?.length || 0) > 0 && (
                  <ul className="list-disc list-inside text-blue-200/70 text-xs space-y-0.5 mt-2">
                    {item.meta.features!.slice(0, 6).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

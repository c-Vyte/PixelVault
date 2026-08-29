"use client";

import { useState, useEffect, useMemo } from "react";
import { type Software } from "@/lib/data";
import SoftwareCard from "@/components/SoftwareCard";
import { getRecommendations, findSimilarGames, type Recommendation } from "@/lib/recommendations/gameMatcher";

interface RecommendedSoftwareProps {
  currentId: string;
  category: string;
  subcategory: string;
}

export default function RecommendedSoftware({
  currentId,
  category,
  subcategory,
}: RecommendedSoftwareProps) {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"relevance" | "rating" | "downloads">("relevance");

  useEffect(() => {
    const stored = localStorage.getItem("softwareData");
    let list: Software[] = [];
    if (stored) {
      try { list = JSON.parse(stored); } catch {}
    }
    if (list.length === 0) {
      import("@/lib/data").then((mod) => { list = mod.softwareData; init(list); });
    } else {
      init(list);
    }

    function init(all: Software[]) {
      const current = all.find((s) => s.id === currentId);
      if (!current) return;

      if (current.category === "pc-games") {
        setRecommendations(findSimilarGames(current, all, 6));
      } else {
        setRecommendations(getRecommendations(current, all, 6));
      }
    }
  }, [currentId, category, subcategory]);

  const visible = useMemo(() => {
    let items = recommendations;
    if (platformFilter) {
      items = items.filter((r) => r.software.platform === platformFilter || r.software.platform === "cross-platform");
    }
    const sorted = [...items];
    switch (sortBy) {
      case "rating":
        sorted.sort((a, b) => b.software.rating - a.software.rating);
        break;
      case "downloads":
        sorted.sort((a, b) => b.software.downloads - a.software.downloads);
        break;
      default:
        break;
    }
    return sorted;
  }, [recommendations, platformFilter, sortBy]);

  if (recommendations.length === 0) return null;

  const hasPlatforms = recommendations.some((r) => r.software.platform === "windows" || r.software.platform === "mac" || r.software.platform === "android");

  return (
    <section className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">You May Also Like</h2>
        {hasPlatforms && (
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1 text-xs rounded-lg border transition-colors ${showFilters ? "bg-amber-500 text-black border-amber-500" : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"}`}
          >
            {showFilters ? "Hide Filters" : "Filters"}
          </button>
        )}
      </div>

      {showFilters && hasPlatforms && (
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-gray-800/50 rounded-xl border border-gray-700">
          <span className="text-xs text-gray-400">Platform:</span>
          <button
            onClick={() => setPlatformFilter(null)}
            className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-lg border transition-colors ${!platformFilter ? "bg-amber-500 text-black border-amber-500" : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"}`}
          >
            All
          </button>
          {["windows", "mac", "android"].map((p) => (
            <button
              key={p}
              onClick={() => setPlatformFilter(platformFilter === p ? null : p)}
              className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-lg border transition-colors ${platformFilter === p ? "bg-amber-500 text-black border-amber-500" : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"}`}
            >
              {p}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-gray-700" />
          <span className="text-xs text-gray-400">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "relevance" | "rating" | "downloads")}
            className="bg-gray-800 text-white text-xs rounded-lg px-2.5 py-1.5 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="relevance">Relevance</option>
            <option value="rating">Top Rated</option>
            <option value="downloads">Most Downloaded</option>
          </select>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-gray-500 text-sm py-4">No recommendations match the selected filters.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visible.map((rec) => (
            <div key={rec.software.id} className="relative">
              <SoftwareCard software={rec.software} />
              {rec.reason && rec.reason !== "Recommended" && (
                <div className="absolute top-3 left-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {rec.reason}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

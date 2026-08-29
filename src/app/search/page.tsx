"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { type Software, categories } from "@/lib/data";
import SoftwareCard from "@/components/SoftwareCard";
import { intelligentSearch, getSearchSuggestions, type SearchResult } from "@/lib/search/searchEngine";
import { parseInput, getSuggestions, getResponsePreview, findMatchingSoftware, type ParseResult } from "@/lib/parser/parser";

function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const q = searchParams.get("q") || "";
  const [allSoftware, setAllSoftware] = useState<Software[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(searchParams.get("platform"));
  const [selectedCategory, setSelectedCategory] = useState<string | null>(searchParams.get("cat"));
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(searchParams.get("sub"));
  const [minRating, setMinRating] = useState<number | null>(searchParams.get("rating") ? Number(searchParams.get("rating")) : null);
  const [maxSize, setMaxSize] = useState<number | null>(searchParams.get("size") ? Number(searchParams.get("size")) : null);
  const [sortBy, setSortBy] = useState<string>(searchParams.get("sort") || "relevance");
  const [query, setQuery] = useState(q);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [smartSuggestions, setSmartSuggestions] = useState<string[]>([]);

  const platforms = ["Windows", "Mac", "Android"];
  const ratingOptions = [
    { label: "Any rating", value: null },
    { label: "4.0+", value: 4.0 },
    { label: "4.5+", value: 4.5 },
  ];
  const sizeOptions = [
    { label: "Any size", value: null },
    { label: "Under 1 GB", value: 1 },
    { label: "Under 10 GB", value: 10 },
    { label: "Under 30 GB", value: 30 },
  ];
  const sortOptions = [
    { value: "relevance", label: "Relevance" },
    { value: "rating", label: "Top Rated" },
    { value: "downloads", label: "Most Downloaded" },
    { value: "newest", label: "Newest First" },
  ];

  const selectedCategoryObj = categories.find((c) => c.id === selectedCategory);

  useEffect(() => {
    import("@/lib/data").then((mod) => {
      mod.getPublishedSoftwareList().then((list) => {
        if (list.length > 0) {
          setAllSoftware(list);
        } else {
          setAllSoftware(mod.softwareData);
        }
      });
    });
  }, []);

  useEffect(() => {
    setQuery(q);
    if (q.trim() && allSoftware.length > 0) {
      const result = parseInput(q);
      setParseResult(result);
      setSmartSuggestions(getSuggestions(result));
    }
  }, [q, allSoftware]);

  const handleSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    const params = new URLSearchParams({ q: searchQuery.trim() });
    if (selectedPlatform) params.set("platform", selectedPlatform);
    if (selectedCategory) params.set("cat", selectedCategory);
    if (selectedSubcategory) params.set("sub", selectedSubcategory);
    if (minRating !== null) params.set("rating", String(minRating));
    if (maxSize !== null) params.set("size", String(maxSize));
    if (sortBy !== "relevance") params.set("sort", sortBy);
    router.push(`/search?${params.toString()}`);
    setShowSuggestions(false);
  }, [router, selectedPlatform, selectedCategory, selectedSubcategory, minRating, maxSize, sortBy]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (value.length >= 2 && allSoftware.length > 0) {
      const sugs = getSearchSuggestions(value, allSoftware);
      setSuggestions(sugs);
      setShowSuggestions(sugs.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [allSoftware]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch(query);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }, [query, handleSearch]);

  const results = useMemo(() => {
    if (!q.trim() || allSoftware.length === 0) return [];
    return intelligentSearch(q, allSoftware, {
      platform: selectedPlatform || undefined,
      category: selectedCategory || undefined,
      subcategory: selectedSubcategory || undefined,
      minRating: minRating || undefined,
      maxSizeGB: maxSize || undefined,
    });
  }, [q, allSoftware, selectedPlatform, selectedCategory, selectedSubcategory, minRating, maxSize]);

  const sortedResults = useMemo(() => {
    const list = [...results];
    switch (sortBy) {
      case "rating":
        list.sort((a, b) => b.software.rating - a.software.rating);
        break;
      case "downloads":
        list.sort((a, b) => b.software.downloads - a.software.downloads);
        break;
      case "newest":
        list.sort((a, b) => new Date(b.software.createdAt).getTime() - new Date(a.software.createdAt).getTime());
        break;
      default:
        break;
    }
    return list;
  }, [results, sortBy]);

  const displayed = useMemo(() => sortedResults.map((r) => r.software), [sortedResults]);

  useEffect(() => {
    if (!q.trim()) return;
    const params = new URLSearchParams({ q: q.trim() });
    if (selectedPlatform) params.set("platform", selectedPlatform);
    if (selectedCategory) params.set("cat", selectedCategory);
    if (selectedSubcategory) params.set("sub", selectedSubcategory);
    if (minRating !== null) params.set("rating", String(minRating));
    if (maxSize !== null) params.set("size", String(maxSize));
    if (sortBy !== "relevance") params.set("sort", sortBy);
    const url = `/search?${params.toString()}`;
    if (window.location.pathname + window.location.search !== url.replace(/\?$/, "")) {
      router.replace(url, { scroll: false });
    }
  }, [q, selectedPlatform, selectedCategory, selectedSubcategory, minRating, maxSize, sortBy, router]);

  const matchTypeLabel = (type: SearchResult["matchType"]) => {
    switch (type) {
      case "exact_title": return { label: "Exact match", color: "text-green-400 bg-green-500/10" };
      case "exact_alias": return { label: "Title match", color: "text-green-400 bg-green-500/10" };
      case "prefix_match": return { label: "Starts with", color: "text-blue-400 bg-blue-500/10" };
      case "token_match": return { label: "Keyword", color: "text-amber-400 bg-amber-500/10" };
      case "fuzzy_match": return { label: "Similar", color: "text-orange-400 bg-orange-500/10" };
      case "category_match": return { label: "Category", color: "text-purple-400 bg-purple-500/10" };
      case "description_match": return { label: "In description", color: "text-gray-400 bg-gray-500/10" };
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <a href="/" className="hover:text-amber-400 transition-colors">Home</a>
          <span>/</span>
          <span className="text-white">Search</span>
        </nav>

        <div className="relative mb-6">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder="Search games, software, or ask a question..."
                className="w-full bg-gray-800 text-white rounded-xl pl-12 pr-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500 border border-gray-700"
              />
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden z-50 shadow-xl">
                  {suggestions.map((sug, i) => (
                    <button
                      key={i}
                      onMouseDown={() => handleSearch(sug)}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 hover:text-white flex items-center gap-3 transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => handleSearch(query)}
              className="bg-amber-500 hover:bg-amber-400 text-black px-6 py-3 rounded-xl font-bold transition-colors"
            >
              Search
            </button>
          </div>
        </div>

        {q && parseResult && (
          <div className="mb-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-2 h-2 rounded-full ${parseResult.confidence.level === "high" ? "bg-green-500" : parseResult.confidence.level === "medium" ? "bg-amber-500" : "bg-red-500"}`} />
              <span className="text-sm text-gray-400">{getResponsePreview(parseResult)}</span>
              <span className="text-xs text-gray-500 ml-auto">{Math.round(parseResult.confidence.score * 100)}% confident</span>
            </div>
            {parseResult.resolvedAlias && (
              <p className="text-sm text-amber-400">
                Matched: {parseResult.resolvedAlias.canonical}
              </p>
            )}
          </div>
        )}

        {q && smartSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {smartSuggestions.map((sug, i) => (
              <button
                key={i}
                onClick={() => handleSearch(sug)}
                className="px-3 py-1 text-xs rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
              >
                {sug}
              </button>
            ))}
          </div>
        )}

        {q && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setSelectedPlatform(null)}
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg border transition-colors ${!selectedPlatform ? "bg-amber-500 text-black border-amber-500" : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"}`}
            >
              All Platforms
            </button>
            {platforms.map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPlatform(selectedPlatform === p ? null : p)}
                className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg border transition-colors ${selectedPlatform === p ? "bg-amber-500 text-black border-amber-500" : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {q && (
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <select
              value={selectedCategory || "all"}
              onChange={(e) => { setSelectedCategory(e.target.value === "all" ? null : e.target.value); setSelectedSubcategory(null); }}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 bg-gray-800 text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={selectedSubcategory || "all"}
              onChange={(e) => setSelectedSubcategory(e.target.value === "all" ? null : e.target.value)}
              disabled={!selectedCategoryObj}
              className={`px-3 py-1.5 text-xs rounded-lg border border-gray-700 bg-gray-800 text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500 ${!selectedCategoryObj ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <option value="all">All subcategories</option>
              {(selectedCategoryObj?.subcategories || []).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={minRating === null ? "" : String(minRating)}
              onChange={(e) => setMinRating(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 bg-gray-800 text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Any rating</option>
              {ratingOptions.filter((r) => r.value !== null).map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <select
              value={maxSize === null ? "" : String(maxSize)}
              onChange={(e) => setMaxSize(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 bg-gray-800 text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Any size</option>
              {sizeOptions.filter((s) => s.value !== null).map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 bg-gray-800 text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              {sortOptions.map((s) => (
                <option key={s.value} value={s.value}>Sort: {s.label}</option>
              ))}
            </select>
            {(selectedCategory || selectedSubcategory || minRating !== null || maxSize !== null || sortBy !== "relevance") && (
              <button
                onClick={() => { setSelectedCategory(null); setSelectedSubcategory(null); setMinRating(null); setMaxSize(null); setSortBy("relevance"); }}
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        <h1 className="text-3xl font-bold text-white mb-2">
          {q ? `Results for "${q}"` : "Search"}
        </h1>
        <p className="text-gray-400">
          {q ? `Found ${displayed.length} result${displayed.length !== 1 ? "s" : ""}` : "Search games, software, or ask a question"}
        </p>
      </div>

      {q && displayed.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayed.map((sw, i) => {
            const matchInfo = sortedResults[i];
            const matchLabel = matchInfo ? matchTypeLabel(matchInfo.matchType) : null;
            return (
              <div key={sw.id} className="relative">
                <SoftwareCard software={sw} />
                {matchLabel && (
                  <div className={`absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${matchLabel.color}`}>
                    {matchLabel.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : q ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-lg mb-2">No results found for &quot;{q}&quot;</p>
          <p className="text-gray-600 text-sm mb-4">Try different keywords or ask a question</p>
          {smartSuggestions.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {smartSuggestions.map((sug, i) => (
                <button
                  key={i}
                  onClick={() => handleSearch(sug)}
                  className="px-3 py-1 text-xs rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-gray-500 text-lg mb-2">Search games, software, or ask a question</p>
          <p className="text-gray-600 text-sm mb-6">Try &quot;Can my PC run Cyberpunk?&quot; or &quot;Find RPG games&quot;</p>
          <div className="flex flex-wrap justify-center gap-2">
            {["Can my PC run GTA V?", "Find lightweight games", "Games like Elden Ring", "Show trending"].map((sug, i) => (
              <button
                key={i}
                onClick={() => handleSearch(sug)}
                className="px-3 py-1 text-xs rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-16 text-center text-gray-500">Loading...</div>}>
      <SearchResults />
    </Suspense>
  );
}

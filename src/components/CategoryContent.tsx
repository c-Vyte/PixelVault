"use client";

import { useState, useMemo, useEffect } from "react";
import { categories, parseSizeGB, type Software, getPublishedSoftwareList } from "@/lib/data";
import SoftwareCard from "@/components/SoftwareCard";
import Pagination from "@/components/Pagination";
import SortDropdown, { SortOption } from "@/components/SortDropdown";
import { useSearchParams } from "next/navigation";

const ITEMS_PER_PAGE = 24;

function sortSoftware(items: Software[], sort: SortOption): Software[] {
  const sorted = [...items];
  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "downloads":
      return sorted.sort((a, b) => b.downloads - a.downloads);
    case "rating":
      return sorted.sort((a, b) => b.rating - a.rating);
    case "name":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return sorted;
  }
}

export default function CategoryContent({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const initialPage = Number(searchParams.get("page")) || 1;
  const isPcGames = slug === "pc-games";
  const ITEMS_PER_PAGE_PC = 20;
  const itemsPerPage = isPcGames ? ITEMS_PER_PAGE_PC : ITEMS_PER_PAGE;
  const initialSort = (searchParams.get("sort") as SortOption) || "newest";

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [sortBy, setSortBy] = useState<SortOption>(initialSort);
  const [allSoftware, setAllSoftware] = useState<Software[]>([]);
  const [selectedSub, setSelectedSub] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [minRating, setMinRating] = useState<number | null>(null);
  const [maxSize, setMaxSize] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const platforms = [
    { label: "Windows", value: "windows" },
    { label: "Mac", value: "mac" },
    { label: "Android", value: "android" },
  ];

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

  const loadData = async () => {
    try {
      const all = await getPublishedSoftwareList();
      setAllSoftware(all.filter((s) => s.category === slug));
    } catch {
      setAllSoftware([]);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    setSelectedSub(null);
    setSelectedPlatform(null);
    setMinRating(null);
    setMaxSize(null);
    setLoading(true);
    loadData().finally(() => setLoading(false));
    const handler = () => {
      setLoading(true);
      loadData().finally(() => setLoading(false));
    };
    window.addEventListener("software-data-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("software-data-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, [slug]);

  const category = categories.find((c) => c.id === slug);

  const filtered = useMemo(() => {
    let items = allSoftware;
    if (selectedSub) {
      items = items.filter((s) => s.subcategory === selectedSub);
    }
    if (selectedPlatform) {
      items = items.filter((s) => s.platform === selectedPlatform);
    }
    if (minRating) {
      items = items.filter((s) => s.rating >= minRating);
    }
    if (maxSize) {
      items = items.filter((s) => {
        const sizeGB = parseSizeGB(s.size);
        return sizeGB === null || sizeGB <= maxSize;
      });
    }
    return items;
  }, [allSoftware, selectedSub, selectedPlatform, minRating, maxSize]);

  const isAppCompact = slug === "apps" || slug === "android-apps";

  const gridClass = isPcGames
    ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
    : isAppCompact
      ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3"
      : "grid grid-cols-1 md:grid-cols-2 gap-4";

  const sorted = useMemo(() => sortSoftware(filtered, sortBy), [filtered, sortBy]);
  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const paginated = sorted.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSortChange = (sort: SortOption) => {
    setSortBy(sort);
    setCurrentPage(1);
  };

  if (!category) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 text-lg">Category not found.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <div className="inline-flex items-center gap-2 text-blue-400">
            <svg
              className="animate-spin h-6 w-6 text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-blue-400 text-lg">Loading games...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <a href="/" className="hover:text-white transition-colors">Home</a>
          <span>/</span>
          <span className="text-white">{category.name}</span>
        </nav>

        <h1 className="text-3xl font-bold text-white mb-2">{category.name}</h1>
        <p className="text-gray-400">{category.description}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => { setSelectedSub(null); setCurrentPage(1); }}
          className={`px-3 py-1 text-sm rounded-lg border transition-colors ${!selectedSub ? "bg-amber-600 text-white border-amber-600" : "bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-500"}`}
        >
          All
        </button>
        {category.subcategories.map((sub) => (
          <button
            key={sub}
            onClick={() => { setSelectedSub(selectedSub === sub ? null : sub); setCurrentPage(1); }}
            className={`px-3 py-1 text-sm rounded-lg border transition-colors ${selectedSub === sub ? "bg-amber-600 text-white border-amber-600" : "bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-500"}`}
          >
            {sub}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          onClick={() => { setSelectedPlatform(null); setCurrentPage(1); }}
          className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg border transition-colors ${!selectedPlatform ? "bg-blue-600 text-white border-blue-600" : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"}`}
        >
          All Platforms
        </button>
        {platforms.map((platform) => (
          <button
            key={platform.value}
            onClick={() => { setSelectedPlatform(selectedPlatform === platform.value ? null : platform.value); setCurrentPage(1); }}
            className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg border transition-colors ${selectedPlatform === platform.value ? "bg-blue-600 text-white border-blue-600" : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500"}`}
          >
            {platform.label}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-gray-700" />
        <select
          value={minRating === null ? "" : String(minRating)}
          onChange={(e) => { setMinRating(e.target.value ? Number(e.target.value) : null); setCurrentPage(1); }}
          className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 bg-gray-800 text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">Any rating</option>
          {ratingOptions.filter((r) => r.value !== null).map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <select
          value={maxSize === null ? "" : String(maxSize)}
          onChange={(e) => { setMaxSize(e.target.value ? Number(e.target.value) : null); setCurrentPage(1); }}
          className="px-3 py-1.5 text-xs rounded-lg border border-gray-700 bg-gray-800 text-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">Any size</option>
          {sizeOptions.filter((s) => s.value !== null).map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {(minRating !== null || maxSize !== null) && (
          <button
            onClick={() => { setMinRating(null); setMaxSize(null); setCurrentPage(1); }}
            className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mb-6">
        <p className="text-gray-400 text-sm">
          {sorted.length} {sorted.length === 1 ? "item" : "items"} found
        </p>
        <SortDropdown value={sortBy} onChange={handleSortChange} />
      </div>

      {paginated.length > 0 ? (
        <>
          <div className={gridClass}>
            {paginated.map((sw) => (
              <SoftwareCard key={sw.id} software={sw} compact={isAppCompact || isPcGames} />
            ))}
          </div>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </>
      ) : (
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">No software found in this category.</p>
        </div>
      )}
    </div>
  );
}
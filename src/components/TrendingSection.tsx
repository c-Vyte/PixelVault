"use client";

import { useState, useEffect } from "react";
import { getPublishedSoftwareList, type Software } from "@/lib/data";
import SoftwareCard from "@/components/SoftwareCard";

export default function TrendingSection() {
  const [trending, setTrending] = useState<Software[]>([]);

  useEffect(() => {
    getPublishedSoftwareList().then((list) => {
      const sorted = [...list].sort((a, b) => b.downloads - a.downloads).slice(0, 6);
      setTrending(sorted);
    });
  }, []);

  if (trending.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">🔥 Trending Now</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {trending.map((sw) => (
          <SoftwareCard key={sw.id} software={sw} />
        ))}
      </div>
    </section>
  );
}

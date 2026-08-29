"use client";

import { useEffect, useState } from "react";
import { getPublishedSoftwareList, type Software } from "@/lib/data";
import SoftwareCard from "@/components/SoftwareCard";

export default function RecentlyViewed() {
  const [recentSoftware, setRecentSoftware] = useState<Software[]>([]);

  useEffect(() => {
    const storedRecent = localStorage.getItem("recentlyViewed");
    if (!storedRecent) return;

    try {
      const parsedIds: unknown = JSON.parse(storedRecent);
      if (!Array.isArray(parsedIds)) return;
      const recentIds = parsedIds.filter((id): id is string => typeof id === "string");
      if (recentIds.length === 0) return;

      getPublishedSoftwareList().then((allSoftware) => {
        const found = recentIds
          .map((id) => allSoftware.find((s) => s.id === id))
          .filter(Boolean)
          .slice(0, 4) as Software[];
        setRecentSoftware(found);
      });
    } catch {}
  }, []);

  if (recentSoftware.length === 0) return null;

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Recently Viewed</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recentSoftware.map((sw) => (
          <SoftwareCard key={sw.id} software={sw} />
        ))}
      </div>
    </section>
  );
}

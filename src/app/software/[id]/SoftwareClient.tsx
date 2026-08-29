"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { categories, getPublishedSoftwareList, type Software } from "@/lib/data";
import SoftwareContent from "@/components/SoftwareContent";
import Link from "next/link";

export default function SoftwareClient() {
  const params = useParams();
  const id = params.id as string;
  const [software, setSoftware] = useState<Software | null>(null);

  useEffect(() => {
    getPublishedSoftwareList().then((list) => {
      const found = list.find((s) => s.id === id);
      if (found) {
        setSoftware({
          ...found,
          description: typeof found.description === "string" ? found.description.replace(/\[object Object\],?/g, "").trim() : "",
          features: Array.isArray(found.features) ? found.features.filter((f: any) => typeof f === "string" && !f.includes("[object Object]")) : [],
        });
      }
    });
  }, [id]);

  if (!software) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <p className="text-gray-500 text-lg">Software not found</p>
          <Link href="/" className="text-amber-500 hover:underline mt-4 inline-block">Go Home</Link>
        </div>
      </div>
    );
  }

  const category = categories.find((c) => c.id === software.category);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <a href="/" className="hover:text-white transition-colors">Home</a>
        <span>/</span>
        <a href={`/category/${software.category}`} className="hover:text-white transition-colors">
          {category?.name}
        </a>
        <span>/</span>
        <span className="text-white">{software.title}</span>
      </nav>

      <SoftwareContent software={software} />
    </div>
  );
}

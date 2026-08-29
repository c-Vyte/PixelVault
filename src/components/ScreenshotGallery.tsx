"use client";

import { useState } from "react";

interface ScreenshotGalleryProps {
  screenshots: string[];
  title: string;
}

export default function ScreenshotGallery({
  screenshots,
  title,
}: ScreenshotGalleryProps) {
  const [selected, setSelected] = useState(0);

  if (screenshots.length === 0) {
    return (
      <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 mb-6">
        <h2 className="text-xl font-bold text-white mb-4">Screenshots</h2>
        <div className="bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl h-64 flex items-center justify-center">
          <div className="text-center">
            <span className="text-4xl mb-2 block">📸</span>
            <p className="text-gray-400 text-sm">Screenshots coming soon</p>
          </div>
        </div>
      </div>
    );
  }

  const isGif = (url: string) => /\.gif(\?|$)/i.test(url);

  return (
    <div className="bg-[#150a2e] rounded-2xl border border-purple-900/30 p-6 mb-6">
      <h2 className="text-sm font-black tracking-widest text-white mb-3 uppercase">Screenshots (Click to enlarge)</h2>
      <div className="grid grid-cols-3 gap-1 mb-3">
        {screenshots.slice(0, 6).map((src, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={`relative h-24 sm:h-32 overflow-hidden bg-black group ${selected === i ? "ring-2 ring-amber-500" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`${title} thumbnail ${i + 1}`} className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
            {isGif(src) && <span className="absolute top-1 right-1 bg-black/70 text-white text-[8px] font-bold px-1 py-0.5 rounded">GIF</span>}
          </button>
        ))}
      </div>
      <div className="relative bg-black p-1">
        {/* corner brackets */}
        <span className="pointer-events-none absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-sky-300/70" />
        <span className="pointer-events-none absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-sky-300/70" />
        <span className="pointer-events-none absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-sky-300/70" />
        <span className="pointer-events-none absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-sky-300/70" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={screenshots[selected]} alt={`${title} screenshot ${selected + 1}`} className="w-full h-auto max-h-[420px] object-contain bg-black" />
      </div>
    </div>
  );
}

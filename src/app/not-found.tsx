"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center">
        <div className="relative mb-8">
          <h1 className="text-[10rem] font-black text-white leading-none font-mono select-none">
            4<span className="text-amber-500">0</span>4
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-gray-900/80 backdrop-blur-sm rounded-xl border border-gray-700 px-6 py-3">
              <span className="text-amber-500 font-mono text-sm tracking-wider">PAGE NOT FOUND</span>
            </div>
          </div>
        </div>

        <p className="text-gray-400 text-lg mb-8 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/"
            className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-colors"
          >
            Back to Home
          </Link>
          <button
            onClick={() => window.history.back()}
            className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-colors border border-gray-700"
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}

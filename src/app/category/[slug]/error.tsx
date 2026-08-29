"use client";

import { useEffect } from "react";

export default function CategoryError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    if (!error.message.toLowerCase().includes("failed to load chunk")) return;
    const retryKey = "chunk-recovery-attempted";
    if (sessionStorage.getItem(retryKey) === "true") return;
    sessionStorage.setItem(retryKey, "true");
    window.location.reload();
  }, [error.message]);

  const retry = () => {
    sessionStorage.removeItem("chunk-recovery-attempted");
    window.location.reload();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center">
        <div className="mx-auto mb-6 h-12 w-12 rounded-full border-2 border-amber-500 text-amber-500 flex items-center justify-center text-2xl font-bold">!</div>
        <h1 className="text-2xl font-bold text-white mb-4">Failed to load category</h1>
        <p className="text-gray-400 mb-8">
          {error.message || "An error occurred while loading this category."}
        </p>
        <button
          onClick={retry}
          className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-center">
        <div className="text-6xl mb-6">⚠️</div>
        <h1 className="text-2xl font-bold text-white mb-4">Something went wrong</h1>
        <p className="text-gray-400 mb-2 max-w-md">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

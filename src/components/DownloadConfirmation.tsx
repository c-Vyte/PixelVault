"use client";

interface DownloadConfirmationProps {
  onConfirm: () => void;
  onDecline: () => void;
}

export default function DownloadConfirmation({
  onConfirm,
  onDecline,
}: DownloadConfirmationProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-50 flex items-center justify-center p-4">
      <div className="bg-[#111827] rounded-2xl border border-blue-900/30 p-8 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Confirm Download</h2>
          <button
            onClick={onDecline}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <p className="text-gray-300 text-sm mb-4">
          Your download will begin in a new tab.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 transition-colors"
          >
            Download
          </button>
          <button
            onClick={onDecline}
            className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-white font-medium hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";

const CONSENT_KEY = "cookieConsent";

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored === "accepted" || stored === "declined") return;
    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  const decide = (value: "accepted" | "declined") => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0c1222]/95 border-t border-blue-900/50 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center gap-4">
        <div className="flex-1">
          <p className="text-white text-sm font-semibold mb-1">We use cookies 🍪</p>
          <p className="text-blue-300/60 text-xs">
            This site stores a small preference to remember your choices (theme, downloads, and this consent).
            We do not use tracking cookies. Manage or clear them anytime in your browser settings.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => decide("declined")}
            className="px-5 py-2.5 rounded-lg border border-blue-900/50 text-blue-300/70 hover:text-white hover:bg-blue-900/30 text-sm font-semibold transition-colors"
          >
            Decline
          </button>
          <button
            onClick={() => decide("accepted")}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

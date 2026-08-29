"use client";

import { useState, useEffect } from "react";

interface Settings {
  siteName: string;
  siteDescription: string;
  adminEmail: string;
  fdmAffiliateUrl: string;
}

const defaultSettings: Settings = {
  siteName: "PixelVault",
  siteDescription: "Your ultimate gaming & software vault",
  adminEmail: "admin@pixelvault.com",
  fdmAffiliateUrl: "https://www.freedownloadmanager.org/",
};

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("siteSettings");
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("siteSettings", JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-white">Settings</h1>
      </div>

      <div className="max-w-2xl">
        <div className="bg-[#111827] rounded-xl border border-blue-900/30 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">General Settings</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-blue-300/60 text-sm mb-2">Site Name</label>
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) => setSettings({ ...settings, siteName: e.target.value })}
                className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
              />
            </div>
            <div>
              <label className="block text-blue-300/60 text-sm mb-2">Site Description</label>
              <input
                type="text"
                value={settings.siteDescription}
                onChange={(e) => setSettings({ ...settings, siteDescription: e.target.value })}
                className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
              />
            </div>
            <div>
              <label className="block text-blue-300/60 text-sm mb-2">Admin Email</label>
              <input
                type="email"
                value={settings.adminEmail}
                onChange={(e) => setSettings({ ...settings, adminEmail: e.target.value })}
                className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
              />
            </div>
            <div>
              <label className="block text-blue-300/60 text-sm mb-2">FDM Affiliate URL (for torrent downloads)</label>
              <input
                type="url"
                value={settings.fdmAffiliateUrl}
                onChange={(e) => setSettings({ ...settings, fdmAffiliateUrl: e.target.value })}
                placeholder="https://www.freedownloadmanager.org/"
                className="w-full bg-[#0c1222] text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-blue-900/30"
              />
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
        >
          {saved ? "Saved!" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

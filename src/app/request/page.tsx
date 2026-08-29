"use client";

import { useState } from "react";
import { categories } from "@/lib/data";
import { addWorkflowRecord, isValidEmail, isValidHttpUrl, type SoftwareRequest } from "@/lib/workflowStore";

export default function RequestPage() {
  const [form, setForm] = useState({
    softwareName: "",
    category: "pc-games",
    platform: "windows",
    description: "",
    downloadUrl: "",
    email: "",
    isRepack: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitted(false);
    if (form.email && !isValidEmail(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (form.downloadUrl && !isValidHttpUrl(form.downloadUrl)) {
      setError("Please enter a valid HTTP or HTTPS download URL.");
      return;
    }

    setSubmitting(true);
    const record = addWorkflowRecord<SoftwareRequest>("softwareRequests", {
      ...form,
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    setSubmitting(false);
    if (!record) {
      setError("We could not save your request. Please try again.");
      return;
    }
    setSubmitted(true);
    setForm({ 
      softwareName: "", 
      category: "pc-games", 
      platform: "windows", 
      description: "", 
      downloadUrl: "", 
      email: "",
      isRepack: false,
    });
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Request Software</h1>
          <p className="text-gray-400">Can&apos;t find what you&apos;re looking for? Request it and we&apos;ll try to add it.</p>
        </div>

        {submitted && (
          <div className="bg-green-600/20 border border-green-600/30 rounded-xl p-4 mb-6 text-center">
            <p className="text-green-400 font-medium">Request submitted! Thank you for your suggestion.</p>
          </div>
        )}
        {error && (
          <div role="alert" className="bg-red-600/20 border border-red-600/30 rounded-xl p-4 mb-6 text-center">
            <p className="text-red-300 font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl border border-gray-700 p-8">
          <div className="mb-6">
            <label className="block text-gray-400 text-sm mb-2">Software Name *</label>
            <input
              type="text"
              value={form.softwareName}
              onChange={(e) => setForm({ ...form, softwareName: e.target.value })}
              required
              className="w-full bg-gray-900 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700 text-sm"
              placeholder="e.g. Photoshop CC 2025"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full bg-gray-900 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700 text-sm"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Platform</label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full bg-gray-900 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700 text-sm"
              >
                <option value="windows">Windows</option>
                <option value="mac">Mac</option>
                <option value="android">Android</option>
                <option value="cross-platform">Cross-Platform</option>
              </select>
            </div>
          </div>

           <div className="mb-6">
             <label className="block text-gray-400 text-sm mb-2">Description</label>
             <textarea
               value={form.description}
               onChange={(e) => setForm({ ...form, description: e.target.value })}
               rows={3}
               className="w-full bg-gray-900 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700 text-sm resize-none"
               placeholder="Why do you want this software? Any specific version? For repacks: include repack group, language, whether it includes all DLC/updates, etc."
             />
           </div>

           <div className="mb-6">
             <label className="block text-gray-400 text-sm mb-2">Download URL (if you have one)</label>
             <input
               type="url"
               value={form.downloadUrl}
               onChange={(e) => setForm({ ...form, downloadUrl: e.target.value })}
               className="w-full bg-gray-900 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700 text-sm"
               placeholder="https://... (direct download, torrent, or repack link)"
             />
             <p className="text-gray-500 text-xs mt-1">
               We accept direct download links, torrents, and repack/compressed versions
             </p>
           </div>

           <div className="mb-4 flex items-start">
             <div className="flex items-center h-5">
               <input
                 id="is-repack"
                 type="checkbox"
                  checked={form.isRepack}
                 onChange={(e) => setForm({ ...form, isRepack: e.target.checked })}
                 className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
               />
             </div>
             <div className="ml-3 text-left">
               <label className="block text-gray-400 text-sm mb-0" htmlFor="is-repack">
                 Check this if you&apos;re requesting a repacked/compressed version of the software/game
               </label>
               <p className="text-gray-500 text-xs mt-1">
                 Check this if you&apos;re requesting a repack/compressed version
               </p>
             </div>
           </div>

           <div className="mb-8">
            <label className="block text-gray-400 text-sm mb-2">Your Email (optional)</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-gray-900 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700 text-sm"
              placeholder="you@example.com — to notify you when added"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors"
          >
            {submitting ? "Saving..." : "Submit Request"}
          </button>
        </form>

        <div className="mt-8 bg-gray-800/50 rounded-xl border border-gray-700/50 p-6">
          <h3 className="text-white font-medium mb-3">Popular Requests</h3>
          <div className="space-y-2">
            {["Adobe Photoshop CC", "Visual Studio Code", "Figma Desktop", "Docker Desktop", "Postman"].map((name) => (
              <div key={name} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
                <span className="text-gray-300 text-sm">{name}</span>
                <span className="text-gray-500 text-xs">Requested by many</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

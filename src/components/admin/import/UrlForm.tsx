"use client";
import { SOURCE_PRESETS } from "./presets";

export interface UrlFormProps {
  url: string; setUrl: (v: string) => void;
  mode: "site" | "page" | "paste"; setMode: (m: "site" | "page" | "paste") => void;
  pasteHtml: string; setPasteHtml: (v: string) => void;
  loadingList: boolean;
  onFetchList: () => void;
  onCancel: () => void;
}

export function UrlForm({ url, setUrl, mode, setMode, pasteHtml, setPasteHtml, loadingList, onFetchList, onCancel }: UrlFormProps) {
  return (
    <div className="bg-[#111827] rounded-xl p-5 border border-blue-900/30">
      <div className="flex gap-2 mb-3">
        {(["site", "page", "paste"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize ${mode === m ? "bg-indigo-600 text-white" : "bg-[#0b1120] border border-blue-900/40 text-blue-300"}`}>{m}</button>
        ))}
      </div>
      {mode === "paste" ? (
        <textarea value={pasteHtml} onChange={(e) => setPasteHtml(e.target.value)} rows={6} placeholder="Paste listing HTML here..." className="w-full bg-[#0b1120] border border-blue-900/40 rounded-lg p-3 text-xs text-blue-100 font-mono" />
      ) : (
        <div className="flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={mode === "site" ? "https://example.com/" : "https://example.com/list/page/"} className="flex-1 bg-[#0b1120] border border-blue-900/40 rounded-lg px-3 py-2 text-sm text-white" />
          <select onChange={(e) => { if (e.target.value) setUrl(e.target.value); }} defaultValue="" className="bg-[#0b1120] border border-blue-900/40 rounded-lg px-2 py-2 text-xs text-blue-300 max-w-[220px]">
            <option value="">Presets…</option>
            {SOURCE_PRESETS.map((p) => <option key={p.id} value={p.url}>{p.label}</option>)}
          </select>
        </div>
      )}
      <div className="flex gap-2 mt-3">
        <button onClick={onFetchList} disabled={loadingList} className={`px-4 py-2 rounded-lg text-sm font-bold ${loadingList ? "bg-gray-700 text-gray-400" : "bg-indigo-600 hover:bg-indigo-500 text-white"}`}>{loadingList ? "Fetching…" : mode === "paste" ? "Parse pasted HTML" : "Discover entries"}</button>
        {loadingList && <button onClick={onCancel} className="px-3 py-2 rounded-lg text-xs bg-red-900/40 text-red-300">Cancel</button>}
      </div>
    </div>
  );
}

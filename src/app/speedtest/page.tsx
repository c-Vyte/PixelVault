"use client";

import { useState } from "react";

const DOWNLOAD_BYTES = 50 * 1024 * 1024;
const UPLOAD_BYTES = 10 * 1024 * 1024;

type Phase = "idle" | "ping" | "download" | "upload" | "done";

interface Results {
  ping: number;
  downloadMbps: number;
  uploadMbps: number;
  downloadSecs: number;
  uploadSecs: number;
}

function formatMbps(mbps: number): string {
  return mbps.toFixed(mbps >= 100 ? 0 : 1);
}

function uploadWithProgress(body: Uint8Array, onProgress: (pct: number) => void): Promise<number> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/speedtest/upload");
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        resolve(data.bytes ?? body.byteLength);
      } catch {
        resolve(body.byteLength);
      }
    };
    xhr.onerror = () => reject(new Error("Upload request failed"));
    xhr.send(body.buffer as ArrayBuffer);
  });
}

export default function SpeedTestPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Results | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);

  const runTest = async () => {
    if (running) return;
    setRunning(true);
    setError("");
    setResults(null);

    try {
      setPhase("ping");
      let total = 0;
      let ok = 0;
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const res = await fetch("/api/speedtest/ping", { cache: "no-store" });
        await res.arrayBuffer();
        total += performance.now() - start;
        ok++;
      }
      const ping = total / ok;

      setPhase("download");
      setProgress(0);
      const dlStart = performance.now();
      let received = 0;
      const dlRes = await fetch(`/api/speedtest/download?bytes=${DOWNLOAD_BYTES}`, { cache: "no-store" });
      if (!dlRes.ok || !dlRes.body) throw new Error(`Download failed (HTTP ${dlRes.status})`);
      const dlReader = dlRes.body.getReader();
      for (;;) {
        const { done, value } = await dlReader.read();
        if (done) break;
        received += value.byteLength;
        setProgress(Math.min(100, (received / DOWNLOAD_BYTES) * 100));
      }
      const downloadSecs = (performance.now() - dlStart) / 1000;
      const downloadMbps = (received * 8) / downloadSecs / 1e6;

      setPhase("upload");
      setProgress(0);
      const payload = new Uint8Array(UPLOAD_BYTES).fill(65);
      const upStart = performance.now();
      await uploadWithProgress(payload, (pct) => setProgress(pct));
      const uploadSecs = (performance.now() - upStart) / 1000;
      const uploadMbps = (payload.byteLength * 8) / uploadSecs / 1e6;

      setResults({ ping, downloadMbps, uploadMbps, downloadSecs, uploadSecs });
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Speed test failed");
      setPhase("idle");
    } finally {
      setRunning(false);
    }
  };

  const phaseLabel: Record<Phase, string> = {
    idle: "Ready",
    ping: "Testing latency…",
    download: "Testing download…",
    upload: "Testing upload…",
    done: "Complete",
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <a href="/" className="hover:text-white transition-colors">Home</a>
        <span>/</span>
        <span className="text-white">Speed Test</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight mb-2">
          Network <span className="text-amber-500">Speed Test</span>
        </h1>
        <p className="text-gray-400">Measures latency, download, and upload speed against this server.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-500 mb-2">Ping</p>
          <p className="text-3xl font-black text-white">
            {results ? `${results.ping.toFixed(1)} ms` : "—"}
          </p>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-500 mb-2">Download</p>
          <p className="text-3xl font-black text-amber-500">
            {results ? `${formatMbps(results.downloadMbps)} Mbps` : "—"}
          </p>
          {results && (
            <p className="text-xs text-gray-500 mt-1">
              {(results.downloadMbps / 8).toFixed(1)} MB/s in {results.downloadSecs.toFixed(1)}s
            </p>
          )}
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-500 mb-2">Upload</p>
          <p className="text-3xl font-black text-blue-400">
            {results ? `${formatMbps(results.uploadMbps)} Mbps` : "—"}
          </p>
          {results && (
            <p className="text-xs text-gray-500 mt-1">
              {(results.uploadMbps / 8).toFixed(1)} MB/s in {results.uploadSecs.toFixed(1)}s
            </p>
          )}
        </div>
      </div>

      {(running || phase === "done") && (
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between text-sm text-gray-400 mb-3">
            <span className="font-bold uppercase tracking-[0.15em] text-xs">{phaseLabel[phase]}</span>
            <span>{running ? `${progress.toFixed(0)}%` : "100%"}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-amber-600 to-amber-400 h-3 rounded-full transition-all duration-200"
              style={{ width: `${running ? progress : 100}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-8">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      <button
        onClick={runTest}
        disabled={running}
        className="cyber-btn px-10 py-5 rounded-lg font-bold text-sm uppercase tracking-[0.2em] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {running ? "Testing…" : results ? "Run Again" : "Start Test"}
      </button>

      <p className="text-gray-600 text-xs mt-6 max-w-2xl leading-relaxed">
        Downloads {Math.round(DOWNLOAD_BYTES / 1024 / 1024)} MB and uploads{" "}
        {Math.round(UPLOAD_BYTES / 1024 / 1024)} MB of data. Results depend on your connection and this
        server's bandwidth.
      </p>
    </div>
  );
}

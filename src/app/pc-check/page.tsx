"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import { softwareData, type Software } from "@/lib/data";

type HardwareProfile = {
  ram: number;
  gpuTier: number;
  threads: number;
  platform: string;
  resolution: "1080p" | "1440p" | "4K";
  fpsTarget: 30 | 60 | 120;
};

const profileStorageKey = "pcCheckProfile";
const profileVersionKey = "pcCheckProfileVersion";
const profileVersion = "2";

const gpuOptions = [
  { label: "Integrated graphics", value: 0 },
  { label: "GTX 660 / RX 570", value: 1 },
  { label: "GTX 1060 / RX 580", value: 2 },
  { label: "RTX 2060 / RX 5600", value: 3 },
  { label: "RTX 3060 / RX 6700", value: 4 },
  { label: "RTX 4070 or better", value: 5 },
];

function requiredRam(game: Software) {
  const match = game.systemRequirements.match(/Minimum:[\s\S]*?(\d+)\s*GB\s*RAM/i);
  return match ? Number(match[1]) : 8;
}

function requiredGpuTier(game: Software) {
  const requirements = game.systemRequirements.toLowerCase();
  if (/rtx\s*(30|40|50)\d{2}|rx\s*(6|7)\d{3}/i.test(requirements)) return 4;
  if (/rtx\s*20\d{2}|gtx\s*16\d{2}|rx\s*5\d{3}/i.test(requirements)) return 3;
  if (/gtx\s*10\d{2}|rx\s*5\d{2}/i.test(requirements)) return 2;
  if (/gtx\s*(6\d{2}|7\d{2}|9\d{2})|rx\s*(2\d{3}|4\d{3})|radeon\s*(hd\s*)?(7|8)\d{2}/i.test(requirements)) return 1;
  return 0;
}

function detectedGpuTier(renderer: string | null) {
  if (!renderer) return 0;
  const gpu = renderer.toLowerCase();
  if (/rtx\s*40|rtx\s*50|rx\s*(6|7)\d{3}/i.test(gpu)) return 5;
  if (/rtx\s*30|rx\s*6\d{3}/i.test(gpu)) return 4;
  if (/rtx\s*20|gtx\s*16|rx\s*5\d{3}/i.test(gpu)) return 3;
  if (/gtx\s*10|rx\s*5\d{2}/i.test(gpu)) return 2;
  if (/gtx\s*(6\d{2}|7\d{2}|9\d{2})|radeon\s*(hd\s*)?(7|8)\d{2}/i.test(gpu)) return 1;
  return 0;
}

function scoreGame(game: Software, profile: HardwareProfile) {
  const ram = requiredRam(game);
  const gpu = requiredGpuTier(game);
  const minimumRamMet = profile.ram >= ram;
  const minimumGpuMet = profile.gpuTier >= gpu;
  const ramScore = profile.ram >= ram ? 50 : Math.max(0, 50 - (ram - profile.ram) * 15);
  const gpuScore = profile.gpuTier >= gpu ? 45 : Math.max(0, 45 - (gpu - profile.gpuTier) * 18);
  const cpuScore = profile.threads >= 8 ? 5 : profile.threads >= 4 ? 4 : 2;
  const resolutionPenalty = profile.resolution === "4K" ? 22 : profile.resolution === "1440p" ? 10 : 0;
  const fpsPenalty = profile.fpsTarget === 120 ? 12 : profile.fpsTarget === 60 ? 4 : 0;
  const rawScore = Math.max(0, Math.min(100, Math.round(ramScore + gpuScore + cpuScore - resolutionPenalty - fpsPenalty)));
  return minimumRamMet && minimumGpuMet ? rawScore : Math.min(rawScore, 44);
}

function fitLabel(score: number) {
  if (score >= 90) return "Strong match";
  if (score >= 75) return "Playable at target";
  if (score >= 55) return "Playable with compromises";
  if (score >= 45) return "Likely rough experience";
  return "Not recommended";
}

export default function PCCheckPage() {
  const [profile, setProfile] = useState<HardwareProfile>({
    ram: 8,
    gpuTier: 0,
    threads: 4,
    platform: "Unknown",
    resolution: "1080p",
    fpsTarget: 60,
  });
  const [scanned, setScanned] = useState(false);
  const [profileHydrated, setProfileHydrated] = useState(false);

  useEffect(() => {
    const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
    const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info");
    const renderer = debugInfo && gl ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : null;
    let savedProfile: Partial<HardwareProfile> = {};
    try {
      const stored = localStorage.getItem(profileStorageKey);
      if (stored && localStorage.getItem(profileVersionKey) === profileVersion) {
        savedProfile = JSON.parse(stored) as Partial<HardwareProfile>;
      }
    } catch {
      savedProfile = {};
    }

    startTransition(() => {
      setProfile((current) => ({
        ...current,
        ...savedProfile,
        gpuTier: typeof savedProfile.gpuTier === "number" ? savedProfile.gpuTier : detectedGpuTier(renderer),
        ram: typeof savedProfile.ram === "number" ? savedProfile.ram : navigatorWithMemory.deviceMemory ? Math.max(4, Math.round(navigatorWithMemory.deviceMemory)) : current.ram,
        threads: typeof savedProfile.threads === "number" ? savedProfile.threads : navigator.hardwareConcurrency || current.threads,
        platform: typeof savedProfile.platform === "string" ? savedProfile.platform : navigator.platform || "Unknown",
        resolution: savedProfile.resolution === "1080p" || savedProfile.resolution === "1440p" || savedProfile.resolution === "4K" ? savedProfile.resolution : current.resolution,
        fpsTarget: savedProfile.fpsTarget === 30 || savedProfile.fpsTarget === 60 || savedProfile.fpsTarget === 120 ? savedProfile.fpsTarget : current.fpsTarget,
      }));
      setProfileHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!profileHydrated) return;
    try {
      localStorage.setItem(profileStorageKey, JSON.stringify(profile));
      localStorage.setItem(profileVersionKey, profileVersion);
    } catch {
      // Persistence is optional in restricted browser contexts.
    }
  }, [profile, profileHydrated]);

  const recommendations = useMemo(
    () => softwareData
      .filter((game) => game.category === "pc-games")
      .map((game) => ({ game, score: scoreGame(game, profile) }))
      .sort((a, b) => b.score - a.score || b.game.rating - a.game.rating)
      .slice(0, 6),
    [profile],
  );

  function scanAgain() {
    const navigatorWithMemory = navigator as Navigator & { deviceMemory?: number };
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
    const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info");
    const renderer = debugInfo && gl ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : null;
    startTransition(() => {
      setProfile((current) => ({
        ...current,
        gpuTier: detectedGpuTier(renderer),
        ram: navigatorWithMemory.deviceMemory ? Math.max(4, Math.round(navigatorWithMemory.deviceMemory)) : current.ram,
        threads: navigator.hardwareConcurrency || current.threads,
        platform: navigator.platform || "Unknown",
      }));
    });
    setScanned(true);
  }

  return (
    <div className="min-h-screen bg-gray-950 py-12">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-3xl">
          <Link href="/category/pc-games" className="text-xs font-bold uppercase tracking-[0.2em] text-amber-500 hover:text-amber-300">
            Back to games
          </Link>
          <p className="mt-8 text-sm font-black uppercase tracking-[0.3em] text-amber-500">PC Game Matcher</p>
          <h1 className="mt-3 text-4xl font-black uppercase tracking-tight text-white md:text-6xl">
            Find games your rig can handle.
          </h1>
          <p className="mt-5 max-w-2xl text-gray-400">
            We use browser-safe signals and the game requirements in our library to make a practical recommendation. No hardware data leaves this page.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-2xl border border-gray-800 bg-gray-900/70 p-6 md:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold uppercase tracking-wide text-white">Your hardware</h2>
                <p className="mt-1 text-sm text-gray-500">Review the estimates before matching.</p>
              </div>
              <button type="button" onClick={scanAgain} className="rounded-lg border border-amber-500/40 px-3 py-2 text-xs font-bold uppercase tracking-wider text-amber-400 hover:bg-amber-500/10">
                {scanned ? "Scan again" : "Detect"}
              </button>
            </div>

            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">Memory (RAM)</span>
                <select value={profile.ram} onChange={(event) => setProfile({ ...profile, ram: Number(event.target.value) })} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-amber-500">
                  {[4, 8, 16, 32, 64].map((ram) => <option key={ram} value={ram}>{ram} GB</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">Target resolution</span>
                <select value={profile.resolution} onChange={(event) => setProfile({ ...profile, resolution: event.target.value as HardwareProfile["resolution"] })} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-amber-500">
                  <option value="1080p">1080p</option>
                  <option value="1440p">1440p</option>
                  <option value="4K">4K</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">Target FPS</span>
                <select value={profile.fpsTarget} onChange={(event) => setProfile({ ...profile, fpsTarget: Number(event.target.value) as HardwareProfile["fpsTarget"] })} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-amber-500">
                  <option value={30}>30 FPS</option>
                  <option value={60}>60 FPS</option>
                  <option value={120}>120 FPS</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-400">Graphics card</span>
                <select value={profile.gpuTier} onChange={(event) => setProfile({ ...profile, gpuTier: Number(event.target.value) })} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 text-white outline-none focus:border-amber-500">
                  {gpuOptions.map((gpu) => <option key={gpu.value} value={gpu.value}>{gpu.label}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500">CPU threads</p>
                  <p className="mt-2 text-lg font-bold text-white">{profile.threads}</p>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
                  <p className="text-xs uppercase tracking-wider text-gray-500">Platform</p>
                  <p className="mt-2 truncate text-lg font-bold text-white">{profile.platform}</p>
                </div>
              </div>
            </div>
            <p className="mt-6 text-xs leading-relaxed text-gray-600">Exact GPU model and installed RAM are hidden by most browsers. The detected values are estimates, so adjust them when you know your specs.</p>
          </section>

          <section>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-500">Recommended for you</p>
                <h2 className="mt-2 text-2xl font-black uppercase text-white">Best matches</h2>
              </div>
              <span className="text-xs text-gray-500">{recommendations.length} results</span>
            </div>
            <div className="space-y-3">
              {recommendations.map(({ game, score }) => (
                <Link key={game.id} href={`/software/${game.id}`} className="group flex items-center gap-4 rounded-xl border border-gray-800 bg-gray-900/60 p-4 transition hover:border-amber-500/50 hover:bg-gray-900">
                  <img src={game.icon} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-bold text-white group-hover:text-amber-400">{game.title}</h3>
                      <span className="rounded bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">{fitLabel(score)}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{requiredRam(game)} GB RAM minimum · {profile.resolution} / {profile.fpsTarget} FPS target · {game.size}</p>
                  </div>
                  <span className="hidden text-right sm:block"><span className="block text-2xl font-black text-white">{score}%</span><span className="text-[10px] uppercase tracking-wider text-gray-600">match</span></span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

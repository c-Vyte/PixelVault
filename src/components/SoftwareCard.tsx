"use client";

import React from "react";
import Link from "next/link";
import { Software } from "@/lib/data";
import { AppleMacIcon, DownloadIcon, StarIcon, WindowsIcon, SmartphoneIcon } from "./icons";

export function getLinkTypeColor(type: string) {
  switch (type) {
    case "repack":
      return "site-primary-bg site-primary-border";
    case "torrent":
      return "bg-amber-500 text-slate-950 border-amber-300";
    case "official":
      return "bg-emerald-500 text-slate-950 border-emerald-300";
    case "cracked":
      return "bg-red-500 text-white border-red-300";
    default:
      return "site-primary-bg site-primary-border";
  }
}

export function PlatformBadge({ platform }: { platform: string }) {
  if (platform === "mac") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-[#16102c] px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.12em] text-slate-300 ring-1 ring-[#2c2450]">
        <AppleMacIcon className="h-3 w-3" /> macOS
      </span>
    );
  }
  if (platform === "android" || platform === "ios") {
    return (
      <span className="inline-flex items-center gap-1 rounded bg-[#16102c] px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.12em] text-slate-300 ring-1 ring-[#2c2450]">
        <SmartphoneIcon className="h-3 w-3" /> Mobile
      </span>
    );
  }
  if (platform === "cross-platform") {
    return (
      <span className="inline-flex items-center rounded bg-[#16102c] px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.12em] text-[#b19cff] ring-1 ring-[#2c2450]">
        Multi
      </span>
    );
  }
  return (
    <span className="site-primary-bg inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-[0.12em]">
      <WindowsIcon className="h-3 w-3" /> Windows
    </span>
  );
}

export function SoftwareCard({
  item: itemProp,
  software,
  onQuickDownload,
  compact,
}: {
  item?: Software;
  software?: Software;
  onQuickDownload?: (item: Software) => void;
  compact?: boolean;
}) {
  const item = itemProp || software!;
  const primaryLinkType = item.downloadLinks[0]?.type || "direct";

  return (
    <article className="site-card group overflow-hidden rounded-xl border shadow-md transition-all duration-200 hover:-translate-y-1">
      <Link href={`/software/${item.id}`} className="site-card-elevated relative block aspect-[1.35] overflow-hidden">
        <img src={item.icon} alt={item.title} className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080511] via-[#080511]/15 to-transparent" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className={`rounded border px-2 py-0.5 font-mono text-[8px] font-black uppercase tracking-[0.14em] ${getLinkTypeColor(primaryLinkType)}`}>{primaryLinkType}</span>
          <PlatformBadge platform={item.platform} />
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3">
          <h3 className="media-overlay-text line-clamp-2 max-w-[78%] text-sm font-black leading-tight drop-shadow">
            {item.title}
          </h3>
          <span className="media-overlay-text rounded bg-black/55 px-2 py-1 font-mono text-[9px] font-bold backdrop-blur">
            {item.size}
          </span>
        </div>
      </Link>

      <div className="p-4">
        <p className="site-muted line-clamp-2 min-h-9 text-xs leading-5">{item.description}</p>
        <div className="site-card-border mt-4 flex items-center justify-between border-t pt-3">
          <div className="site-muted flex items-center gap-3 font-mono text-[10px]">
            <span className="site-accent-text inline-flex items-center gap-1"><StarIcon className="h-3.5 w-3.5" filled /> {item.rating.toFixed(1)}</span>
            <span>{(item.downloads || 0).toLocaleString()} DLs</span>
          </div>
          {onQuickDownload ? (
            <button onClick={() => onQuickDownload(item)} className="site-primary-text font-mono text-[10px] font-black uppercase tracking-[0.14em] hover:opacity-70 cursor-pointer">
              View
            </button>
          ) : (
            <Link href={`/software/${item.id}`} className="site-primary-text font-mono text-[10px] font-black uppercase tracking-[0.14em] hover:opacity-70">
              View
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export default SoftwareCard;

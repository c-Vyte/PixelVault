"use client";

import Link from "next/link";
import { Software } from "@/lib/data";

function formatDownloads(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

function getLinkTypeClass(type: "official" | "repack" | "direct" | "cracked" | "torrent"): string {
  switch (type) {
    case "official":
      return "bg-blue-600 text-white";
    case "repack":
      return "bg-amber-600 text-white";
    case "direct":
      return "bg-green-600 text-white";
    case "torrent":
      return "bg-emerald-600 text-white";
    case "cracked":
      return "bg-red-600 text-white";
    default:
      return "bg-gray-600 text-white";
  }
}

export default function SoftwareCard({ software, compact }: { software: Software; compact?: boolean }) {
  // Get unique download link types
  const linkTypes = [...new Set(software.downloadLinks.map(link => link.type))];
  // Check if software has repack links
  const hasRepack = software.downloadLinks.some(link => link.type === "repack");
   
  if (compact) {
    return (
      <Link href={`/software/${software.id}`} className="group block rounded-xl overflow-hidden bg-gray-900 border border-gray-800 hover:border-amber-500/50 transition-all">
        <div className="relative h-44 sm:h-48 overflow-hidden bg-gray-900">
          {software.icon || software.poster ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={software.icon || software.poster} alt={software.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-600 text-[10px] uppercase">No Image</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute bottom-0 left-0 right-0 p-2 translate-y-full group-hover:translate-y-0 transition-transform bg-black/70 backdrop-blur-sm">
            <h3 className="text-white font-bold text-xs line-clamp-2 leading-tight" title={software.title}>{software.title}</h3>
          </div>
          <div className="absolute top-1.5 left-1.5 flex gap-1">
            {linkTypes.slice(0,1).map((type, i) => (
              <span key={i} className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${getLinkTypeClass(type as any)}`}>{type.toUpperCase()}</span>
            ))}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/software/${software.id}`}
      className="group block gaming-card rounded-xl overflow-hidden"
    >
      {/* Image section */}
      <div className="relative h-64 overflow-hidden bg-gray-900">
        {software.icon || software.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={software.icon || software.poster}
            alt={software.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-600 text-xs">No Image</div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/40 to-transparent" />
        
        {/* Red accent line at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
        
        {/* Download link type badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1">
          {linkTypes.map((type, index) => (
            <span key={index} className={`px-2 py-0.5 text-xs font-bold rounded ${getLinkTypeClass(type as "official" | "repack" | "direct" | "cracked" | "torrent")}`}>
              {type.toUpperCase()}
            </span>
          ))}
        </div>
        
        {/* Repack indicator */}
        {hasRepack && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-0.5 text-xs font-bold bg-amber-600 text-white rounded">
              REPACK
            </span>
          </div>
        )}
        
        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="text-white font-bold text-base line-clamp-1 uppercase tracking-wide">
            {software.title}
          </h3>
        </div>
        
        {/* Platform badge */}
        <div className="absolute top-3 right-3">
          <span className="px-2.5 py-1 bg-amber-600 text-white text-xs font-bold uppercase rounded">
            {software.platform}
          </span>
        </div>
      </div>

      {/* Info section */}
      <div className="p-4">
        <p className="text-gray-400 text-xs line-clamp-2 mb-4 leading-relaxed">
          {software.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
              </svg>
              {formatDownloads(software.downloads)}
            </span>
            <span className="text-gray-600">•</span>
            <span>{software.size}</span>
          </div>
          <span className="text-xs font-semibold text-amber-500 uppercase tracking-wider group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
            View
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}

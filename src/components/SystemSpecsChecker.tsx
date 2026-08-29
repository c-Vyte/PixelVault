"use client";

import { useEffect, useState } from "react";
import { detectSystemSpecs, type DetectedSpecs } from "@/lib/detectSpecs";
import { checkCompatibility, type CompatibilityResult } from "@/lib/recommendations/compatibility";

interface Props {
  systemRequirements: string;
}

export default function SystemSpecsChecker({ systemRequirements }: Props) {
  const [specs, setSpecs] = useState<DetectedSpecs | null>(null);
  const [compat, setCompat] = useState<CompatibilityResult | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const detected = detectSystemSpecs();
    setSpecs(detected);
    const result = checkCompatibility(detected, systemRequirements);
    setCompat(result);
  }, [systemRequirements]);

  if (!specs || !compat) return null;

  const statusColors = {
    excellent: "bg-green-500",
    good: "bg-green-400",
    playable: "bg-amber-500",
    poor: "bg-red-500",
    unknown: "bg-gray-500",
  };

  const statusLabels = {
    excellent: "Excellent - Meets all requirements",
    good: "Good - Meets most requirements",
    playable: "Playable - May need compromises",
    poor: "Poor - May struggle to run",
    unknown: "Unknown - Check manually",
  };

  const statusIcons = {
    excellent: (
      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    good: (
      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    playable: (
      <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    poor: (
      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    unknown: (
      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  const specStatusColors = {
    met: "text-green-400",
    partial: "text-amber-400",
    not_met: "text-red-400",
    unknown: "text-gray-400",
  };

  const specStatusBg = {
    met: "bg-green-500/10 border-green-500/20",
    partial: "bg-amber-500/10 border-amber-500/20",
    not_met: "bg-red-500/10 border-red-500/20",
    unknown: "bg-gray-500/10 border-gray-500/20",
  };

  const specStatusIcons = {
    met: "✓",
    partial: "~",
    not_met: "✗",
    unknown: "?",
  };

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left group"
      >
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${statusColors[compat.overall]}`} />
          <div>
            <div className="flex items-center gap-2">
              {statusIcons[compat.overall]}
              <h2 className="text-xl font-bold text-white">Your PC</h2>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">{statusLabels[compat.overall]}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${specStatusColors[compat.checks.some((c) => c.status === "not_met") ? "not_met" : compat.checks.some((c) => c.status === "partial") ? "partial" : "met"]}`}>
            {Math.round(compat.score)}%
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {compat.checks.map((check, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${specStatusBg[check.status]}`}
            >
              <span className={`text-lg font-bold flex-shrink-0 w-5 text-center ${specStatusColors[check.status]}`}>
                {specStatusIcons[check.status]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{check.label}</span>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${specStatusColors[check.status]}`}>
                    {check.status === "met" ? "PASS" : check.status === "partial" ? "CLOSE" : check.status === "not_met" ? "FAIL" : "N/A"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-gray-400">
                  <span>Detected: <span className="text-white font-medium">{check.detected}</span></span>
                  {check.required && check.required !== "Unknown" && (
                    <span className="ml-3">Required: <span className="text-gray-300">{check.required}</span></span>
                  )}
                  {check.recommended && (
                    <span className="ml-3">Recommended: <span className="text-gray-300">{check.recommended}</span></span>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">{check.detail}</p>
              </div>
            </div>
          ))}

          <div className="pt-2 text-center">
            <p className="text-xs text-gray-500">
              Specs detected via your browser. GPU comparison is approximate. Always check official requirements.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

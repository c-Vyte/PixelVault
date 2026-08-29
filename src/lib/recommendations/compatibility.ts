import type { DetectedSpecs } from "@/lib/detectSpecs";

export interface CompatibilityResult {
  overall: "excellent" | "good" | "playable" | "poor" | "unknown";
  score: number;
  summary: string;
  checks: SpecCheck[];
}

export interface SpecCheck {
  label: string;
  detected: string;
  required: string;
  recommended: string;
  status: "met" | "partial" | "not_met" | "unknown";
  detail: string;
}

export function checkCompatibility(
  specs: DetectedSpecs,
  systemRequirements: string
): CompatibilityResult {
  const parsed = parseRequirements(systemRequirements);
  const checks: SpecCheck[] = [];

  if (specs.os && parsed.osRequired) {
    const met = checkOS(specs.os, specs.osVersion, parsed.osRequired);
    checks.push({
      label: "Operating System",
      detected: specs.osVersion ? `${specs.os} ${specs.osVersion}` : specs.os,
      required: parsed.osRequired,
      recommended: "",
      status: met ? "met" : "not_met",
      detail: met ? "Your OS meets the requirement" : `Requires ${parsed.osRequired}`,
    });
  } else if (specs.os) {
    checks.push({
      label: "Operating System",
      detected: specs.osVersion ? `${specs.os} ${specs.osVersion}` : specs.os,
      required: "Any",
      recommended: "",
      status: "met",
      detail: "OS detected",
    });
  }

  if (specs.ramGB !== null) {
    const ramCheck = checkRAM(specs.ramGB, parsed.minRamGB, parsed.recRamGB);
    checks.push({
      label: "RAM",
      detected: `${specs.ramGB} GB`,
      required: parsed.minRamGB ? `${parsed.minRamGB} GB` : "Unknown",
      recommended: parsed.recRamGB ? `${parsed.recRamGB} GB` : "",
      status: ramCheck.status,
      detail: ramCheck.detail,
    });
  }

  if (specs.cpuCores !== null) {
    const cpuCheck = checkCPU(specs.cpuCores, parsed.minCpuCores, parsed.recCpuCores);
    checks.push({
      label: "CPU Cores",
      detected: `${specs.cpuCores} threads`,
      required: parsed.minCpuCores ? `${parsed.minCpuCores}+ cores` : "Unknown",
      recommended: parsed.recCpuCores ? `${parsed.recCpuCores}+ cores` : "",
      status: cpuCheck.status,
      detail: cpuCheck.detail,
    });
  }

  if (specs.gpu) {
    const gpuCheck = checkGPU(specs.gpu, parsed.minGpuTier, parsed.recGpuTier);
    checks.push({
      label: "GPU",
      detected: specs.gpu.length > 50 ? specs.gpu.slice(0, 50) + "..." : specs.gpu,
      required: parsed.minGpuName || "Unknown",
      recommended: parsed.recGpuName || "",
      status: gpuCheck.status,
      detail: gpuCheck.detail,
    });
  }

  if (parsed.storageGB) {
    checks.push({
      label: "Storage Required",
      detected: "Check your disk",
      required: `${parsed.storageGB} GB free`,
      recommended: "",
      status: "unknown",
      detail: `Game needs ${parsed.storageGB} GB of free disk space`,
    });
  }

  const metCount = checks.filter((c) => c.status === "met").length;
  const partialCount = checks.filter((c) => c.status === "partial").length;
  const notMetCount = checks.filter((c) => c.status === "not_met").length;
  const unknownCount = checks.filter((c) => c.status === "unknown").length;

  let score = 0;
  if (checks.length > 0) {
    score = ((metCount * 100 + partialCount * 50) / (checks.length * 100)) * 100;
  }

  let overall: CompatibilityResult["overall"];
  let summary: string;

  if (checks.length === 0 || (unknownCount === checks.length)) {
    overall = "unknown";
    summary = "Unable to determine compatibility. Check system requirements manually.";
  } else if (notMetCount === 0 && partialCount === 0) {
    overall = "excellent";
    summary = "Your system meets or exceeds all listed requirements.";
  } else if (notMetCount === 0) {
    overall = "good";
    summary = "Your system meets most requirements with some borderline specs.";
  } else if (notMetCount <= 1 && metCount >= partialCount) {
    overall = "playable";
    summary = "Your system may run this with some compromises.";
  } else {
    overall = "poor";
    summary = "Your system may struggle to run this. Consider upgrading.";
  }

  return { overall, score, summary, checks };
}

interface ParsedRequirements {
  osRequired: string | null;
  minRamGB: number | null;
  recRamGB: number | null;
  minCpuCores: number | null;
  recCpuCores: number | null;
  minGpuTier: number;
  recGpuTier: number;
  minGpuName: string;
  recGpuName: string;
  storageGB: number | null;
}

const GPU_TIERS: [RegExp, number][] = [
  [/(?:rtx\s*4090|rtx\s*4080|rtx\s*4070\s*titan)/i, 5],
  [/(?:rtx\s*4070|rtx\s*3090|rtx\s*3080|rx\s*7900)/i, 5],
  [/(?:rtx\s*3070|rtx\s*3060\s*titan|rx\s*7800|rx\s*6800)/i, 4],
  [/(?:rtx\s*2080|rtx\s*2070|rtx\s*2060|gtx\s*1080|gtx\s*1070|rx\s*6700|rx\s*5700|arc\s*a770)/i, 4],
  [/(?:gtx\s*1660|gtx\s*1060|rx\s*580|rx\s*570|arc\s*a750|arc\s*a380)/i, 3],
  [/(?:gtx\s*1050|gtx\s*970|gtx\s*960|rx\s*480|rx\s*470|hd\s*7870|hd\s*7850|r9\s*280|r9\s*270)/i, 2],
  [/(?:gtx\s*750|gtx\s*760|gtx\s*770|gtx\s*780|hd\s*7770|hd\s*7790|gt\s*1030|r5\s*240)/i, 1],
  [/(?:intel\s*(?:uhd|hd)\s*\d+|intel\s*iris|vega\s*\d+|radeon\s*rx\s*vega|r7\s*240)/i, 0],
  [/(?:integrated|igpu|igp|intel\s*hd|intel\s*uhd)/i, 0],
];

function parseRequirements(reqs: string): ParsedRequirements {
  const lower = reqs.toLowerCase();
  const sections = reqs.split(/Recommended:/i);
  const minSection = sections[0] || "";
  const recSection = sections[1] || "";

  const osMatch = reqs.match(/(Windows\s*\d+[\w\s\/]*(?:64-bit)?|macOS\s*[\d.+]+|Linux|Android\s*[\d.+]+)/i);

  let minRamGB = extractRAM(minSection);
  let recRamGB = extractRAM(recSection);

  let minCpuCores = extractCPUCores(minSection);
  let recCpuCores = extractCPUCores(recSection);

  let minGpuTier = extractGPUTier(minSection);
  let recGpuTier = extractGPUTier(recSection);

  let minGpuName = extractGPUName(minSection);
  let recGpuName = extractGPUName(recSection);

  let storageGB = extractStorage(reqs);

  return {
    osRequired: osMatch?.[1]?.trim() || null,
    minRamGB,
    recRamGB,
    minCpuCores,
    recCpuCores,
    minGpuTier,
    recGpuTier,
    minGpuName,
    recGpuName,
    storageGB,
  };
}

function extractRAM(text: string): number | null {
  const match = text.match(/(\d+)\s*GB\s*RAM/i);
  return match ? parseInt(match[1], 10) : null;
}

function extractCPUCores(text: string): number | null {
  const match = text.match(/(\d+)\s*(?:cores?|threads?)/i);
  return match ? parseInt(match[1], 10) : null;
}

function extractGPUTier(text: string): number {
  for (const [pattern, tier] of GPU_TIERS) {
    if (pattern.test(text)) return tier;
  }
  return -1;
}

function extractGPUName(text: string): string {
  const patterns = [
    /(?:NVIDIA|GeForce|GTX|RTX)\s*(?:GeForce\s*)?(?:GTX|RTX)\s*\d+\s*(?:Ti|Super)?/i,
    /(?:AMD|Radeon|RX)\s*(?:Radeon\s*)?(?:RX|HD|R\d)\s*\d+/i,
    /(?:Intel\s*(?:Arc|HD|UHD|Iris))\s*(?:A\d+|HD\s*\d+|UHD\s*\d+)?/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return "";
}

function extractStorage(text: string): number | null {
  const patterns = [
    /(\d+)\s*GB\s*(?:available|storage|disk|SSD|HDD|space)/i,
    /(\d+)\s*GB\s+(?:SSD|HDD)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

function checkOS(os: string, osVersion: string | null, required: string): boolean {
  const reqLower = required.toLowerCase();
  const osLower = os.toLowerCase();

  if (reqLower.includes("windows")) {
    if (osLower !== "windows") return false;
    const verMatch = required.match(/Windows\s*(\d+)/i);
    if (verMatch && osVersion) {
      const reqVer = parseInt(verMatch[1], 10);
      const haveVer = parseInt(osVersion.split("/")[0], 10);
      return haveVer >= reqVer;
    }
    return true;
  }
  if (reqLower.includes("macos") || reqLower.includes("mac")) return osLower === "macos" || osLower === "mac";
  if (reqLower.includes("linux")) return osLower === "linux" || osLower === "windows";
  if (reqLower.includes("android")) return osLower === "android";
  return true;
}

function checkRAM(haveGB: number, minGB: number | null, recGB: number | null): { status: "met" | "partial" | "not_met" | "unknown"; detail: string } {
  if (minGB === null) return { status: "unknown", detail: "RAM requirement not specified" };
  if (haveGB >= minGB) {
    if (recGB && haveGB >= recGB) {
      return { status: "met", detail: `Meets recommended ${recGB}GB` };
    }
    return { status: "met", detail: `Meets minimum ${minGB}GB` };
  }
  const diff = minGB - haveGB;
  if (diff <= 2) {
    return { status: "partial", detail: `Close - need ${diff}GB more RAM` };
  }
  return { status: "not_met", detail: `Need ${diff}GB more RAM (have ${haveGB}GB, need ${minGB}GB)` };
}

function checkCPU(haveCores: number, minCores: number | null, recCores: number | null): { status: "met" | "partial" | "not_met" | "unknown"; detail: string } {
  if (minCores === null) return { status: "unknown", detail: "CPU requirement not specified" };
  if (haveCores >= minCores) {
    if (recCores && haveCores >= recCores) {
      return { status: "met", detail: `Meets recommended ${recCores}+ threads` };
    }
    return { status: "met", detail: `Meets minimum ${minCores}+ threads` };
  }
  return { status: "not_met", detail: `Need ${minCores}+ threads (have ${haveCores})` };
}

function checkGPU(_gpuName: string, minTier: number, recTier: number): { status: "met" | "partial" | "not_met" | "unknown"; detail: string } {
  if (minTier === -1) return { status: "unknown", detail: "GPU requirement not detected" };
  return { status: "unknown", detail: "GPU comparison requires manual check" };
}

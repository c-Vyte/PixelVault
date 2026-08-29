export interface DetectedSpecs {
  cpuCores: number | null;
  ramGB: number | null;
  gpu: string | null;
  os: string | null;
  osVersion: string | null;
}

export function detectSystemSpecs(): DetectedSpecs {
  const cpuCores =
    typeof navigator !== "undefined" ? navigator.hardwareConcurrency ?? null : null;

  let ramGB: number | null = null;
  if (typeof navigator !== "undefined" && "deviceMemory" in navigator) {
    ramGB = (navigator as { deviceMemory?: number }).deviceMemory ?? null;
  }

  let gpu: string | null = null;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") as WebGLRenderingContext | null;
    if (gl) {
      const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        if (renderer && typeof renderer === "string" && renderer !== "Google SwiftShader") {
          gpu = renderer;
        } else if (renderer) {
          gpu = renderer;
        }
      }
    }
  } catch {}

  let os: string | null = null;
  let osVersion: string | null = null;
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent;
    if (ua.includes("Win")) {
      os = "Windows";
      const winMatch = ua.match(/Windows NT (\d+\.\d+)/);
      if (winMatch) {
        const ver = winMatch[1];
        const map: Record<string, string> = {
          "10.0": "10/11",
          "6.3": "8.1",
          "6.2": "8",
          "6.1": "7",
          "6.0": "Vista",
          "5.1": "XP",
        };
        osVersion = map[ver] || ver;
      }
    } else if (ua.includes("Mac")) {
      os = "macOS";
      const macMatch = ua.match(/Mac OS X (\d+[._]\d+)/);
      if (macMatch) osVersion = macMatch[1].replace("_", ".");
    } else if (ua.includes("Linux")) {
      os = "Linux";
    } else if (ua.includes("Android")) {
      os = "Android";
      const androidMatch = ua.match(/Android (\d+[\.\d]*)/);
      if (androidMatch) osVersion = androidMatch[1];
    }
  }

  return { cpuCores, ramGB, gpu, os, osVersion };
}

export interface ParsedRequirements {
  minRamGB: number | null;
  recRamGB: number | null;
  minCpuCores: number | null;
  osRequired: string | null;
}

const GB_PATTERN = /(\d+)\s*GB\s*RAM/i;
const CPU_PATTERN = /(?:Intel|AMD|Core|Phenom|Ryzen|FX|Pentium|Celeron|Athlon)[^,]*?(\d+)/i;

export function parseSystemRequirements(reqs: string): ParsedRequirements {
  const lower = reqs.toLowerCase();

  let minRamGB: number | null = null;
  let recRamGB: number | null = null;

  const sections = reqs.split(/Recommended:/i);
  const minSection = sections[0] || "";
  const recSection = sections[1] || "";

  const minRamMatch = minSection.match(GB_PATTERN);
  if (minRamMatch) minRamGB = parseInt(minRamMatch[1], 10);

  const recRamMatch = recSection.match(GB_PATTERN);
  if (recRamMatch) recRamGB = parseInt(recRamMatch[1], 10);

  let minCpuCores: number | null = null;
  const coreMatch = lower.match(/(\d+)\s*(?:cores?|threads?)/i);
  if (coreMatch) minCpuCores = parseInt(coreMatch[1], 10);

  let osRequired: string | null = null;
  const osMatch = reqs.match(/(Windows\s*\d+[\w\s\/]*(?:64-bit)?|macOS\s*[\d.+]+|Linux|Android\s*[\d.+]+)/i);
  if (osMatch) osRequired = osMatch[1].trim();

  return { minRamGB, recRamGB, minCpuCores, osRequired };
}

export interface SpecCheckResult {
  label: string;
  detected: string;
  required: string;
  met: boolean;
}

export function checkSpecs(detected: DetectedSpecs, parsed: ParsedRequirements): SpecCheckResult[] {
  const results: SpecCheckResult[] = [];

  if (detected.os) {
    let met = true;
    if (parsed.osRequired) {
      const reqLower = parsed.osRequired.toLowerCase();
      const osLower = detected.os.toLowerCase();
      if (reqLower.includes("windows") && osLower !== "windows") met = false;
      if (reqLower.includes("macos") && osLower !== "macos") met = false;
      if (reqLower.includes("android") && osLower !== "android") met = false;
    }
    results.push({
      label: "Operating System",
      detected: detected.osVersion ? `${detected.os} ${detected.osVersion}` : detected.os,
      required: parsed.osRequired || "Any",
      met,
    });
  }

  if (detected.ramGB !== null && parsed.minRamGB !== null) {
    results.push({
      label: "RAM",
      detected: `${detected.ramGB} GB`,
      required: `Min ${parsed.minRamGB} GB${parsed.recRamGB ? ` / Rec ${parsed.recRamGB} GB` : ""}`,
      met: detected.ramGB >= parsed.minRamGB,
    });
  }

  if (detected.cpuCores !== null) {
    const met = parsed.minCpuCores ? detected.cpuCores >= parsed.minCpuCores : true;
    results.push({
      label: "CPU Cores",
      detected: `${detected.cpuCores} cores`,
      required: parsed.minCpuCores ? `Min ${parsed.minCpuCores} cores` : "Any",
      met,
    });
  }

  if (detected.gpu) {
    results.push({
      label: "GPU",
      detected: detected.gpu.length > 40 ? detected.gpu.slice(0, 40) + "..." : detected.gpu,
      required: "See requirements",
      met: true,
    });
  }

  return results;
}

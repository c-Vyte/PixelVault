import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const path = join(__dirname, "../src/lib/data.ts");
let txt = readFileSync(path, "utf-8");
const before = (txt.match(/category:\s*"[^"]+"/g) || []).length;
console.log("Before categories:", before);
// Keep only pc-games, movies, korean entries; remove windows, mac, android, ebooks, tutorials
// We'll transform softwareData array by filtering after file load is hard to parse,
// so instead patch getSoftwareList to ignore app categories? Simpler: truncate softwareData directly via string replacement is fragile.
// Alternative: prepend a filter in file: add export const softwareData = original.filter(...)
// We'll just append a patch: replace the export line to filter.
if (!txt.includes("// PATCH: clear apps")) {
  txt = txt.replace(
    "export const softwareData: Software[] = [",
    "// PATCH: clear apps - keep only pc-games/movies/korean\nconst _rawSoftwareData: Software[] = ["
  );
  // after closing ]; add filter
  txt = txt.replace(
    "];\n\nexport function getSoftwareByCategory",
    "];\nexport const softwareData: Software[] = _rawSoftwareData.filter(s => [\"pc-games\",\"movies\",\"korean\"].includes(s.category));\n\nexport function getSoftwareByCategory"
  );
  writeFileSync(path, txt, "utf-8");
  console.log("Patched data.ts to filter apps");
} else {
  console.log("Already patched");
}

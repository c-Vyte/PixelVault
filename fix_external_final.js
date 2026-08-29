const fs = require('fs');

let content = fs.readFileSync('C:/fileshare/src/app/admin/external-data/page.tsx', 'utf8');

// Find the toSoftware function start
const fnStart = content.indexOf('function toSoftware(item: any, source: string): Software {');
if (fnStart === -1) {
  console.error('Function not found');
  process.exit(1);
}

// Find the closing brace of the function (matching braces)
let braceCount = 0;
let fnEnd = -1;
let inString = false;
let stringChar = '';
let inTemplate = false;

for (let i = content.indexOf('{', content.indexOf('function toSoftware')); i < content.length; i++) {
  const char = content[i];
  const nextChar = content[i + 1];
  
  if (!inString && !inTemplate) {
    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
    } else if (char === '`' && content[i + 1] !== '`') {
      inTemplate = true;
    } else if (char === '{') {
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0) {
        fnEnd = i;
        break;
      }
    }
  } else if (inString) {
    if (char === stringChar && content[i - 1] !== '\\') {
      inString = false;
    }
  } else if (inTemplate) {
    if (char === '`' && content[i - 1] !== '\\') {
      inTemplate = false;
    }
  }
}

if (fnEnd === -1) {
  console.error('Could not find function end');
  process.exit(1);
}

const beforeFn = content.substring(0, content.indexOf('function toSoftware'));
const fnBody = content.substring(content.indexOf('function toSoftware'), fnEnd + 1);
const afterFn = content.substring(fnEnd + 1);

// Now fix the function body
let fnFixed = fnBody;

// Fix 1: Fix FitGirl category detection
fnFixed = fnFixed.replace(
  /if \(\(item as any\)\.repackSize\) return "pc-games";/,
  'if ((item as any).repackSize) return "pc-games";\n  // FitGirl fallback: detect by downloads array structure (paste links + direct parts)\n  if (Array.isArray((item as any).downloads) && (item as any).downloads.some((d: any) => d.type !== "torrent")) return "pc-games";'
);

// Fix 2: Add part limit in FitGirl import
fnFixed = fnFixed.replace(
  /const first = directGroup\[0\];[\s\S]*?const hostName = cleanStr\(first\.hoster\) \|\| hostKey\.split\("\."\)\[0\];/,
  'const first = directGroup[0];\n        const hostName = cleanStr(first.hoster) || hostKey.split(".")[0];\n        // Limit parts to 20 to prevent storage issues\n  const limitedParts = directGroup.slice(0, 20);'
);

fnFixed = fnFixed.replace(
  /links\.push\(\{[\s\S]*?parts: directGroup\.length,/,
  'links.push({\n          name: hostName ? hostName.charAt(0).toUpperCase() + hostName.slice(1) : "Repack",\n          url: typeof first.url === "string" ? first.url : "",\n          type: "repack" as const,\n          parts: limitedParts.length,'
);

// Fix 2b: Add link limit
fnFixed = fnFixed.replace(
  /links\.sort\(\(a,b\) => score\(b\.url \|\| b\.name\) - score\(a\.url \|\| a\.name\)\);/,
  'links.sort((a,b) => score(b.url || b.name) - score(a.url || a.name));\n      // Limit total links per game to prevent storage issues\n      if (links.length > 15) links = links.slice(0, 15);'
);

// Reconstruct
const newContent = content.substring(0, content.indexOf('function toSoftware')) + fnFixed + content.substring(content.indexOf('function toSoftware') + fnBody.length);

fs.writeFileSync('C:/fileshare/src/app/admin/external-data/page.tsx', content, 'utf8');
console.log('Fixed external-data/page.tsx');
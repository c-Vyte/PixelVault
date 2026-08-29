const fs = require('fs');

let content = fs.readFileSync('C:/fileshare/src/app/admin/external-data/page.tsx', 'utf8');

// Fix 1: Fix FitGirl category detection - replace exact string
content = content.replace(
  'if ((item as any).repackSize) return "pc-games";',
  'if ((item as any).repackSize) return "pc-games";\n  // FitGirl fallback: detect by downloads array structure (paste links + direct parts)\n  if (Array.isArray((item as any).downloads) && (item as any).downloads.some((d: any) => d.type !== "torrent")) return "pc-games";'
);

// Fix 2: Add part limit in FitGirl import
content = content.replace(
  'const first = directGroup[0];\n        const hostName = cleanStr(first.hoster) || hostKey.split(".")[0];',
  'const first = directGroup[0];\n        const hostName = cleanStr(first.hoster) || hostKey.split(".")[0];\n        // Limit parts to 20 to prevent storage issues\n  const limitedParts = directGroup.slice(0, 20);'
);

content = content.replace(
  'parts: directGroup.length,',
  'parts: limitedParts.length,'
);

// Fix 2b: Add link limit
content = content.replace(
  'links.sort((a,b) => score(b.url || b.name) - score(a.url || a.name));',
  'links.sort((a,b) => score(b.url || b.name) - score(a.url || a.name));\n      // Limit total links per game to prevent storage issues\n      if (links.length > 15) links = links.slice(0, 15);'
);

fs.writeFileSync('C:/fileshare/src/app/admin/external-data/page.tsx', content, 'utf8');
console.log('Fixed external-data/page.tsx');
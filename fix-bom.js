const fs = require('fs');

let content = fs.readFileSync('C:/fileshare/src/lib/data.ts', 'utf8');

// Remove BOM if present
if (content.charCodeAt(0) === 0xFEFF) {
    content = content.slice(1);
}

// Fix the import line completely
content = content.replace(/^import \{ Software \} [^\n]*from[^\n]*"@\/lib\/indexedDB";/, 'import { Software } from "@/lib/indexedDB";');
content = content.replace(/^import \{ Software \} rom/, 'import { Software } from');
content = content.replace(/^import \{ Software \} fro/, 'import { Software } from');
content = content.replace(/^import \{ Software \} fr/, 'import { Software } from');

// Write without BOM
fs.writeFileSync('C:/fileshare/src/lib/data.ts', content, 'utf8');

// Verify
const check = fs.readFileSync('C:/fileshare/src/lib/data.ts', 'utf8');
console.log('BOM present:', check.charCodeAt(0) === 0xFEFF);
console.log('First 60 chars:', check.substring(0, 60));
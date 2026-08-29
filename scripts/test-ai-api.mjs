const res = await fetch("http://localhost:3000/api/ai/enrich", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ titles: ["Elden Ring", "Blender"] }),
});
console.log("status:", res.status);
const data = await res.json();
for (const r of data.results || []) {
  console.log(`--- ${r.title} (via ${r.provider})`);
  if (r.error) console.log("error:", r.error);
  else console.log(JSON.stringify(r.meta, null, 1).slice(0, 400));
}

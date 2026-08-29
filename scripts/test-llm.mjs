import { requireProviders, chat, chatJSON } from "./lib/llm.mjs";

requireProviders();

const r = await chat([{ role: "user", content: "Reply with exactly: OK" }]);
console.log("chat() via", r.provider, "->", r.text.trim());

const j = await chatJSON(
  'Game title: "Elden Ring". Generate metadata.',
  'Return ONLY JSON: {"description":"...","tags":["..."]}'
);
console.log("chatJSON() via", j.provider, "->", JSON.stringify(j.data).slice(0, 250));

"use client";

import { useEffect, useState } from "react";
import { defaultSiteContent, readSiteContent, saveSiteContent, type SiteContent } from "@/lib/siteContent";

const fieldClass = "w-full rounded-lg border border-blue-900/30 bg-[#0c1222] px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500";

const imageOptions = [
  { label: "Elden Ring", value: "/images/games/eldenring.jpg" },
  { label: "Red Dead Redemption 2", value: "/images/games/rdr2.jpg" },
  { label: "Cyberpunk 2077", value: "/images/games/cyberpunk.jpg" },
  { label: "Baldur's Gate 3", value: "/images/games/baldursgate3.jpg" },
  { label: "Palworld", value: "/images/games/palworld.jpg" },
  { label: "Hogwarts Legacy", value: "/images/games/hogwarts.jpg" },
];

export default function SiteDevPage() {
  const [content, setContent] = useState<SiteContent>(defaultSiteContent);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setContent(readSiteContent());
  }, []);

  const update = <Section extends keyof SiteContent>(section: Section, field: keyof SiteContent[Section], value: string) => {
    setContent((current) => ({
      ...current,
      [section]: typeof current[section] === "object"
        ? { ...(current[section] as object), [field]: value }
        : value,
    }));
  };

  const handleSave = () => {
    saveSiteContent(content);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const reset = () => setContent(defaultSiteContent);

  return (
    <div className="max-w-5xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-300/60">Visual content editor</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Site Dev</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">Edit visible site content using forms. This page does not edit source code or application logic.</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={reset} className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800">Reset</button>
          <button type="button" onClick={handleSave} className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700">{saved ? "Saved" : "Save changes"}</button>
        </div>
      </div>

      <div className="space-y-6">
        <section className="rounded-xl border border-blue-900/30 bg-[#111827] p-6">
          <h2 className="text-lg font-semibold text-white">Site identity</h2>
          <p className="mt-1 text-sm text-gray-500">Names and descriptions used across the site.</p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="block text-sm text-blue-300/70">Site name<input value={content.siteName} onChange={(event) => setContent({ ...content, siteName: event.target.value })} className={`${fieldClass} mt-2`} /></label>
            <label className="block text-sm text-blue-300/70">Admin email<input type="email" value={content.adminEmail} onChange={(event) => setContent({ ...content, adminEmail: event.target.value })} className={`${fieldClass} mt-2`} /></label>
            <label className="block text-sm text-blue-300/70 md:col-span-2">Site description<textarea value={content.siteDescription} onChange={(event) => setContent({ ...content, siteDescription: event.target.value })} rows={3} className={`${fieldClass} mt-2 resize-y`} /></label>
          </div>
        </section>

        <section className="rounded-xl border border-blue-900/30 bg-[#111827] p-6">
          <h2 className="text-lg font-semibold text-white">Visual design</h2>
          <p className="mt-1 text-sm text-gray-500">Redesign the visible site style with safe controls. No CSS or source code is required.</p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="block text-sm text-blue-300/70">Hero image<select value={content.design.heroImage} onChange={(event) => update("design", "heroImage", event.target.value)} className={`${fieldClass} mt-2`}>{imageOptions.map((image) => <option key={image.value} value={image.value}>{image.label}</option>)}</select></label>
            <label className="block text-sm text-blue-300/70">Hero card image<select value={content.design.secondaryImageOne} onChange={(event) => update("design", "secondaryImageOne", event.target.value)} className={`${fieldClass} mt-2`}>{imageOptions.map((image) => <option key={image.value} value={image.value}>{image.label}</option>)}</select></label>
            <label className="block text-sm text-blue-300/70">Second card image<select value={content.design.secondaryImageTwo} onChange={(event) => update("design", "secondaryImageTwo", event.target.value)} className={`${fieldClass} mt-2`}>{imageOptions.map((image) => <option key={image.value} value={image.value}>{image.label}</option>)}</select></label>
            <label className="block text-sm text-blue-300/70">Font style<select value={content.design.font} onChange={(event) => update("design", "font", event.target.value)} className={`${fieldClass} mt-2`}><option value="geist">Geist Sans</option><option value="mono">Technical Mono</option><option value="system">System Sans</option></select></label>
            <label className="block text-sm text-blue-300/70">Layout density<select value={content.design.density} onChange={(event) => update("design", "density", event.target.value)} className={`${fieldClass} mt-2`}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="airy">Airy</option></select></label>
            <label className="block text-sm text-blue-300/70">Corner style<select value={content.design.radius} onChange={(event) => update("design", "radius", event.target.value)} className={`${fieldClass} mt-2`}><option value="sharp">Sharp</option><option value="soft">Soft</option><option value="round">Round</option></select></label>
            <label className="flex items-center gap-3 text-sm text-blue-300/70">Accent color<input type="color" value={content.design.accentColor} onChange={(event) => update("design", "accentColor", event.target.value)} className="h-10 w-16 cursor-pointer rounded border border-gray-700 bg-transparent" /></label>
            <label className="flex items-center gap-3 text-sm text-blue-300/70">Surface color<input type="color" value={content.design.surfaceColor} onChange={(event) => update("design", "surfaceColor", event.target.value)} className="h-10 w-16 cursor-pointer rounded border border-gray-700 bg-transparent" /></label>
            <div className="flex flex-wrap gap-5 md:col-span-2">
              <label className="flex items-center gap-3 text-sm text-gray-300"><input type="checkbox" checked={content.design.showHero} onChange={(event) => setContent({ ...content, design: { ...content.design, showHero: event.target.checked } })} className="h-4 w-4 accent-blue-500" />Show hero</label>
              <label className="flex items-center gap-3 text-sm text-gray-300"><input type="checkbox" checked={content.design.showFeatures} onChange={(event) => setContent({ ...content, design: { ...content.design, showFeatures: event.target.checked } })} className="h-4 w-4 accent-blue-500" />Show feature section</label>
              <label className="flex items-center gap-3 text-sm text-gray-300"><input type="checkbox" checked={content.design.showLatest} onChange={(event) => setContent({ ...content, design: { ...content.design, showLatest: event.target.checked } })} className="h-4 w-4 accent-blue-500" />Show latest additions</label>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-blue-900/30 bg-[#111827] p-6">
          <h2 className="text-lg font-semibold text-white">Header and navigation</h2>
          <p className="mt-1 text-sm text-gray-500">Change the words visitors see in the main navigation and search controls.</p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {(["games", "software", "ebooks", "pcCheck", "faq", "contact", "searchPlaceholder", "pcCheckCta"] as const).map((field) => (
              <label key={field} className="block text-sm text-blue-300/70">{field === "pcCheck" ? "PC check label" : field === "pcCheckCta" ? "PC check button" : field === "searchPlaceholder" ? "Search placeholder" : `${field} label`}
                <input value={content.navigation[field]} onChange={(event) => update("navigation", field, event.target.value)} className={`${fieldClass} mt-2`} />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-blue-900/30 bg-[#111827] p-6">
          <h2 className="text-lg font-semibold text-white">Footer content</h2>
          <p className="mt-1 text-sm text-gray-500">Edit footer headings, link labels, and the site status text.</p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {(["categoriesTitle", "supportTitle", "legalTitle", "contactLabel", "requestLabel", "faqLabel", "termsLabel", "privacyLabel", "dmcaLabel", "onlineLabel"] as const).map((field) => (
              <label key={field} className="block text-sm text-blue-300/70">{field.replace(/([A-Z])/g, " $1").trim()}
                <input value={content.footer[field]} onChange={(event) => update("footer", field, event.target.value)} className={`${fieldClass} mt-2`} />
              </label>
            ))}
            <label className="block text-sm text-blue-300/70 md:col-span-2">Footer description<textarea value={content.footer.description} onChange={(event) => update("footer", "description", event.target.value)} rows={3} className={`${fieldClass} mt-2 resize-y`} /></label>
          </div>
        </section>

        <section className="rounded-xl border border-blue-900/30 bg-[#111827] p-6">
          <h2 className="text-lg font-semibold text-white">Homepage hero</h2>
          <p className="mt-1 text-sm text-gray-500">Change the hero wording and button labels without touching the component.</p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="block text-sm text-blue-300/70">Eyebrow<input value={content.hero.eyebrow} onChange={(event) => update("hero", "eyebrow", event.target.value)} className={`${fieldClass} mt-2`} /></label>
            <label className="block text-sm text-blue-300/70">Main title<input value={content.hero.title} onChange={(event) => update("hero", "title", event.target.value)} className={`${fieldClass} mt-2`} /></label>
            <label className="block text-sm text-blue-300/70">Highlighted title<input value={content.hero.highlightedTitle} onChange={(event) => update("hero", "highlightedTitle", event.target.value)} className={`${fieldClass} mt-2`} /></label>
            <label className="block text-sm text-blue-300/70">Featured game ID<input value={content.hero.featuredGameId} onChange={(event) => update("hero", "featuredGameId", event.target.value)} className={`${fieldClass} mt-2`} placeholder="elden-ring" /></label>
            <label className="block text-sm text-blue-300/70 md:col-span-2">Hero description<textarea value={content.hero.description} onChange={(event) => update("hero", "description", event.target.value)} rows={4} className={`${fieldClass} mt-2 resize-y`} /></label>
            <label className="block text-sm text-blue-300/70">Primary button label<input value={content.hero.primaryLabel} onChange={(event) => update("hero", "primaryLabel", event.target.value)} className={`${fieldClass} mt-2`} /></label>
            <label className="block text-sm text-blue-300/70">Secondary button label<input value={content.hero.secondaryLabel} onChange={(event) => update("hero", "secondaryLabel", event.target.value)} className={`${fieldClass} mt-2`} /></label>
          </div>
        </section>

        <section className="rounded-xl border border-blue-900/30 bg-[#111827] p-6">
          <h2 className="text-lg font-semibold text-white">WhatsApp contact</h2>
          <p className="mt-1 text-sm text-gray-500">The contact page uses these values to create the WhatsApp link and QR code.</p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="block text-sm text-blue-300/70">WhatsApp number<input value={content.contact.whatsappNumber} onChange={(event) => update("contact", "whatsappNumber", event.target.value)} className={`${fieldClass} mt-2`} /></label>
            <label className="block text-sm text-blue-300/70">Card label<input value={content.contact.whatsappLabel} onChange={(event) => update("contact", "whatsappLabel", event.target.value)} className={`${fieldClass} mt-2`} /></label>
            <label className="block text-sm text-blue-300/70 md:col-span-2">Prefilled message<textarea value={content.contact.whatsappMessage} onChange={(event) => update("contact", "whatsappMessage", event.target.value)} rows={3} className={`${fieldClass} mt-2 resize-y`} /></label>
          </div>
        </section>
      </div>
    </div>
  );
}

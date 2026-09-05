"use client";

import { useEffect, useState } from "react";
import { Software, incrementDownloads } from "@/lib/data";
import RecommendedSoftware from "@/components/RecommendedSoftware";
import ScreenshotGallery from "@/components/ScreenshotGallery";
import { addWorkflowRecord, addDeadLinkReport, isValidEmail, type SoftwareReview } from "@/lib/workflowStore";
import SystemSpecsChecker from "@/components/SystemSpecsChecker";
import { SITE_URL } from "@/lib/siteConfig";
import NeedHelpPanel from "@/components/NeedHelpPanel";

interface SoftwareContentProps {
  software: Software;
}

function formatDownloads(num: number): string {
  return num.toLocaleString();
}

function getYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("?")[0] || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const parts = u.pathname.split("/");
    const embedIdx = parts.indexOf("embed");
    if (embedIdx !== -1) return parts[embedIdx + 1] || null;
    const vIdx = parts.indexOf("v");
    if (vIdx !== -1) return parts[vIdx + 1] || null;
  } catch {}
  return null;
}

export default function SoftwareContent({ software }: SoftwareContentProps) {
  const [expandedRepack, setExpandedRepack] = useState<number | null>(null);
  const [reviewForm, setReviewForm] = useState({ user: "", email: "", comment: "" });
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [fdmModalOpen, setFdmModalOpen] = useState(false);
  const [fdmMagnetUrl, setFdmMagnetUrl] = useState("");
  const [fdmUrl, setFdmUrl] = useState("https://www.freedownloadmanager.org/");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState({ name: "", message: "" });
  const [reportMessage, setReportMessage] = useState("");
  const [reportError, setReportError] = useState("");
  const [downloadCount, setDownloadCount] = useState(software.downloads);
  const [ublockModal, setUblockModal] = useState<{ url: string } | null>(null);
  const [ublockDontShow, setUblockDontShow] = useState(false);

  const handleLinkDownload = async (url: string) => {
    const count = await incrementDownloads(software.id);
    setDownloadCount(count);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const requestDownload = (url: string) => {
    try {
      if (localStorage.getItem("ublockPromptDismissed") === "true") {
        handleLinkDownload(url);
        return;
      }
    } catch {}
    setUblockDontShow(false);
    setUblockModal({ url });
  };

  const handleUblockSkip = () => {
    if (!ublockModal) return;
    const url = ublockModal.url;
    try {
      if (ublockDontShow) localStorage.setItem("ublockPromptDismissed", "true");
    } catch {}
    setUblockModal(null);
    handleLinkDownload(url);
  };

  const handleUblockInstall = () => {
    try {
      if (ublockDontShow) localStorage.setItem("ublockPromptDismissed", "true");
    } catch {}
    window.open("https://ublockorigin.com/", "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    const stored = localStorage.getItem("siteSettings");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.fdmAffiliateUrl) setFdmUrl(parsed.fdmAffiliateUrl);
      } catch {}
    }
  }, []);

  const handleTorrentClick = (url: string) => {
    setFdmMagnetUrl(url);
    setFdmModalOpen(true);
  };

  const submitReport = (event: React.FormEvent) => {
    event.preventDefault();
    setReportMessage("");
    setReportError("");
    if (!reportForm.name.trim()) {
      setReportError("Please enter your name.");
      return;
    }
    const record = addDeadLinkReport({
      softwareId: software.id,
      softwareTitle: software.title,
      url: software.downloadLinks.find((l) => l.type === "torrent")?.url || software.downloadLinks[0]?.url || "",
      reportedBy: reportForm.name.trim(),
      message: reportForm.message.trim(),
    });
    if (!record) {
      setReportError("Report limit reached for this link or it failed to save.");
      return;
    }
    setReportMessage("Report submitted. Thank you!");
    setReportForm({ name: "", message: "" });
    setReportOpen(false);
  };

  useEffect(() => {
    const stored = localStorage.getItem("recentlyViewed");
    let recent: string[] = [];
    if (stored) {
      try {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          recent = parsed.filter((id): id is string => typeof id === "string");
        }
      } catch {
        localStorage.removeItem("recentlyViewed");
      }
    }
    const updated = [software.id, ...recent.filter((id) => id !== software.id)].slice(0, 10);
    localStorage.setItem("recentlyViewed", JSON.stringify(updated));
  }, [software.id]);

    const submitReview = (event: React.FormEvent) => {
    event.preventDefault();
    setReviewMessage("");
    setReviewError("");
    if (!reviewForm.user.trim() || !reviewForm.comment.trim()) {
      setReviewError("Please enter your name and a comment.");
      return;
    }
    if (reviewForm.email && !isValidEmail(reviewForm.email)) {
      setReviewError("Please enter a valid email address.");
      return;
    }

    setReviewSubmitting(true);
    const record = addWorkflowRecord<SoftwareReview>("softwareReviews", {
      softwareId: software.id,
      softwareTitle: software.title,
      user: reviewForm.user.trim(),
      email: reviewForm.email.trim(),
      comment: reviewForm.comment.trim(),
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    setReviewSubmitting(false);
    if (!record) {
      setReviewError("We could not save your comment. Please try again.");
      return;
    }
    setReviewMessage("Thanks. Your comment is pending moderation.");
    // Move focus to success message for screen readers
    setTimeout(() => {
      const successMessage = document.querySelector<HTMLElement>('[role="status"]');
      if (successMessage) {
        successMessage.focus();
      }
    }, 100);
    setReviewForm({ user: "", email: "", comment: "" });
  };

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <section
          className="relative isolate min-h-[560px] overflow-hidden rounded-[2rem] border border-white/10 bg-[#101619] shadow-2xl shadow-black/40"
          style={{ backgroundImage: `url(${software.poster})`, backgroundPosition: "center", backgroundSize: "cover" }}
        >
          <div className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl" style={{ backgroundImage: `url(${software.poster})` }} />
          <div className="absolute inset-0 bg-gradient-to-r from-[#071014]/80 via-[#071014]/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071014]/60 via-transparent to-transparent" />

          <div className="relative z-10 flex min-h-[560px] flex-col justify-between p-6 sm:p-9 lg:p-10">
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/60">Featured release</span>
              <span className="rounded-full border border-white/15 bg-black/20 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/60 backdrop-blur-md">
                {software.category}
              </span>
            </div>

            <div className="max-w-3xl pb-3 pt-20 sm:pt-28">
              <div className="mb-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                <span className="h-px w-8 bg-amber-400" />
                {software.subcategory}
              </div>
              <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight text-white drop-shadow-2xl sm:text-7xl lg:text-8xl">{software.title}</h1>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/70">
                <span className="text-amber-300">Rating {software.rating}</span>
                <span>{software.platform}</span><span>v{software.version}</span><span>{software.size}</span><span>{formatDownloads(downloadCount)} downloads</span>
              </div>
              <p className="mt-8 max-w-2xl text-base leading-7 text-white/80 sm:text-lg">{software.description}</p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a href="#download" className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-6 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#101619] transition hover:bg-amber-300">
                  Download now
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-6-6 6 6-6 6" /></svg>
                </a>
                <a href="#screenshots" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white/80 backdrop-blur-md transition hover:border-white/40 hover:bg-white/10">View scenes</a>
              </div>
            </div>

            <div className="flex items-end justify-between gap-5 border-t border-white/10 pt-5">
              <div className="flex items-center gap-3 text-white/55">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-sm">{software.title.charAt(0)}</span>
                <span className="text-[10px] uppercase tracking-[0.2em]">Available on {software.platform}</span>
              </div>
              <div className="hidden items-end gap-2 sm:flex">
                {(software.screenshots.length ? software.screenshots : [software.poster]).slice(0, 3).map((image, index) => (
                  <img key={`${image}-${index}`} src={image} alt={`${software.title} scene ${index + 1}`} className={`h-16 w-24 rounded-lg border object-cover shadow-lg ${index === 0 ? "border-amber-400" : "border-white/15"}`} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {software.videoUrl && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-5 bg-amber-500" />
              <h2 className="text-lg font-bold text-white">Gameplay Video</h2>
            </div>
            <div className="relative rounded-2xl overflow-hidden border border-gray-700 bg-gray-900" style={{ paddingBottom: "56.25%" }}>
              <iframe
                src={`https://www.youtube.com/embed/${getYoutubeId(software.videoUrl)}`}
                title={`${software.title} gameplay`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>
          </div>
        )}

        {software.screenshots && software.screenshots.length > 0 && (
          <div id="screenshots"><ScreenshotGallery screenshots={software.screenshots} title={software.title} /></div>
        )}

        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">Features</h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {software.features.map((feature, i) => (
              <li key={i} className="flex items-center gap-2 text-gray-300">
                <svg
                  className="w-5 h-5 text-green-500 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <SystemSpecsChecker systemRequirements={software.systemRequirements} />

        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">System Requirements</h2>
          <p className="text-gray-300 whitespace-pre-wrap">{software.systemRequirements}</p>
        </div>

        {/* SteamRIP-style Download Hosters - grouped by file hoster */}
        <div id="download" className="bg-[#150a2e] rounded-2xl border border-purple-900/40 p-6 mb-6">
          <h3 className="text-red-500 font-black text-center mb-6 tracking-widest text-sm">FAREWELL PLAZA ♥</h3>
          <div className="space-y-6">
            {(() => {
              const urlKey = (u: string) => (u || "").trim().toLowerCase().replace(/\/+$/, "");
              const dedupedLinks = (links: typeof software.downloadLinks) => {
                const seen = new Set<string>();
                return links.filter((l) => {
                  const k = urlKey(l.url);
                  if (!k || seen.has(k)) return false;
                  seen.add(k);
                  return true;
                });
              };
              const directGroups: Record<string, typeof software.downloadLinks> = {};
              const torrentLinks = dedupedLinks(software.downloadLinks.filter((l) => l.type === "torrent"));
              const directLinks = dedupedLinks(software.downloadLinks.filter((l) => l.type !== "torrent"));

              if (software.downloadsByHoster && Object.keys(software.downloadsByHoster).length > 0) {
                for (const [host, links] of Object.entries(software.downloadsByHoster)) {
                  directGroups[host] = Array.isArray(links) ? dedupedLinks(links as any) : [];
                }
              } else {
                for (const link of directLinks) {
                  const host = (link as any).hoster || link.name || "Download";
                  const key = host.replace(/^Filehoster:\s*/i, "").trim() || "Download";
                  if (!directGroups[key]) directGroups[key] = [];
                  directGroups[key].push(link);
                }
              }

              const hostOrder = ["Datanodes", "FuckingFast", "PixelDrain", "FileKeeper", "FilesKeep", "Gofile", "KrakenFiles", "1Fichier", "MediaFire", "Mega"];
              const sortedHosts = Object.keys(directGroups).sort((a, b) => {
                const norm = (h: string) => h.replace(/^Filehoster:\s*/i, "").trim().toLowerCase().replace(/\s+/g, "");
                const ia = hostOrder.findIndex((h) => norm(h) === norm(a));
                const ib = hostOrder.findIndex((h) => norm(h) === norm(b));
                if (ia !== -1 || ib !== -1) return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
                return a.localeCompare(b);
              });

              if (sortedHosts.length === 0 && torrentLinks.length === 0) {
                return <p className="text-center text-gray-500 text-sm">No download links available</p>;
              }

              return (
                <>
                  {sortedHosts.map((host) => {
                    const links = directGroups[host];
                    const repack: any = links.length === 1 && (links[0] as any).type === "repack" && Array.isArray((links[0] as any).partLinks) ? (links[0] as any) : null;
                    const repackPartLinks = repack
                      ? (repack.partLinks as { part: number; url: string }[]).filter((p, i, arr) => {
                          const k = urlKey(p.url);
                          if (!k) return false;
                          return arr.findIndex((q) => q.part === p.part || (urlKey(q.url) === k)) === i;
                        })
                      : [];
                    const isMultiPart = repack ? true : (links.length > 1 || !!(links[0] as any)?.partTotal);
                    const hostLabel = host.toUpperCase();
                    const hostColor =
                      /DATANODES|PIXELDRAIN|MEDIAFIRE/i.test(hostLabel) ? "text-white" :
                      /FUCKINGFAST|GOFILE|MEGA|FILESKEEP/i.test(hostLabel) ? "text-amber-400" :
                      /1FICHIER|FILEKEEPER/i.test(hostLabel) ? "text-red-400" : "text-purple-400";

                    // Sort parts numerically
                    const sorted = repack ? [] : [...links].sort((a: any, b: any) => (a.part || 0) - (b.part || 0));

                    return (
                      <div key={host} className="flex flex-col items-center">
                        <span className={`text-xs font-black tracking-wider mb-2 ${hostColor}`}>{hostLabel}{isMultiPart ? ` • ${repack ? repackPartLinks.length : links.length} parts` : ""}</span>
                        {!isMultiPart ? (
                          <button
                            onClick={() => requestDownload(sorted[0].url)}
                            className="px-8 py-2.5 rounded-md bg-[#1e0f3a] border border-purple-700/50 text-white text-xs font-bold tracking-wider hover:bg-purple-800/30 transition-colors shadow-[0_0_12px_rgba(168,85,247,0.35)]"
                          >
                            DOWNLOAD HERE
                          </button>
                        ) : repack ? (
                          <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                            {repackPartLinks.map((p: any) => (
                              <a
                                key={`repack-${host}-${p.part}`}
                                href={p.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => { e.preventDefault(); requestDownload(p.url); }}
                                className="px-4 py-2 rounded-md bg-[#1e0f3a] border border-purple-700/50 text-white text-xs font-bold hover:bg-purple-800/30 transition-colors shadow-[0_0_8px_rgba(168,85,247,0.25)] min-w-[84px] text-center"
                              >
                                Part {p.part}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                            {(sorted as any[]).filter((l, i) => sorted.findIndex((o: any) => o.part === l.part) === i).map((link: any, idx: number) => {
                              const partNum = link.part || idx + 1;
                              return (
                                <a
                                  key={`${host}-${partNum}`}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => { e.preventDefault(); requestDownload(link.url); }}
                                  className="px-4 py-2 rounded-md bg-[#1e0f3a] border border-purple-700/50 text-white text-xs font-bold hover:bg-purple-800/30 transition-colors shadow-[0_0_8px_rgba(168,85,247,0.25)] min-w-[84px] text-center"
                                >
                                  Part {partNum}
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {torrentLinks.length > 0 && (
                    <div className="pt-4 border-t border-purple-900/30">
                      <h4 className="text-center text-gray-400 text-xs font-bold tracking-wider mb-3">TORRENTS</h4>
                      <div className="flex flex-wrap justify-center gap-2">
                        {torrentLinks.map((link, i) => (
                          <button
                            key={`torrent-${i}`}
                            onClick={() => handleTorrentClick(link.url)}
                            className="px-4 py-2 rounded-md bg-[#1a1a1a] border border-gray-700 text-gray-300 text-xs font-bold hover:bg-gray-800 transition-colors"
                          >
                            {(link as any).hoster || link.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          {software.password && (
            <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 max-w-xl mx-auto">
              <p className="text-center text-amber-300 text-xs font-bold mb-2">Extraction Password</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-black/30 border border-amber-500/20 px-3 py-2 text-sm font-mono text-amber-100 select-all break-all text-center">{software.password}</code>
                <button onClick={() => navigator.clipboard.writeText(software.password || "")} className="shrink-0 rounded-lg bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500/30 text-amber-300 px-3 py-2 text-xs font-bold">Copy</button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 mb-6">
           <h2 className="text-xl font-bold text-white mb-4">Comments & Suggestions</h2>
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-xl p-4">
               <div className="flex items-center gap-2 mb-2">
                 <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                   J
                 </div>
                 <span className="text-white font-medium">John D.</span>
                 <span className="text-gray-400 text-sm">Submitted today</span>
               </div>
               <p className="text-gray-400 text-sm">
                 Great software! Works perfectly and the download was fast.
               </p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4">
               <div className="flex items-center gap-2 mb-2">
                 <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                   S
                 </div>
                 <span className="text-white font-medium">Sarah M.</span>
                 <span className="text-gray-400 text-sm">Submitted yesterday</span>
               </div>
               <p className="text-gray-400 text-sm">
                 Good software overall. Had some minor issues but nothing major.
               </p>
            </div>
            <div className="mt-4 text-center">
              <details className="text-left">
                 <summary className="cursor-pointer list-none bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg text-sm text-center transition-colors">Add a Comment</summary>
                <form onSubmit={submitReview} className="mt-4 space-y-3 rounded-xl border border-gray-700 bg-gray-900/60 p-4">
                  {reviewMessage && <p role="status" className="text-sm text-green-400">{reviewMessage}</p>}
                  {reviewError && <p role="alert" className="text-sm text-red-300">{reviewError}</p>}
                   <div className="grid gap-3 sm:grid-cols-2">
                     <input aria-label="Your name" value={reviewForm.user} onChange={(event) => setReviewForm({ ...reviewForm, user: event.target.value })} placeholder="Your name" required className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white" />
                     <input aria-label="Your email" type="email" value={reviewForm.email} onChange={(event) => setReviewForm({ ...reviewForm, email: event.target.value })} placeholder="Email (optional)" className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white" />
                   </div>
                   <textarea aria-label="Comment" value={reviewForm.comment} onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })} placeholder="Share your experience, ask questions, or suggest improvements" required rows={3} className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white" />
                  <button type="submit" disabled={reviewSubmitting} className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-500 disabled:opacity-60">{reviewSubmitting ? "Submitting..." : "Add Comment"}</button>
                </form>
              </details>
            </div>
          </div>
        </div>

        <RecommendedSoftware
          currentId={software.id}
          category={software.category}
          subcategory={software.subcategory}
        />
      </div>

      <div className="lg:col-span-1">
        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 mb-6 sticky top-24">
          {/* Report Dead Link */}
          <div className="mt-4 border-t border-gray-700 pt-4">
            {!reportOpen ? (
              <button
                onClick={() => setReportOpen(true)}
                className="flex items-center gap-2 text-gray-400 hover:text-red-400 text-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Report a broken link
              </button>
            ) : (
              <form onSubmit={submitReport} className="space-y-3 rounded-xl border border-gray-700 bg-gray-900/60 p-4">
                {reportMessage && <p role="status" className="text-sm text-green-400">{reportMessage}</p>}
                {reportError && <p role="alert" className="text-sm text-red-300">{reportError}</p>}
                <input
                  value={reportForm.name}
                  onChange={(e) => setReportForm({ ...reportForm, name: e.target.value })}
                  placeholder="Your name"
                  required
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                />
                <textarea
                  value={reportForm.message}
                  onChange={(e) => setReportForm({ ...reportForm, message: e.target.value })}
                  placeholder="Which link is broken? (optional)"
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-500">
                    Submit Report
                  </button>
                  <button type="button" onClick={() => setReportOpen(false)} className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 transition hover:bg-gray-700">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">Info</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Version</span>
              <span className="text-white">{software.version}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Size</span>
              <span className="text-white">{software.size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Platform</span>
              <span className="text-white capitalize">{software.platform}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Category</span>
              <span className="text-white capitalize">{software.category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Added</span>
              <span className="text-white">{software.createdAt}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-2xl border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Share</h3>
          <div className="flex gap-2">
            <button
              onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out ${software.title} on PixelVault`)}&url=${encodeURIComponent(`${SITE_URL}/software/${software.id}`)}`, "_blank", "width=600,height=400")}
              className="flex-1 bg-blue-600/20 text-blue-400 py-2 rounded-lg text-sm hover:bg-blue-600/30 transition-colors"
            >
              Twitter
            </button>
            <button
              onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${SITE_URL}/software/${software.id}`)}`, "_blank", "width=600,height=400")}
              className="flex-1 bg-blue-800/20 text-blue-300 py-2 rounded-lg text-sm hover:bg-blue-800/30 transition-colors"
            >
              Facebook
            </button>
            <button
              onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Check out ${software.title} on PixelVault: ${SITE_URL}/software/${software.id}`)}`, "_blank")}
              className="flex-1 bg-green-600/20 text-green-400 py-2 rounded-lg text-sm hover:bg-green-600/30 transition-colors"
            >
              WhatsApp
            </button>
          </div>
        </div>
      </div>

      {/* FDM Prompt Modal */}
      {fdmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setFdmModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-600/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Faster Torrent Downloads</h3>
                <p className="text-gray-400 text-xs">Recommended download manager</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 mb-6">
              Install <span className="text-white font-medium">Free Download Manager</span> for faster,
              resumable torrent downloads. It&apos;s free and handles large files reliably.
            </p>
            <div className="flex gap-3">
              <a
                href={fdmUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg text-sm font-bold text-center transition-colors"
              >
                Get FDM — Free
              </a>
              <button
                onClick={() => setFdmModalOpen(false)}
                className="flex-1 border border-gray-600 hover:bg-gray-700 text-gray-300 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                No thanks
              </button>
            </div>
            <button
              onClick={() => { setFdmModalOpen(false); handleLinkDownload(fdmMagnetUrl); }}
              className="mt-3 w-full text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Open magnet link directly
            </button>
          </div>
        </div>
      )}

      {/* uBlock Origin suggestion — shown before every direct download (optional, Skip proceeds) */}
      {ublockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setUblockModal(null)} />
          <div className="relative w-full max-w-md rounded-2xl border border-amber-500/20 bg-[#1a102e] p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.92-.552 3.71-1.506 5.23l-.054.09m-3.44-2.04A13.916 13.916 0 0112 11a4 4 0 10-4 4c0 1.92.552 3.71 1.506 5.23z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-black text-white tracking-wide">Recommended: uBlock Origin</h3>
                <p className="text-amber-300/70 text-xs">Blocks popups & ads on file hosts</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 mb-4 leading-relaxed">
              File hosts like Datanodes, FileKeeper and Gofile show popups and redirects. <span className="text-white font-medium">uBlock Origin</span> (free, open-source) blocks them and makes downloads faster. This is <span className="text-amber-300">optional</span> — you can skip and download right away.
            </p>
            <label className="flex items-center gap-2 mb-5 cursor-pointer select-none">
              <input type="checkbox" checked={ublockDontShow} onChange={(e) => setUblockDontShow(e.target.checked)} className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500" />
              <span className="text-xs text-gray-400">Don&apos;t show again</span>
            </label>
            <div className="flex gap-3">
              <button
                onClick={handleUblockSkip}
                className="flex-1 bg-[#2a1b4a] hover:bg-[#3a2570] border border-purple-700/40 text-white py-2.5 rounded-lg text-sm font-bold transition-colors"
              >
                Skip & Download
              </button>
              <button
                onClick={handleUblockInstall}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 py-2.5 rounded-lg text-sm font-black transition-colors"
              >
                Get uBlock Origin
              </button>
            </div>
            <p className="text-[11px] text-gray-500 text-center mt-3">Opens ublockorigin.com in a new tab — then click Download again or use Skip.</p>
          </div>
        </div>
      )}
    </div>
  );
}

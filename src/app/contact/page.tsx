"use client";

import { useEffect, useState } from "react";
import { addWorkflowRecord, isValidEmail, type ContactMessage } from "@/lib/workflowStore";
import { defaultSiteContent, readSiteContent, type SiteContent } from "@/lib/siteContent";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState<SiteContent>(defaultSiteContent);

  useEffect(() => {
    const loadContent = () => setContent(readSiteContent());
    loadContent();
    window.addEventListener("site-content-changed", loadContent);
    return () => window.removeEventListener("site-content-changed", loadContent);
  }, []);

  const whatsappNumber = content.contact.whatsappNumber.replace(/\D/g, "");
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(content.contact.whatsappMessage)}`;
  const whatsappQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(whatsappUrl)}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitted(false);
    if (!isValidEmail(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    const record = addWorkflowRecord<ContactMessage>("contactMessages", {
      ...form,
      status: "unread",
      createdAt: new Date().toISOString(),
    });
    setSubmitting(false);
    if (!record) {
      setError("We could not send your message. Please try again.");
      return;
    }
    setSubmitted(true);
    setForm({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Contact Us</h1>
          <p className="text-gray-400">Have a question or feedback? We&apos;d love to hear from you.</p>
        </div>

        {submitted && (
          <div className="bg-green-600/20 border border-green-600/30 rounded-xl p-4 mb-6 text-center">
            <p className="text-green-400 font-medium">Message sent successfully! We&apos;ll get back to you soon.</p>
          </div>
        )}
        {error && (
          <div role="alert" className="bg-red-600/20 border border-red-600/30 rounded-xl p-4 mb-6 text-center">
            <p className="text-red-300 font-medium">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-gray-800 rounded-xl border border-gray-700 p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="w-full bg-gray-900 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700 text-sm"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="w-full bg-gray-900 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700 text-sm"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-gray-400 text-sm mb-2">Subject</label>
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              required
              className="w-full bg-gray-900 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700 text-sm"
              placeholder="How can we help?"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-400 text-sm mb-2">Message</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              required
              rows={5}
              className="w-full bg-gray-900 text-white rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-700 text-sm resize-none"
              placeholder="Tell us more..."
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors"
          >
            {submitting ? "Sending..." : "Send Message"}
          </button>
        </form>

        <section className="mt-8 overflow-hidden rounded-xl border border-green-500/20 bg-green-500/5 p-6 sm:flex sm:items-center sm:gap-8">
          <div className="mx-auto w-fit shrink-0 rounded-xl bg-white p-3 shadow-lg shadow-green-950/20 sm:mx-0">
            <img
              src={whatsappQrUrl}
              alt="Scan to open a WhatsApp chat with PixelVault"
              width={220}
              height={220}
              className="h-44 w-44 sm:h-52 sm:w-52"
            />
          </div>
          <div className="mt-6 text-center sm:mt-0 sm:text-left">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-green-400">{content.contact.whatsappLabel}</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Message us directly</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-400">
              Scan the QR code with your phone camera. WhatsApp will open with a software-request message ready to send.
            </p>
            <p className="mt-3 font-mono text-sm text-green-300">{content.contact.whatsappNumber}</p>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex rounded-lg bg-green-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-green-500"
            >
              Open WhatsApp
            </a>
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12">
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
            </div>
            <h3 className="text-white font-medium mb-1">Email</h3>
            <p className="text-gray-400 text-sm">c.vyte404@gmail.com</p>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <h3 className="text-white font-medium mb-1">Live Chat</h3>
            <p className="text-gray-400 text-sm">Available 9am - 5pm</p>
          </div>
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2m0 0a2 2 0 012 2v8a2 2 0 01-2 2m0-12h4m-4 0H3m4 12h4m4-12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-white font-medium mb-1">Twitter</h3>
            <p className="text-gray-400 text-sm">@explore404</p>
          </div>
        </div>
      </div>
    </div>
  );
}

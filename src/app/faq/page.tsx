"use client";

import Link from "next/link";

const faqs = [
  {
    q: "What is PixelVault?",
    a: "PixelVault is a gaming and software vault where you can discover, download, and explore a curated library of PC games, software, and Android apps — all in one place.",
  },
  {
    q: "Is everything on PixelVault free?",
    a: "We provide free alternatives and open-source software. Some listings may link to official stores where paid products are available. Always check the license before downloading.",
  },
  {
    q: "How often is the library updated?",
    a: "Our library is updated daily with new software, games, and app entries. Version numbers and download links are reviewed regularly to ensure accuracy.",
  },
  {
    q: "Are the downloads safe?",
    a: "We only link to official sources and trusted mirrors. However, always run your own antivirus checks before installing any software.",
  },
  {
    q: "Can I request software to be added?",
    a: "Yes! Use the Software Request page under the Support section to submit a request. Our team will review it and add it if available.",
  },
  {
    q: "How do I report a broken download link?",
    a: "Contact us through the Contact Us page with the software name and the issue. We'll investigate and update the link as soon as possible.",
  },
  {
    q: "Do I need an account?",
    a: "No account is required to browse or download. Everything is freely accessible.",
  },
  {
    q: "What platforms are supported?",
    a: "We cover Windows, Mac, and Android. Each listing clearly shows which platform it supports.",
  },
];

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <Link href="/" className="hover:text-red-500 transition-colors">Home</Link>
          <span>/</span>
          <span className="text-white">FAQ</span>
        </nav>

        <h1 className="text-4xl font-black mb-4 tracking-tight">Frequently Asked Questions</h1>
        <p className="text-gray-400 mb-12 text-lg">Everything you need to know about PixelVault.</p>

        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-white font-bold text-lg mb-3">{faq.q}</h3>
              <p className="text-gray-400 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-500 mb-4">Still have questions?</p>
          <Link
            href="/contact"
            className="inline-block bg-amber-600 hover:bg-amber-500 text-white px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-colors"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
}

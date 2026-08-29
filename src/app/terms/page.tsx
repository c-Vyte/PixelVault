"use client";

import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <Link href="/" className="hover:text-amber-500 transition-colors">Home</Link>
          <span>/</span>
          <span className="text-white">Terms of Service</span>
        </nav>

        <h1 className="text-4xl font-black mb-4 tracking-tight">Terms of Service</h1>
        <p className="text-gray-500 mb-12 text-sm">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="space-y-8 text-gray-400 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing and using PixelVault, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you may not use our service.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Use of Service</h2>
            <p>PixelVault provides a curated directory of software, games, and applications. We do not host any files directly — all downloads link to official sources or trusted third-party mirrors. You are responsible for complying with the terms of service of any external site you visit.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Intellectual Property</h2>
            <p>All trademarks, product names, and logos are the property of their respective owners. Software listings, descriptions, and screenshots are used for informational purposes only. PixelVault does not claim ownership of any third-party software listed on the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. User Conduct</h2>
            <p>You agree not to misuse the service, attempt to access it through unauthorized means, or use it for any unlawful purpose. Automated scraping or data extraction is prohibited without prior written consent.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Disclaimer</h2>
            <p>All software is provided &quot;as is&quot; without warranty of any kind. PixelVault does not guarantee the accuracy, completeness, or reliability of any listing. We strongly recommend verifying software compatibility and scanning downloads before installation.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Limitation of Liability</h2>
            <p>PixelVault and its operators shall not be held liable for any damages arising from the use of or inability to use the service, including but not limited to data loss, software damage, or security breaches.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Changes to Terms</h2>
            <p>We reserve the right to modify these terms at any time. Changes will be effective immediately upon posting. Continued use of the service constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Contact</h2>
            <p>If you have questions about these terms, please <Link href="/contact" className="text-amber-500 hover:text-amber-400 underline">contact us</Link>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

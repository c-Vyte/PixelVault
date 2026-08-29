"use client";

import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <Link href="/" className="hover:text-amber-500 transition-colors">Home</Link>
          <span>/</span>
          <span className="text-white">Privacy Policy</span>
        </nav>

        <h1 className="text-4xl font-black mb-4 tracking-tight">Privacy Policy</h1>
        <p className="text-gray-500 mb-12 text-sm">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="space-y-8 text-gray-400 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Information We Collect</h2>
            <p>PixelVault operates as a client-side application. We do not collect personal information directly. However, certain data may be collected automatically:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Browser type and version</li>
              <li>Pages visited and time spent on the site</li>
              <li>Referring website addresses</li>
              <li>Device type and screen resolution</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Local Storage</h2>
            <p>We use browser localStorage to store your preferences (theme, recently viewed software, admin settings). This data never leaves your device and is not transmitted to any server.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Cookies</h2>
            <p>PixelVault does not use cookies. All preference storage is handled through localStorage.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Third-Party Links</h2>
            <p>Our site contains links to external download sources. We are not responsible for the privacy practices of these third-party sites. We encourage you to review their privacy policies before providing any personal information.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Data Security</h2>
            <p>Since we do not collect or store personal data on servers, there is minimal risk of data breaches. Your localStorage data is accessible only from your own browser.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Children&apos;s Privacy</h2>
            <p>PixelVault does not knowingly collect information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Changes to This Policy</h2>
            <p>We may update this privacy policy from time to time. Changes will be posted on this page with an updated revision date.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Contact</h2>
            <p>If you have questions about this privacy policy, please <Link href="/contact" className="text-amber-500 hover:text-amber-400 underline">contact us</Link>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

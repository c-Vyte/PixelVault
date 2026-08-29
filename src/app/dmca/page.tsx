"use client";

import Link from "next/link";

export default function DMCAPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <Link href="/" className="hover:text-amber-500 transition-colors">Home</Link>
          <span>/</span>
          <span className="text-white">DMCA</span>
        </nav>

        <h1 className="text-4xl font-black mb-4 tracking-tight">DMCA Policy</h1>
        <p className="text-gray-500 mb-12 text-sm">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>

        <div className="space-y-8 text-gray-400 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">Copyright Infringement Policy</h2>
            <p>PixelVault respects the intellectual property rights of others and expects users to do the same. In accordance with the Digital Millennium Copyright Act (DMCA), we will respond expeditiously to claims of copyright infringement.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">How We Operate</h2>
            <p>PixelVault is a software directory that provides links to official sources and trusted mirrors. We do not host, store, or distribute any software files directly. All downloads are sourced from third-party websites or official developer pages.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Filing a DMCA Notice</h2>
            <p>If you believe that content on our site infringes your copyright, please send a written notice containing the following:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>A physical or electronic signature of the copyright owner or authorized agent</li>
              <li>Identification of the copyrighted work claimed to be infringed</li>
              <li>Identification of the material to be removed, with sufficient detail for us to locate it</li>
              <li>Your contact information (name, address, phone number, email)</li>
              <li>A statement that you have a good faith belief that use of the material is not authorized</li>
              <li>A statement that the information in the notice is accurate, under penalty of perjury</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Counter-Notification</h2>
            <p>If your content was removed and you believe it was a mistake or that you have authorization, you may file a counter-notification with the same information listed above, plus a statement under penalty of perjury that you will accept service of process from the original complainant.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Repeat Infringers</h2>
            <p>PixelVault will terminate the accounts of users who are determined to be repeat infringers of copyright.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">Contact</h2>
            <p>Send DMCA notices to our <Link href="/contact" className="text-amber-500 hover:text-amber-400 underline">contact page</Link> with the subject line &quot;DMCA Notice&quot;.</p>
          </section>
        </div>
      </div>
    </div>
  );
}

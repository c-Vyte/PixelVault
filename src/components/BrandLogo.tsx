import Link from "next/link";

type BrandLogoProps = {
  href?: string;
  compact?: boolean;
  showName?: boolean;
  className?: string;
};

function LogoContent({ compact = false, showName = true }: Omit<BrandLogoProps, "href" | "className">) {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[linear-gradient(145deg,#7B45F0,#491AB1)] text-white shadow-[0_8px_24px_rgba(73,26,177,0.35)] ring-1 ring-[#A981FF]/40">
        <svg aria-hidden="true" className="h-7 w-7" viewBox="0 0 32 32" fill="none">
          <path d="M8 7.5h16v17H8z" stroke="currentColor" strokeWidth="2" opacity=".32" />
          <path d="M20.5 7.5 11 19h8v5.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 24.5h16" stroke="#D0BCFC" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="absolute inset-x-0 bottom-0 h-px bg-[#D0BCFC]/80" />
      </span>
      {showName && (
        <span className={`font-mono font-black uppercase tracking-[0.16em] text-white ${compact ? "text-base" : "text-lg"}`}>
          PIXEL<span className="text-[#A981FF]">VAULT</span>
        </span>
      )}
    </span>
  );
}

export default function BrandLogo({ href, compact = false, showName = true, className = "" }: BrandLogoProps) {
  const content = <LogoContent compact={compact} showName={showName} />;

  if (!href) return <span className={className}>{content}</span>;

  return (
    <Link href={href} className={className} aria-label="PixelVault home">
      {content}
    </Link>
  );
}

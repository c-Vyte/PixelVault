"use client";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (opts: { client_id: string; callback: (res: { credential: string }) => void; auto_select?: boolean }) => void;
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function GoogleSignInButton({ clientId, onCredential }: { clientId: string; onCredential: (idToken: string) => void }) {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clientId || !divRef.current) return;
    const src = "https://accounts.google.com/gsi/client";
    if (!document.querySelector(`script[src="${src}"]`)) {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.defer = true;
      s.onload = () => init();
      document.head.appendChild(s);
    } else {
      init();
    }
    function init() {
      if (!window.google || !divRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (res) => onCredential(res.credential),
        auto_select: false,
      });
      window.google.accounts.id.renderButton(divRef.current, { theme: "outline", size: "large", width: 320, text: "signin_with" });
    }
  }, [clientId, onCredential]);

  return <div ref={divRef} className="flex justify-center" />;
}

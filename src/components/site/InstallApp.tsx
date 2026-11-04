"use client";

import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** "Add to home screen": native prompt on Android/Chrome, a short how-to on iPhone. */
export function InstallApp() {
  const [evt, setEvt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [installed, setInstalled] = useState(true);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    setInstalled(Boolean(standalone));
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as PromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setInstalled(true));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (installed || (!evt && !ios)) return null;

  return (
    <div className="mx-auto mt-4 max-w-xs">
      <button
        type="button"
        onClick={async () => {
          if (evt) {
            await evt.prompt();
            setEvt(null);
          } else setShowIosHint((v) => !v);
        }}
        className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-xs text-mute transition hover:border-gold/40 hover:text-bone active:scale-[0.98]"
      >
        <Download className="size-3.5" />
        ثبّت الموقع على موبايلك
      </button>
      {showIosHint && (
        <p className="mt-3 animate-rise text-xs leading-6 text-faint">
          اضغط زر المشاركة <Share className="inline size-3.5" /> بالسفاري، وبعدين &quot;إضافة إلى الشاشة الرئيسية&quot;.
        </p>
      )}
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <TriangleAlert className="size-9 text-gold" />
      <h1 className="font-display text-2xl">صار خلل بالتحميل</h1>
      <p className="max-w-sm text-sm text-mute">تأكد من الإنترنت وحاول مرة ثانية. إذا تكررت المشكلة، تواصل ويا الدعم الفني.</p>
      {error.digest && <p className="num text-xs text-faint">رمز الخطأ: {error.digest}</p>}
      <Button variant="outline" onClick={reset}>
        <RefreshCw className="size-4" /> حاول مرة ثانية
      </Button>
    </div>
  );
}

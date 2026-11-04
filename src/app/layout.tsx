import type { Metadata, Viewport } from "next";
import { Amiri, Readex_Pro } from "next/font/google";
import "./globals.css";
import { JazzAudio } from "@/components/site/JazzAudio";

// Readex Pro (open licence) is the stand-in for Thmanyah Sans. Thmanyah's free licence is
// personal-use only, so it is loaded only when the shop has its own licensed font CSS
// (NEXT_PUBLIC_THMANYAH_CSS); the font stack in globals.css then picks it up automatically.
const body = Readex_Pro({
  subsets: ["arabic", "latin"],
  variable: "--font-body",
  display: "swap",
});
// Classical Arabic serif for headings (theme "Emerald & Brass")
const serif = Amiri({
  subsets: ["arabic", "latin"],
  weight: ["400", "700"],
  variable: "--font-serif",
  display: "swap",
});
const thmanyahCss = process.env.NEXT_PUBLIC_THMANYAH_CSS;

export const metadata: Metadata = {
  title: { default: "احجز موعدك", template: "%s" },
  description: "احجز موعد الحلاقة أونلاين بثواني",
};

export const viewport: Viewport = {
  themeColor: "#0d2a22",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" className={`${body.variable} ${serif.variable}`}>
      {thmanyahCss && (
        <head>
          <link rel="stylesheet" href={thmanyahCss} />
        </head>
      )}
      <body className="min-h-dvh antialiased">
        {children}
        <JazzAudio />
      </body>
    </html>
  );
}

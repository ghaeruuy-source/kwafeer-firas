import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "فراس اوامي | احجز موعدك",
    short_name: "فراس اوامي",
    description: "احجز موعد حلاقتك عند فراس اوامي بثواني.",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    display: "standalone",
    background_color: "#0d2a22",
    theme_color: "#0d2a22",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "احجز الآن", url: "/book" },
      { name: "حجوزاتي", url: "/booking" },
    ],
  };
}

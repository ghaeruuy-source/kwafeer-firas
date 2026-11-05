import type { NextConfig } from "next";

// The receipt image is drawn on the server with a native canvas, which needs its fonts
// and the logo shipped alongside the function.
const receiptFiles = ["./src/assets/fonts/**", "./public/logo.png"];

const nextConfig: NextConfig = {
  serverExternalPackages: ["@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/receipt/[token]": receiptFiles,
    "/api/booking-receipt": receiptFiles,
  },
};

export default nextConfig;

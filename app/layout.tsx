import type { Metadata, Viewport } from "next";
import "./globals.css";
import { GOOGLE_FONTS_URL } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Insta Builder – @denniskral_",
  description: "Instagram Content Creation powered by Gemini AI",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Insta Builder",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={GOOGLE_FONTS_URL} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}

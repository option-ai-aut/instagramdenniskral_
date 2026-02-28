import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Insta Builder – @denniskral_",
  description: "Instagram Content Creation powered by Gemini AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="de" className="dark">
        <body className="antialiased">{children}</body>
      </html>
    </ClerkProvider>
  );
}

import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Voxrate - AI Review Analyzer for Sellers",
  description: "Analyze product reviews with Voxrate. Find buyer complaints, product strengths, SEO gaps, and exact fixes for Etsy listings and online shops.",
  keywords: [
    "review analyzer",
    "AI review analysis",
    "Etsy review analyzer",
    "product review analysis",
    "customer feedback tool",
    "seller analytics",
    "listing optimization",
  ],
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "Voxrate - AI Review Analyzer for Sellers",
    description: "Find buyer complaints, product strengths, SEO gaps, and exact fixes from your product reviews.",
    url: "https://voxrate.app",
    siteName: "Voxrate",
    images: [
      {
        url: "https://voxrate.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "Voxrate – AI Review Analyzer for Etsy Sellers",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Voxrate - AI Review Analyzer for Sellers",
    description: "Find buyer complaints, product strengths, SEO gaps, and exact fixes from your product reviews.",
    images: ["https://voxrate.app/og-image.png"],
  },
  metadataBase: new URL("https://voxrate.app"),
  alternates: {
    canonical: "https://voxrate.app",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <Analytics />
      </body>
    </html>
  );
}

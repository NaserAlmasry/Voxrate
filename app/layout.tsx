import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ToastProvider } from "@/app/components/Toast";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Voxrate – Amazon Review Analyzer | Find What's Costing You Sales",
  description: "Paste any Amazon listing URL and get a full AI analysis of your reviews — top complaints, buyer keywords, SEO gaps, and exact fixes. First analysis free.",
  keywords: [
    "Amazon review analyzer",
    "Amazon listing analyzer",
    "Amazon seller tools",
    "Amazon listing optimization",
    "AI review analysis",
    "Amazon SEO tool",
    "Amazon competitor analysis",
    "review sentiment analysis",
    "Amazon product improvement",
    "product review analyzer",
    "listing rewriter Amazon",
    "Amazon listing health score",
  ],
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    title: "Voxrate – Amazon Review Analyzer | Find What's Costing You Sales",
    description: "Paste any Amazon listing URL and get a full AI analysis — complaints, buyer keywords, SEO gaps, and exact fixes. First analysis free.",
    url: "https://voxrate.app",
    siteName: "Voxrate",
    images: [
      {
        url: "https://voxrate.app/og",
        width: 1200,
        height: 630,
        alt: "Voxrate – AI Review Analyzer for Amazon Sellers",
      },
    ],
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Voxrate – Amazon Review Analyzer | Find What's Costing You Sales",
    description: "Paste any Amazon listing URL and get a full AI analysis — complaints, buyer keywords, SEO gaps, and exact fixes. First analysis free.",
    images: ["https://voxrate.app/og"],
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
        <ToastProvider>
          {children}
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}

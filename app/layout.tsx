import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ToastProvider } from "@/app/components/Toast";
import CookieBanner from "@/app/components/CookieBanner";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const SITE_URL = "https://voxrate.app";
const SITE_NAME = "Voxrate";
const TITLE = "Voxrate – Amazon Review Analyzer | Find What's Costing You Sales";
const DESCRIPTION =
  "Paste any Amazon listing URL and get a full AI analysis of your reviews — top complaints, buyer keywords, SEO gaps, and exact fixes. First analysis free. No credit card required.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,

  applicationName: SITE_NAME,
  authors: [{ name: "Voxrate", url: SITE_URL }],
  creator: "Voxrate",
  publisher: "Voxrate",
  category: "Business Software",
  generator: "Next.js",
  referrer: "origin-when-cross-origin",

  keywords: [
    // Core product terms
    "Amazon review analyzer",
    "Amazon listing analyzer",
    "Amazon product analyzer",
    "Amazon review analysis tool",
    "Amazon negative review analysis",
    "Amazon review sentiment analysis",
    "Amazon listing health score",
    // Action-based searches
    "how to analyze Amazon reviews",
    "how to improve Amazon listing",
    "how to fix Amazon listing",
    "how to reduce Amazon returns",
    "Amazon listing optimizer",
    "Amazon listing improvement tool",
    "Amazon listing audit",
    "Amazon complaint analysis",
    // Competitor + alternative searches
    "Helium 10 alternative",
    "Jungle Scout alternative",
    "Amazon seller tools",
    "Amazon FBA tools",
    "Amazon seller software",
    "best Amazon tools 2025",
    "Amazon seller analytics",
    // SEO + keyword tools
    "Amazon SEO tool",
    "Amazon keyword extractor",
    "Amazon buyer keywords",
    "Amazon listing keywords",
    "Amazon listing SEO",
    // Competitor spy
    "Amazon competitor analysis",
    "Amazon competitor spy tool",
    "Amazon product research tool",
    // Specific features
    "Amazon listing rewriter",
    "Amazon review reply generator",
    "Amazon listing copy generator",
    "Amazon product health score",
    "Amazon fake review detector",
    "Amazon review monitoring",
    "AI Amazon seller tool",
    "AI listing optimizer Amazon",
  ],

  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },

  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [
      {
        url: `${SITE_URL}/og`,
        width: 1200,
        height: 630,
        alt: "Voxrate – AI Review Analyzer for Amazon Sellers",
        type: "image/png",
      },
    ],
    type: "website",
    locale: "en_US",
  },

  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [`${SITE_URL}/og`],
    creator: "@voxrate",
    site: "@voxrate",
  },

  alternates: {
    canonical: SITE_URL,
    languages: { "en-US": SITE_URL },
  },

  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  verification: {
    // Add your Google Search Console verification token here when you get it:
    // google: "YOUR_GOOGLE_VERIFICATION_TOKEN",
  },

  other: {
    "msapplication-TileColor": "#f05a1e",
    "theme-color": "#f05a1e",
    "format-detection": "telephone=no",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#software`,
      name: SITE_NAME,
      url: SITE_URL,
      description: DESCRIPTION,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      browserRequirements: "Requires JavaScript",
      offers: [
        {
          "@type": "Offer",
          name: "Free Plan",
          price: "0",
          priceCurrency: "USD",
          description: "1 free analysis, no credit card required",
        },
        {
          "@type": "Offer",
          name: "Starter",
          price: "14.99",
          priceCurrency: "USD",
          billingIncrement: "P1M",
          description: "35 analyses/month — own or competitor",
        },
        {
          "@type": "Offer",
          name: "Growth",
          price: "39.99",
          priceCurrency: "USD",
          billingIncrement: "P1M",
          description: "80 analyses/month — own or competitor",
        },
        {
          "@type": "Offer",
          name: "Pro",
          price: "59.99",
          priceCurrency: "USD",
          billingIncrement: "P1M",
          description: "220 analyses/month — own or competitor",
        },
      ],
      featureList: [
        "Amazon review complaint analysis",
        "Listing health score",
        "SEO keyword extraction from reviews",
        "Competitor review analysis",
        "AI listing rewriter",
        "Fake review detection",
        "Sentiment alerts for new 1-star and 2-star reviews",
        "Review reply generator",
        "CSV and PDF export",
      ],
      screenshot: `${SITE_URL}/og`,
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.8",
        reviewCount: "47",
        bestRating: "5",
        worstRating: "1",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: DESCRIPTION,
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
        width: 160,
        height: 36,
      },
      contactPoint: {
        "@type": "ContactPoint",
        email: "info@voxrate.app",
        contactType: "customer support",
        availableLanguage: "English",
      },
      sameAs: [],
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Voxrate?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Voxrate is an AI-powered Amazon review analyzer that turns your customer reviews into a ranked action plan — identifying complaints by severity, extracting SEO keywords from buyer language, and giving you exact step-by-step fixes to improve your listing and health score.",
          },
        },
        {
          "@type": "Question",
          name: "How does Voxrate analyze Amazon reviews?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Paste your Amazon product URL or ASIN. Voxrate scrapes your live reviews from Amazon, runs them through AI models to detect complaint patterns, severity levels, SEO keywords, and strengths — then generates an action plan with specific fixes in under 2 minutes.",
          },
        },
        {
          "@type": "Question",
          name: "Is Voxrate free to try?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes — sign up for a 14-day free trial with 5 analyses included. No credit card required. Paid plans start at $14.99/month for 35 analyses.",
          },
        },
        {
          "@type": "Question",
          name: "How is Voxrate different from Helium 10 or Jungle Scout?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Helium 10 and Jungle Scout focus on keyword research and product discovery before buyers find you. Voxrate analyzes what buyers say after they buy — turning negative reviews into ranked complaints with exact fixes, a health score, and SEO keywords extracted from real customer language.",
          },
        },
        {
          "@type": "Question",
          name: "Can I analyze my competitor's Amazon listing?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. On Growth and Pro plans, you can paste any Amazon URL and analyze a competitor's reviews to find their weaknesses, gaps in their listing, and keywords their buyers use — before they fix them.",
          },
        },
      ],
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} h-full antialiased`}>
      <body className="min-h-full">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ToastProvider>
          {children}
        </ToastProvider>
        <CookieBanner />
        <Analytics />
      </body>
    </html>
  );
}

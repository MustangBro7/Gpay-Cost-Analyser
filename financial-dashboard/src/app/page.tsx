import type { Metadata } from "next"
import { LandingPage } from "@/components/LandingPage"

const title = "GPay Cost Analyzer — Google Pay Spending Tracker & Analytics"
const description =
  "Turn the Google Pay receipts in your Gmail into a clean spending dashboard. Automatic import, AI-powered transaction classification, and date-range analytics — free and read-only."

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "Google Pay spending tracker",
    "GPay expense analyzer",
    "UPI spending analytics",
    "Gmail receipt import",
    "AI transaction classification",
    "personal finance dashboard",
    "expense categorization",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "GPay Cost Analyzer",
    title,
    description,
    images: [
      {
        url: "/app-logo.png",
        width: 512,
        height: 512,
        alt: "GPay Cost Analyzer logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title,
    description,
    images: ["/app-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
}

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "GPay Cost Analyzer",
  description,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "INR",
  },
  featureList: [
    "Automatic Gmail receipt import",
    "AI-powered transaction classification",
    "Date-range spending analytics",
    "Custom classification rules",
  ],
}

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <LandingPage />
    </>
  )
}

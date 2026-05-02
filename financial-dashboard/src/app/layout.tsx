import type { Metadata } from "next";
import { Space_Mono, DM_Sans } from "next/font/google";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Money Tracker — Neo Brutalist Finance",
  description: "Track your spending with style. Bold, raw, unapologetic.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceMono.variable} ${dmSans.variable} antialiased font-[family-name:var(--font-dm-sans)]`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

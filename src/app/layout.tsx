import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { StoreProvider } from "@/lib/store";
import { ThemeProvider, themeScript } from "@/lib/theme";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Vestage — Diversified investing across real-world assets",
  description:
    "Fund your account in crypto, choose an investment term, and track your returns from a single dashboard. Returns are targets, not guarantees.",
  openGraph: {
    type: "website",
    siteName: "Vestage",
    url: "/",
    title: "Vestage — Diversified investing across real-world assets",
    description:
      "Fund your account in crypto, choose an investment term, and track your returns from a single dashboard.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Vestage — Diversified investing across real-world assets",
    description:
      "Fund your account in crypto, choose an investment term, and track your returns from a single dashboard.",
  },
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <StoreProvider>{children}</StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

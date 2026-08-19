import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";

import "./globals.css";

/**
 * The application's UI typeface.
 *
 * Loaded through `next/font`, which self-hosts the files, preloads them, and
 * emits `size-adjust` fallback metrics so switching to the real face causes no
 * layout shift. Only the weights the interface actually uses are requested, and
 * `display: swap` keeps text readable if the font never arrives.
 *
 * Code is deliberately excluded: shortcode and CSS stay monospace.
 */
const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter-tight",
});

export const metadata: Metadata = {
  title: {
    default: "NCloud Flatsome AI",
    template: "%s | NCloud Flatsome AI",
  },
  description:
    "Central control system for reusable Flatsome UX Builder sections and connected AI runners.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={interTight.variable}>
      <body>{children}</body>
    </html>
  );
}

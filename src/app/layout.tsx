import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

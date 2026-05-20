import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Sault Nissan Communications",
    template: "%s · Sault Nissan",
  },
  description: "Dealership communications platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={`h-full ${GeistSans.variable} ${GeistMono.variable}`} lang="en">
      <body className={`${GeistSans.className} text-foreground min-h-full antialiased`}>
        {children}
      </body>
    </html>
  );
}

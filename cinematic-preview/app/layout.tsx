import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web Cloud Solutions | Websites for Australian Businesses",
  description: "Professional, fast and affordable websites for Australian businesses.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU">
      <body className="antialiased">{children}</body>
    </html>
  );
}

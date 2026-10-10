import type { Metadata } from "next";
import "./globals.css";
import "./redesign.css";
import "./home.css";
import "./dark.css";

export const metadata: Metadata = {
  title: "Perseva — Keep showing up",
  description: "Your peaceful study space. Build a routine, protect your focus, and make a little progress every day.",
  manifest: '/manifest.webmanifest',
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
    <html lang="en">
      <body className="antialiased dark-theme">{children}</body>
    </html>
  );
}




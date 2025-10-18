// app/layout.js
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// ✅ Use the new `viewport` export in Next 15
export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e3a8a" },
    { media: "(prefers-color-scheme: dark)",  color: "#0b1220" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// Keep `metadata` for everything else
export const metadata = {
  applicationName: "MomentsAtSea",
  title: "MomentsAtSea",
  description: "Your cruise memories, beautifully preserved",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MomentsAtSea",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
};

// Client components mounted globally
import SWClient from "./components/SWClient";
import A2HSClient from "./components/A2HSClient";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <SWClient />
        <A2HSClient />
      </body>
    </html>
  );
}

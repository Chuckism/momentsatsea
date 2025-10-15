import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  applicationName: "MomentsAtSea",
  title: "MomentsAtSea",
  description: "Your cruise memories, beautifully preserved",
  manifest: "/manifest.webmanifest",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1e3a8a" },
    { media: "(prefers-color-scheme: dark)",  color: "#0b1220" },
  ],
  appleWebApp: {
    capable: true,
    title: "MomentsAtSea",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
    other: [{ rel: "mask-icon", url: "/icons/maskable-512.png", color: "#1e3a8a" }],
  },
};

// ✅ Correct paths (folder is "components", not "_components")
import SWClient from "./components/SWClient";
import A2HSClient from "./components/A2HSClient";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        {/* Mount the tiny clients: SW registration + iOS A2HS helper */}
        <SWClient />
        <A2HSClient />
      </body>
    </html>
  );
}

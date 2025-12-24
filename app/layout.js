import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import SWClient from "./components/SWClient";

// 1. Set up the fonts your CSS is expecting
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 2. Set up the PWA & SEO metadata
export const metadata = {
  title: "Moments At Sea",
  description: "Capture and preserve your maritime memories.",
  manifest: "/manifest.webmanifest",
  themeColor: "#000000",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Moments At Sea",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Apple icon manually linked for better iPad support */}
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SWClient />
        {children}
      </body>
    </html>
  );
}
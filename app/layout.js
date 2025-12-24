import SWClient from '@/components/SWClient';

export const metadata = {
  title: "Moments At Sea",
  manifest: "/manifest.webmanifest",
  themeColor: "#000000",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MomentsAtSea",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        <SWClient /> 
        {children}
      </body>
    </html>
  );
}
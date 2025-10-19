// Server file (no 'use client')

// Route segment config (server-only)
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import HomePageClient from './HomePageClient';

export default function Page() {
  return <HomePageClient />;
}

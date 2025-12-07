// This file must be 100% static so Capacitor can export it
// No: dynamic, revalidate, fetchCache, or server-only flags.

import HomePageClient from './HomePageClient';

export default function Page() {
  return <HomePageClient />;
}

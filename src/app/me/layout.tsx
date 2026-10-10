import { Suspense } from "react";

// The page reads the session and database at request time, so it sits behind Suspense.
export default function MeLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="wrap"><div className="skel" /></div>}>{children}</Suspense>;
}

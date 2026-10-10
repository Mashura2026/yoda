import { Suspense } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="wrap"><div className="skel" /></div>}>{children}</Suspense>;
}

import Link from "next/link";
import { Suspense } from "react";
import Header from "@/components/Header";
import { requireAdmin } from "@/lib/session";

const NAV = [
  ["/admin", "Overview"],
  ["/admin/enrollments", "Enrollments"],
  ["/admin/programs", "Programs"],
  ["/admin/settings", "Settings"],
  ["/admin/holidays", "Holidays"],
  ["/admin/people", "People"],
] as const;

// Every admin page reads the session and the database at request time, so it all sits behind Suspense.
async function Guard({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header title="Admin" wide />
      <main className="wrap wide pad-bottom">
        <nav className="bar">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="btn">{label}</Link>
          ))}
        </nav>
        <Suspense fallback={<div className="skel" />}>
          <Guard>{children}</Guard>
        </Suspense>
      </main>
    </>
  );
}

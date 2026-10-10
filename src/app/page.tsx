import Link from "next/link";
import Header from "@/components/Header";

export default function Home() {
  return (
    <>
      <Header title="Sales Academy" />
      <main className="wrap">
        <div className="banner">Sign in with Microsoft 365 to see your 90-day calendar.</div>
        <Link className="btn" href="/me">Open my academy</Link>
      </main>
    </>
  );
}

import Link from "next/link";

export default function LandingPlaceholderPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">
          September Math Ready
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Program details are coming soon.
        </p>
        <Link
          href="/readiness"
          className="mt-8 inline-flex rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
        >
          Return to the assessment
        </Link>
      </section>
    </main>
  );
}

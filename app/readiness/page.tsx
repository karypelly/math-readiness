import Link from "next/link";

export default function ReadinessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-2xl rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">
          Infinite Solutions Tutoring
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">
          Math Readiness Assessment
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-slate-600">
          The readiness route is working. The assessment components can now be
          connected here before deployment to your web host.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex rounded-full bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
        >
          Return home
        </Link>
      </section>
    </main>
  );
}

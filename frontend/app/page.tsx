import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="text-center">
        <h1 className="text-3xl font-semibold text-slate-900">
          skyzentech.com — main site
        </h1>
        <p className="mt-3 text-sm text-slate-600">
          Rebuild in progress.
        </p>
        <p className="mt-8 text-sm">
          <Link href="/careers" className="text-blue-600 hover:underline">
            Internships &rarr; /careers
          </Link>
        </p>
      </div>
    </main>
  );
}

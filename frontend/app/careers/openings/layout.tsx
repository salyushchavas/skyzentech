export default function OpeningsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <a href="/careers/openings" className="text-lg font-semibold text-blue-700">
            Skyzen Careers
          </a>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/careers/openings" className="text-slate-600 hover:text-blue-700">
              Open Internships
            </a>
            <a
              href="/careers/login"
              className="rounded border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign in
            </a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

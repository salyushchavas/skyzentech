'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS: ReadonlyArray<{ label: string; href: string }> = [
  { label: 'Dashboard', href: '/careers/candidate' },
  { label: 'Open Internships', href: '/careers/openings' },
  { label: 'My Applications', href: '/careers/candidate/applications' },
  { label: 'My Resumes', href: '/careers/candidate/resumes' },
];

export default function CandidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <nav className="rounded-lg border border-slate-200 bg-white p-2">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === '/careers/candidate'
                  ? pathname === item.href
                  : pathname?.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={
                      'block rounded px-3 py-2 text-sm font-medium ' +
                      (active
                        ? 'bg-accent/10 text-primary-800'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900')
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}

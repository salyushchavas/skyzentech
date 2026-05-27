import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';

interface Props {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}

/**
 * Shared chrome for the /privacy and /terms pages. Same dark navy brand bar
 * across the top, white content card, then SiteFooter. The "DRAFT — pending
 * legal review" banner is mandatory until counsel signs off on the copy.
 */
export default function LegalPageShell({ title, lastUpdated, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="bg-skyzen-dark py-4 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md bg-white/10 p-1">
              <img
                src="/images/skyzen-logo.png"
                alt="Skyzen"
                className="h-7 w-7 object-contain"
              />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[17px] font-extrabold uppercase tracking-wide">
                <span className="text-white">SKY</span>
                <span className="text-accent">ZEN</span>
              </span>
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/50">
                Technologies LLC
              </span>
            </span>
          </Link>
        </div>
      </header>

      <div className="bg-gradient-to-r from-accent to-accent-dark px-6 py-1" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>DRAFT — pending legal review.</strong> The text below is a
          placeholder authored ahead of counsel sign-off. Final copy is being
          prepared and will replace this draft before public launch.
        </div>
        <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {lastUpdated}</p>
        <div className="mt-8 space-y-6 text-[15px] leading-relaxed text-gray-800">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

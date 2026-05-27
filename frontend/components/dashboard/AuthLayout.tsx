import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';

interface Props {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function AuthLayout({ children, title, subtitle }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <main className="flex flex-1 items-center justify-center p-4">
        <div className="mx-auto w-full max-w-md">
          <img
            src="/images/skyzen-logo.png"
            alt="Skyzen"
            className="mx-auto mb-6 h-10 w-auto"
          />
          {title && (
            <h1 className="text-center text-2xl font-semibold text-gray-900">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="mt-1 text-center text-sm text-gray-500">{subtitle}</p>
          )}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            {children}
          </div>
          <p className="mt-6 text-center text-sm text-gray-500">
            <Link href="/" className="hover:text-gray-700">
              &larr; Back to main site
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

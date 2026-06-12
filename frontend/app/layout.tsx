import type { Metadata } from 'next';
import { Dancing_Script, Inter, Poppins } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/lib/auth-context';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

// Inter is the dashboard typeface. Marketing pages keep Poppins via the
// font-poppins utility; everything inside DashboardLayout opts into Inter
// through the `ds` class on its root.
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

// Phase 8.6.2 — cursive font for the typed-name signature preview on
// the applicant offer signing page. Only renders inside that one
// element via inline fontFamily fallback, but loading it via
// next/font means no FOUC and consistent rendering.
const dancingScript = Dancing_Script({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-dancing-script',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Skyzen Technologies — IT Staffing & STEM Internships',
    template: '%s — Skyzen Technologies',
  },
  description:
    'Skyzen Technologies LLC — premier IT consulting, software development, staffing, and STEM internships based in Plano, TX. Trusted by 21+ enterprise clients.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable} ${dancingScript.variable}`}>
      <head>
        {/* icofont — used by SiteHeader / SiteFooter / ported home page. */}
        <link rel="stylesheet" href="/plugins/icofont/icofont.min.css" />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              fontSize: '14px',
              border: '1px solid rgb(229 231 235)',
              padding: '12px 16px',
              borderRadius: '6px',
            },
            success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
            error: { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
          }}
        />
      </body>
    </html>
  );
}

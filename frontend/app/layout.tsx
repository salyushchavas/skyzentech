import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
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
    <html lang="en" className={poppins.variable}>
      <head>
        {/* icofont — used by SiteHeader / SiteFooter / ported home page. */}
        <link rel="stylesheet" href="/plugins/icofont/icofont.min.css" />
      </head>
      <body className="min-h-screen font-sans antialiased">
        {children}
      </body>
    </html>
  );
}

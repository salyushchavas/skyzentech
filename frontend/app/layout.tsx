import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Skyzen Technologies',
  description: 'Skyzen Technologies — STEM staffing and internship programs.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}

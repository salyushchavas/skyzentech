import { AuthProvider } from '@/lib/auth-context';

export default function CareersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthProvider>{children}</AuthProvider>;
}

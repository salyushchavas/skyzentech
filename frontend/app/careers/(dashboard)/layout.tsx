'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import SiteLayout from '@/components/SiteLayout';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/careers/login');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <SiteLayout>
        <div className="flex min-h-[60vh] items-center justify-center bg-gray-50">
          <div
            aria-label="Loading"
            className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent"
          />
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </div>
    </SiteLayout>
  );
}

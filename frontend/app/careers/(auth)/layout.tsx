import SiteLayout from '@/components/SiteLayout';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SiteLayout>
      <div className="flex items-center justify-center bg-gray-50 px-4 py-16">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </SiteLayout>
  );
}

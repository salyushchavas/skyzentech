import SiteLayout from '@/components/SiteLayout';

export default function OpeningsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SiteLayout>
      <div className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 py-10">{children}</div>
      </div>
    </SiteLayout>
  );
}

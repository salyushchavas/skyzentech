// Passthrough — every intern page wraps itself in <DashboardLayout>.
// Kept as a placeholder so future intern-specific providers can land here.
export default function InternSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

// Passthrough — the candidate-section sidebar is now part of <DashboardLayout>
// (which each candidate page wraps itself in). Keeping this file so future
// candidate-specific providers can land here without re-introducing a sub-nav.

export default function CandidateSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

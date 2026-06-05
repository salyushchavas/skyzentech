import StubPage from '@/components/trainer/StubPage';

export default function TrainerAssignProjectPage() {
  return (
    <StubPage
      title="Assign Project"
      description="Doc §7 wizard — 11 fields (intern employee ID, month/year, project number 1|2 with warn-then-block, project title, technology area, project file PDF/DOCX/ZIP, instructions rich text, GitHub instructions conditional, due date, evaluation objective mapping, notify stakeholders toggle). Backdating requires manager/ERM authoriser."
      phase={2}
    />
  );
}

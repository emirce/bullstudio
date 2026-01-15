import { PageHeader } from "@/components/shell/PageHeader";
import { OverviewContent } from "@/components/overview";

export default async function WorkspaceOverviewPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Overview" />
      <main className="flex-1 min-h-0 overflow-auto p-6">
        <OverviewContent />
      </main>
    </div>
  );
}

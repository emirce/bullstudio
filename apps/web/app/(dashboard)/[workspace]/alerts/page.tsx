import { PageHeader } from "@/components/shell/PageHeader";
import { AlertsContent } from "@/components/alerts";

export default function AlertsPage() {
  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Alerts" />
      <main className="flex-1 min-h-0 overflow-auto p-6">
        <AlertsContent />
      </main>
    </div>
  );
}

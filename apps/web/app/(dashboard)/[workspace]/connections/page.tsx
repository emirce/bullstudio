import { PageHeader } from "@/components/shell/PageHeader";
import { ConnectionsContent } from "./ConnectionsContent";

type ConnectionsPageProps = {
  params: Promise<{ workspace: string }>;
};

export default async function ConnectionsPage({
  params,
}: ConnectionsPageProps) {
  const { workspace } = await params;

  return (
    <div className="flex flex-col h-full">
      <PageHeader title="Connections" />
      <main className="flex-1 p-6 overflow-auto">
        <ConnectionsContent workspaceSlug={workspace} />
      </main>
    </div>
  );
}

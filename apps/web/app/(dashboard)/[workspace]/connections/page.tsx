import { SidebarTrigger } from "@bullstudio/ui/components/sidebar";
import { Separator } from "@bullstudio/ui/components/separator";
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
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-red-500 animate-pulse" />
            <h1 className="text-lg font-semibold tracking-tight">
              Redis Connections
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 overflow-auto">
        <ConnectionsContent workspaceSlug={workspace} />
      </main>
    </div>
  );
}

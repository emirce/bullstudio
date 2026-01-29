import { SidebarTrigger } from "@bullstudio/ui/components/sidebar";
import { Separator } from "@bullstudio/ui/components/separator";

interface HeaderProps {
  title?: string;
  children?: React.ReactNode;
}

export default function Header({ title, children }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        {title && (
          <h1 className="text-lg font-semibold text-zinc-100">{title}</h1>
        )}
      </div>
      {children && <div className="ml-auto pr-4">{children}</div>}
    </header>
  );
}

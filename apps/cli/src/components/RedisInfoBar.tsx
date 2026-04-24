"use client";

import { useTRPC } from "@/integrations/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { Cpu, HardDrive, MemoryStick, Users, Layers } from "lucide-react";

export function RedisInfoBar() {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.connection.redisInfo.queryOptions());

  if (!data) return null;

  return (
    <div className="flex items-center gap-0 border border-zinc-800 rounded-lg bg-zinc-900/50 px-4 py-2.5 text-xs text-zinc-400 divide-x divide-zinc-800 w-fit">
      {/* Redis icon */}
      <div className="flex items-center pr-4">
        <img src="/logo.svg" alt="redis" className="size-5 shrink-0" />
      </div>

      <InfoItem icon={<Layers className="size-3" />} label="VERSION" value={data.version} />
      <InfoItem icon={<Cpu className="size-3" />} label="MODE" value={data.mode} />
      <InfoItem icon={<MemoryStick className="size-3" />} label="USED MEMORY" value={data.usedMemory} />
      <InfoItem icon={<HardDrive className="size-3" />} label="TOTAL MEMORY" value={data.totalMemory} />
      <InfoItem
        icon={<Users className="size-3" />}
        label="CLIENTS"
        value={`${data.connectedClients} / ${data.maxClients > 0 ? data.maxClients : "N/A"}`}
      />
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 px-4 first:pl-0">
      <span className="text-zinc-500">{icon}</span>
      <div className="flex flex-col gap-0.5">
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium leading-none">
          {label}
        </span>
        <span className="text-zinc-200 font-medium leading-none">{value}</span>
      </div>
    </div>
  );
}

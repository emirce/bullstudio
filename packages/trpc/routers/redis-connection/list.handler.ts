import { AuthedTRPCContext } from "../../types";
import { workspaceGuard } from "../../guards/workspace";
import { ListRedisConnectionsInput } from "./list.schema";

type ListRedisConnectionsHandlerProps = {
  ctx: AuthedTRPCContext;
  input: ListRedisConnectionsInput;
};

export async function listRedisConnectionsHandler({
  ctx,
  input,
}: ListRedisConnectionsHandlerProps) {
  const { prisma } = ctx;

  await workspaceGuard({ ctx, workspaceId: input.workspaceId });

  const connections = await prisma.redisConnection.findMany({
    where: { workspaceId: input.workspaceId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      host: true,
      port: true,
      database: true,
      tls: true,
      username: true,
      accessMode: true,
      status: true,
      lastConnectedAt: true,
      lastHealthCheckAt: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return connections;
}

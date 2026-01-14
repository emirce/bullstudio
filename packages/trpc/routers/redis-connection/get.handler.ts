import { TRPCError } from "@trpc/server";
import { AuthedTRPCContext } from "../../types";
import { GetRedisConnectionInput } from "./get.schema";

type GetRedisConnectionHandlerProps = {
  ctx: AuthedTRPCContext;
  input: GetRedisConnectionInput;
};

export async function getRedisConnectionHandler({
  ctx,
  input,
}: GetRedisConnectionHandlerProps) {
  const { prisma, user } = ctx;

  const connection = await prisma.redisConnection.findUnique({
    where: { id: input.connectionId },
    include: {
      workspace: {
        include: {
          members: {
            where: { userId: user.id },
          },
        },
      },
    },
  });

  if (!connection) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Connection not found",
    });
  }

  if (connection.workspace.members.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this connection",
    });
  }

  return {
    id: connection.id,
    name: connection.name,
    host: connection.host,
    port: connection.port,
    database: connection.database,
    tls: connection.tls,
    username: connection.username,
    accessMode: connection.accessMode,
    status: connection.status,
    lastConnectedAt: connection.lastConnectedAt,
    lastHealthCheckAt: connection.lastHealthCheckAt,
    lastError: connection.lastError,
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt,
  };
}

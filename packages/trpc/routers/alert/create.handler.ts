import { TRPCError } from "@trpc/server";
import type { AuthedTRPCContext } from "../../types";
import type { CreateAlertInput } from "./alert.schema";

type CreateAlertHandlerProps = {
  ctx: AuthedTRPCContext;
  input: CreateAlertInput;
};

export async function createAlertHandler({
  ctx,
  input,
}: CreateAlertHandlerProps) {
  const { prisma, user } = ctx;

  // Verify user has access to the connection
  const connection = await prisma.redisConnection.findUnique({
    where: { id: input.connectionId },
    include: {
      workspace: {
        include: {
          members: { where: { userId: user.id } },
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

  // Check for duplicate alert name on same queue
  const existingAlert = await prisma.alert.findFirst({
    where: {
      connectionId: input.connectionId,
      queueName: input.queueName,
      name: input.name,
    },
  });

  if (existingAlert) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "An alert with this name already exists for this queue",
    });
  }

  const alert = await prisma.alert.create({
    data: {
      connectionId: input.connectionId,
      name: input.name,
      description: input.description,
      queueName: input.queueName,
      type: input.type,
      config: input.config,
      recipients: input.recipients,
      cooldownMinutes: input.cooldownMinutes,
      enabled: input.enabled,
    },
    select: {
      id: true,
      name: true,
      description: true,
      queueName: true,
      type: true,
      config: true,
      recipients: true,
      cooldownMinutes: true,
      enabled: true,
      status: true,
      lastTriggeredAt: true,
      lastResolvedAt: true,
      lastCheckedAt: true,
      lastValue: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return alert;
}

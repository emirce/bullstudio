import { TRPCError } from "@trpc/server";
import type { Prisma } from "@bullstudio/prisma";
import type { AuthedTRPCContext } from "../../types";
import type { ListAlertsInput } from "./alert.schema";

type ListAlertsHandlerProps = {
  ctx: AuthedTRPCContext;
  input: ListAlertsInput;
};

export async function listAlertsHandler({
  ctx,
  input,
}: ListAlertsHandlerProps) {
  const { prisma, user } = ctx;

  // Verify user has access to the workspace
  const workspaceMember = await prisma.workspaceMember.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: input.workspaceId,
        userId: user.id,
      },
    },
  });

  if (!workspaceMember) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this workspace",
    });
  }

  // Build where clause
  const where: Prisma.AlertWhereInput = {
    connection: {
      workspaceId: input.workspaceId,
    },
  };

  if (input.connectionId) {
    where.connectionId = input.connectionId;
  }

  if (input.queueName) {
    where.queueName = input.queueName;
  }

  if (input.status) {
    where.status = input.status;
  }

  if (input.type) {
    where.type = input.type;
  }

  if (input.enabled !== undefined) {
    where.enabled = input.enabled;
  }

  const alerts = await prisma.alert.findMany({
    where,
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
      connection: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [{ status: "desc" }, { updatedAt: "desc" }],
  });

  return alerts;
}

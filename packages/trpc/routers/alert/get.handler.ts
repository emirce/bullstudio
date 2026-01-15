import { TRPCError } from "@trpc/server";
import type { AuthedTRPCContext } from "../../types";
import type { GetAlertInput } from "./alert.schema";

type GetAlertHandlerProps = {
  ctx: AuthedTRPCContext;
  input: GetAlertInput;
};

export async function getAlertHandler({ ctx, input }: GetAlertHandlerProps) {
  const { prisma, user } = ctx;

  const alert = await prisma.alert.findUnique({
    where: { id: input.id },
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
          workspace: {
            select: {
              id: true,
              members: {
                where: { userId: user.id },
                select: { id: true },
              },
            },
          },
        },
      },
      history: input.includeHistory
        ? {
            select: {
              id: true,
              status: true,
              value: true,
              message: true,
              createdAt: true,
            },
            orderBy: { createdAt: "desc" as const },
            take: input.historyLimit,
          }
        : false,
    },
  });

  if (!alert) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Alert not found",
    });
  }

  if (alert.connection.workspace.members.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this alert",
    });
  }

  // Remove workspace members from response
  const { connection, ...alertData } = alert;
  return {
    ...alertData,
    connection: {
      id: connection.id,
      name: connection.name,
    },
  };
}

import { TRPCError } from "@trpc/server";
import type { AuthedTRPCContext } from "../../types";
import type { UpdateAlertInput } from "./alert.schema";

type UpdateAlertHandlerProps = {
  ctx: AuthedTRPCContext;
  input: UpdateAlertInput;
};

export async function updateAlertHandler({
  ctx,
  input,
}: UpdateAlertHandlerProps) {
  const { prisma, user } = ctx;

  // Verify user has access to the alert
  const existingAlert = await prisma.alert.findUnique({
    where: { id: input.id },
    include: {
      connection: {
        include: {
          workspace: {
            include: {
              members: { where: { userId: user.id } },
            },
          },
        },
      },
    },
  });

  if (!existingAlert) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Alert not found",
    });
  }

  if (existingAlert.connection.workspace.members.length === 0) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this alert",
    });
  }

  // Check for duplicate name if name is being changed
  if (input.name && input.name !== existingAlert.name) {
    const duplicateAlert = await prisma.alert.findFirst({
      where: {
        connectionId: existingAlert.connectionId,
        queueName: input.queueName ?? existingAlert.queueName,
        name: input.name,
        id: { not: input.id },
      },
    });

    if (duplicateAlert) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "An alert with this name already exists for this queue",
      });
    }
  }

  const { id, ...updateData } = input;

  const alert = await prisma.alert.update({
    where: { id },
    data: updateData,
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

import { TRPCError } from "@trpc/server";
import type { AuthedTRPCContext } from "../../types";
import type { DeleteAlertInput } from "./alert.schema";

type DeleteAlertHandlerProps = {
  ctx: AuthedTRPCContext;
  input: DeleteAlertInput;
};

export async function deleteAlertHandler({
  ctx,
  input,
}: DeleteAlertHandlerProps) {
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

  await prisma.alert.delete({
    where: { id: input.id },
  });

  return { success: true };
}

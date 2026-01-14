import { TRPCError } from "@trpc/server";
import { Prisma, RedisConnectionStatus } from "@bullstudio/prisma";
import { AuthedTRPCContext } from "../../types";
import { encrypt, decrypt } from "../../services/encryption";
import { connectServiceClient } from "../../services/connect-service";
import { UpdateRedisConnectionInput } from "./update.schema";

type UpdateRedisConnectionHandlerProps = {
  ctx: AuthedTRPCContext;
  input: UpdateRedisConnectionInput;
};

export async function updateRedisConnectionHandler({
  ctx,
  input,
}: UpdateRedisConnectionHandlerProps) {
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

  if (input.name && input.name !== connection.name) {
    const existingWithName = await prisma.redisConnection.findFirst({
      where: {
        workspaceId: connection.workspaceId,
        name: input.name,
        id: { not: input.connectionId },
      },
    });

    if (existingWithName) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A connection with this name already exists in this workspace",
      });
    }
  }

  const updateData: Prisma.RedisConnectionUpdateInput = {};

  if (input.name !== undefined) updateData.name = input.name;
  if (input.host !== undefined) updateData.host = input.host;
  if (input.port !== undefined) updateData.port = input.port;
  if (input.database !== undefined) updateData.database = input.database;
  if (input.username !== undefined) updateData.username = input.username;
  if (input.tls !== undefined) updateData.tls = input.tls;

  if (input.password !== undefined) {
    if (input.password === null || input.password === "") {
      updateData.encryptedPassword = null;
      updateData.passwordIv = null;
      updateData.passwordTag = null;
    } else {
      const passwordData = encrypt(input.password);
      updateData.encryptedPassword = passwordData.encrypted;
      updateData.passwordIv = passwordData.iv;
      updateData.passwordTag = passwordData.tag;
    }
  }

  if (input.tlsCert !== undefined) {
    if (input.tlsCert === null || input.tlsCert === "") {
      updateData.encryptedTlsCert = null;
      updateData.tlsCertIv = null;
      updateData.tlsCertTag = null;
    } else {
      const tlsCertData = encrypt(input.tlsCert);
      updateData.encryptedTlsCert = tlsCertData.encrypted;
      updateData.tlsCertIv = tlsCertData.iv;
      updateData.tlsCertTag = tlsCertData.tag;
    }
  }

  const updated = await prisma.redisConnection.update({
    where: { id: input.connectionId },
    data: updateData,
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
      encryptedPassword: true,
      passwordIv: true,
      passwordTag: true,
      encryptedTlsCert: true,
      tlsCertIv: true,
      tlsCertTag: true,
    },
  });

  // Propagate to connect service
  try {
    // Decrypt credentials for connect service
    let password: string | undefined;
    let tlsCert: string | undefined;

    if (input.password) {
      password = input.password;
    } else if (updated.encryptedPassword && updated.passwordIv && updated.passwordTag) {
      password = decrypt({
        encrypted: updated.encryptedPassword,
        iv: updated.passwordIv,
        tag: updated.passwordTag,
      });
    }

    if (input.tlsCert) {
      tlsCert = input.tlsCert;
    } else if (updated.encryptedTlsCert && updated.tlsCertIv && updated.tlsCertTag) {
      tlsCert = decrypt({
        encrypted: updated.encryptedTlsCert,
        iv: updated.tlsCertIv,
        tag: updated.tlsCertTag,
      });
    }

    const serviceConnection = await connectServiceClient.updateConnection({
      id: updated.id,
      host: updated.host,
      port: updated.port,
      database: updated.database,
      username: updated.username ?? undefined,
      password,
      tls: updated.tls,
      tlsCert,
    });

    // Update status based on connect service response
    const newStatus =
      serviceConnection.status === "connected"
        ? RedisConnectionStatus.Connected
        : serviceConnection.status === "error"
          ? RedisConnectionStatus.Failed
          : RedisConnectionStatus.Disconnected;

    await prisma.redisConnection.update({
      where: { id: updated.id },
      data: {
        status: newStatus,
        lastConnectedAt:
          newStatus === RedisConnectionStatus.Connected ? new Date() : undefined,
        lastError: serviceConnection.error ?? null,
      },
    });

    // Return without sensitive fields
    const { encryptedPassword, passwordIv, passwordTag, encryptedTlsCert, tlsCertIv, tlsCertTag, ...result } = updated;
    return { ...result, status: newStatus };
  } catch (error) {
    console.error("[updateRedisConnection] Failed to propagate to connect service:", error);
    const { encryptedPassword, passwordIv, passwordTag, encryptedTlsCert, tlsCertIv, tlsCertTag, ...result } = updated;
    return result;
  }
}

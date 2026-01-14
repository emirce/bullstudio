import Redis, { RedisOptions } from "ioredis";
import { TRPCError } from "@trpc/server";
import { RedisConnectionStatus } from "@bullstudio/prisma";
import { AuthedTRPCContext } from "../../types";
import { decrypt } from "../../services/encryption";
import { TestRedisConnectionInput } from "./test.schema";

type TestRedisConnectionHandlerProps = {
  ctx: AuthedTRPCContext;
  input: TestRedisConnectionInput;
};

export async function testRedisConnectionHandler({
  ctx,
  input,
}: TestRedisConnectionHandlerProps) {
  const { prisma, user } = ctx;

  let password = input.password;
  let tlsCert = input.tlsCert;

  if (input.connectionId) {
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

    if (
      !password &&
      connection.encryptedPassword &&
      connection.passwordIv &&
      connection.passwordTag
    ) {
      password = decrypt({
        encrypted: connection.encryptedPassword,
        iv: connection.passwordIv,
        tag: connection.passwordTag,
      });
    }

    if (
      !tlsCert &&
      connection.encryptedTlsCert &&
      connection.tlsCertIv &&
      connection.tlsCertTag
    ) {
      tlsCert = decrypt({
        encrypted: connection.encryptedTlsCert,
        iv: connection.tlsCertIv,
        tag: connection.tlsCertTag,
      });
    }
  }

  let redis: Redis | null = null;
  const startTime = Date.now();

  try {
    const options: RedisOptions = {
      host: input.host,
      port: input.port,
      db: input.database,
      username: input.username || undefined,
      password: password || undefined,
      connectTimeout: 5000,
      commandTimeout: 5000,
      lazyConnect: true,
    };

    if (input.tls) {
      options.tls = tlsCert ? { ca: tlsCert } : {};
    }

    redis = new Redis(options);
    await redis.connect();
    await redis.ping();

    const latency = Date.now() - startTime;

    if (input.connectionId) {
      await prisma.redisConnection.update({
        where: { id: input.connectionId },
        data: {
          status: RedisConnectionStatus.Connected,
          lastConnectedAt: new Date(),
          lastHealthCheckAt: new Date(),
          lastError: null,
        },
      });
    }

    return {
      success: true,
      status: RedisConnectionStatus.Connected,
      latency,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Connection failed";

    if (input.connectionId) {
      await prisma.redisConnection.update({
        where: { id: input.connectionId },
        data: {
          status: RedisConnectionStatus.Failed,
          lastHealthCheckAt: new Date(),
          lastError: errorMessage,
        },
      });
    }

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Connection test failed: ${errorMessage}`,
    });
  } finally {
    if (redis) {
      try {
        await redis.quit();
      } catch {
        redis.disconnect();
      }
    }
  }
}

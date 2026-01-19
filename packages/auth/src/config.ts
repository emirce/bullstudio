import { NextAuthConfig } from "next-auth";
import Resend from "next-auth/providers/resend";
import { prisma } from "@bullstudio/prisma";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import { defaultClient } from "@bullstudio/email/client";
import { MagicLinkEmail, MagicLinkEmailProps } from "@bullstudio/email";
import GitHub from "next-auth/providers/github";

export const authConfig: NextAuthConfig = {
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Resend({
      from: "noreply@scheduler.barbell-consulting.com",
      sendVerificationRequest: async ({ identifier, url }) => {
        console.log("Sending magic link to:", identifier, "with URL:", url);
        const props: MagicLinkEmailProps = {
          magicLink: url,
        };
        await defaultClient.send({
          to: identifier,
          subject: "Your sign-in link for Bull Studio",
          template: MagicLinkEmail,
          props,
        });
      },
    }),
    Google,
    GitHub,
  ],
  callbacks: {
    session: async ({ session, token }) => {
      type SessionUser = {
        id: string;
        email: string;
        name?: string | null;
        organizationId?: string;
        emailVerified?: Date | null;
      };
      const existingUser = session.user as Partial<SessionUser>;
      (session.user as SessionUser) = {
        id: (token.id as string) || existingUser.id || "",
        email: (token.email as string) || existingUser.email || "",
        name: token.name || existingUser.name,
        organizationId:
          existingUser.organizationId ??
          (token.organizationId as string | undefined),
        emailVerified:
          existingUser.emailVerified ??
          (token.emailVerified as Date | null) ??
          null,
      };
      return session;
    },
    jwt: async ({ token, user, trigger }) => {
      if (user) {
        token = {
          ...token,
          ...user,
        };
      }

      if (trigger === "signIn" || trigger === "update") {
        const dbUser = await prisma.user.findUnique({
          where: {
            id: user.id,
          },
          include: {
            organizationMemberships: true,
          },
        });
        if (dbUser) {
          token = {
            ...token,
            id: dbUser.id,
            email: dbUser.email,
            name: dbUser.name,
            organizationId: dbUser.organizationMemberships[0]?.organizationId,
            emailVerified: dbUser.emailVerified ?? null,
          };
        }
      }
      return token;
    },
  },
};

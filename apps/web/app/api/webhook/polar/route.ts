import {
  prisma,
  SubscriptionPeriod,
  SubscriptionPlan,
} from "@bullstudio/prisma";
import { Webhooks } from "@polar-sh/nextjs";

const getOrgByCustomerId = async (customerId: string) =>
  prisma.organization.findFirst({
    where: { polarCustomerId: customerId },
  });

const validPlans = {
  Pro: {
    plan: SubscriptionPlan.Pro,
    period: SubscriptionPeriod.Monthly,
  },
  Enterprise: {
    plan: SubscriptionPlan.Enterprise,
    period: SubscriptionPeriod.Monthly,
  },
};

export const POST = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onPayload: async (payload) => {
    console.log("[Polar Webhook] Payload received:", payload);
  },
  onSubscriptionCreated: async (payload) => {
    const customerId = payload.data.customer.id;
    const org = await getOrgByCustomerId(customerId);

    if (!org) {
      console.warn(
        "[Polar Webhook] No organization found with customer id",
        customerId,
      );
      return;
    }

    const planName = payload.data.product.name;
    const planInfo = validPlans[planName as keyof typeof validPlans];

    if (!planInfo) {
      console.warn(
        "[Polar Webhook] Received subscription for invalid plan:",
        planName,
      );
      return;
    }

    await prisma.subscription.create({
      data: {
        organizationId: org.id,
        plan: planInfo.plan,
        period: planInfo.period,
        polarPriceId: payload.data.product.id,
        polarSubscriptionId: payload.data.id,
        periodEndsAt: payload.data.currentPeriodEnd
          ? new Date(payload.data.currentPeriodEnd)
          : null,
      },
    });

    await prisma.organization.update({
      where: { id: org.id },
      data: { subscriptionPlan: planInfo.plan },
    });

    console.log(
      `[Polar Webhook] Subscription created for org ${org.id}: ${planInfo.plan}`,
    );
  },

  onSubscriptionUpdated: async (payload) => {
    const customerId = payload.data.customer.id;
    const org = await getOrgByCustomerId(customerId);

    if (!org) {
      console.warn(
        "[Polar Webhook] No organization found with customer id",
        customerId,
      );
      return;
    }

    const planName = payload.data.product.name;
    const planInfo = validPlans[planName as keyof typeof validPlans];

    if (!planInfo) {
      console.warn(
        "[Polar Webhook] Received subscription update for invalid plan:",
        planName,
      );
      return;
    }

    await prisma.subscription.upsert({
      where: { polarSubscriptionId: payload.data.id },
      update: {
        plan: planInfo.plan,
        period: planInfo.period,
        polarPriceId: payload.data.product.id,
        periodEndsAt: payload.data.currentPeriodEnd
          ? new Date(payload.data.currentPeriodEnd)
          : null,
      },
      create: {
        organizationId: org.id,
        plan: planInfo.plan,
        period: planInfo.period,
        polarPriceId: payload.data.product.id,
        polarSubscriptionId: payload.data.id,
        periodEndsAt: payload.data.currentPeriodEnd
          ? new Date(payload.data.currentPeriodEnd)
          : null,
      },
    });

    await prisma.organization.update({
      where: { id: org.id },
      data: { subscriptionPlan: planInfo.plan },
    });

    console.log(
      `[Polar Webhook] Subscription updated for org ${org.id}: ${planInfo.plan}`,
    );
  },

  onSubscriptionCanceled: async (payload) => {
    const customerId = payload.data.customer.id;
    const org = await getOrgByCustomerId(customerId);

    if (!org) {
      console.warn(
        "[Polar Webhook] No organization found with customer id",
        customerId,
      );
      return;
    }

    // Update the subscription period end date
    // The subscription will be active until periodEndsAt
    await prisma.subscription.update({
      where: { polarSubscriptionId: payload.data.id },
      data: {
        periodEndsAt: payload.data.currentPeriodEnd
          ? new Date(payload.data.currentPeriodEnd)
          : null,
      },
    });

    console.log(
      `[Polar Webhook] Subscription canceled for org ${org.id}, will end at ${payload.data.currentPeriodEnd}`,
    );
  },

  onSubscriptionRevoked: async (payload) => {
    const customerId = payload.data.customer.id;
    const org = await getOrgByCustomerId(customerId);

    if (!org) {
      console.warn(
        "[Polar Webhook] No organization found with customer id",
        customerId,
      );
      return;
    }

    // Delete the subscription and downgrade to free
    await prisma.subscription.delete({
      where: { polarSubscriptionId: payload.data.id },
    });

    await prisma.organization.update({
      where: { id: org.id },
      data: { subscriptionPlan: SubscriptionPlan.Free },
    });

    console.log(
      `[Polar Webhook] Subscription revoked for org ${org.id}, downgraded to Free`,
    );
  },
});

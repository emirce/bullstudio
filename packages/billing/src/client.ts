// src/polar.ts
import { Polar } from "@polar-sh/sdk";
import { BILLING_ENABLED } from "./const";

let polar: Polar | null = null;

export const getPolarClient = () => {
  if (polar !== null) return polar;

  const billingEnabled = BILLING_ENABLED();

  if (!billingEnabled) {
    return null;
  }

  const accessToken = process.env.POLAR_ACCESS_TOKEN;
  if (!accessToken) {
    return null;
  }
  polar = new Polar({
    accessToken,
    server: process.env.NODE_ENV === "development" ? "sandbox" : "production",
  });
  return polar;
};

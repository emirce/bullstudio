import { describe, expect, it, vi } from "vitest";
import type { RedisConnection } from "../utils";
import { detectProvider } from "./provider-detector";

describe("detectProvider", () => {
  it("detects Bull when its marker appears on a later SCAN page", async () => {
    const scan = vi
      .fn()
      .mockResolvedValueOnce(["0", []])
      .mockResolvedValueOnce(["17", []])
      .mockResolvedValueOnce(["0", ["bull:legacy:id"]]);
    const redis = { scan } as unknown as RedisConnection;

    await expect(detectProvider(redis)).resolves.toEqual({
      type: "bull",
      confidence: "high",
      detectedFrom: "id-keys",
    });
  });
});

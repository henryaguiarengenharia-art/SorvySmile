import { describe, expect, it } from "vitest";
import { classifyAcquisitionSource, sanitizeAttribution } from "./attribution.js";
import { funnelEventFields, funnelEventId } from "./funnelMetrics.js";

describe("attribution and funnel events", () => {
  it("classifies the five controlled acquisition sources", () => {
    expect(classifyAcquisitionSource()).toBe("bio");
    expect(classifyAcquisitionSource({ utmSource: "instagram", utmMedium: "organic" })).toBe("organic");
    expect(classifyAcquisitionSource({ utmSource: "meta", utmMedium: "cpc" })).toBe("paid");
    expect(classifyAcquisitionSource({ utmSource: "partner_clinic" })).toBe("partner");
    expect(classifyAcquisitionSource({ utmCampaign: "outbound_manual" })).toBe("prospecting");
    expect(classifyAcquisitionSource({ utmCampaign: "leads_organic" })).toBe("organic");
  });

  it("creates stable ids so retries do not duplicate metrics", () => {
    expect(funnelEventId("trial_activated:acc_1")).toBe(funnelEventId("trial_activated:acc_1"));
    expect(funnelEventId("trial_activated:acc_1")).not.toBe(funnelEventId("trial_activated:acc_2"));
    expect(funnelEventFields({ eventKey: "lead:1", eventType: "lead_captured", accountId: "acc_1", source: "bio", occurredAtMs: 10 })).toMatchObject({ eventType: "lead_captured", source: "bio", occurredAtMs: 10 });
  });

  it("limits untrusted campaign fields", () => {
    expect(sanitizeAttribution({ utmCampaign: "x".repeat(300) }).utmCampaign).toHaveLength(160);
  });
});

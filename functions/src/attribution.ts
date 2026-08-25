export type AcquisitionSource = "bio" | "organic" | "paid" | "partner" | "prospecting";

export interface AttributionInput {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  referrer?: string;
  landingPath?: string;
}

function normalized(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function classifyAcquisitionSource(input: AttributionInput = {}): AcquisitionSource {
  const source = normalized(input.utmSource);
  const medium = normalized(input.utmMedium);
  const campaign = normalized(input.utmCampaign);
  const tokens = `${source} ${medium} ${campaign}`.split(/[^a-z0-9]+/).filter(Boolean);
  const has = (...values: string[]) => values.some((value) => tokens.includes(value));
  if (has("partner", "parceiro", "parceira", "referral", "affiliate")) return "partner";
  if (has("prospecting", "prospect", "prospeccao", "outbound", "cold", "manual", "dm")) return "prospecting";
  if (has("paid", "cpc", "ppc", "ad", "ads", "sponsored")) return "paid";
  if (has("organic", "instagram", "facebook", "linkedin", "youtube", "google")) return "organic";
  return "bio";
}

export function sanitizeAttribution(input: AttributionInput = {}): AttributionInput {
  const clean = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);
  return {
    utmSource: clean(input.utmSource, 100),
    utmMedium: clean(input.utmMedium, 100),
    utmCampaign: clean(input.utmCampaign, 160),
    utmContent: clean(input.utmContent, 160),
    referrer: clean(input.referrer, 500),
    landingPath: clean(input.landingPath, 300),
  };
}

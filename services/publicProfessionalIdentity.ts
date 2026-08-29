export function publicProfessionalName(value?: string | null): string {
  const name = String(value ?? "").trim();
  if (!name || name.includes("@")) return "Profissional responsável";
  return name;
}

export function isValidPublicProfessionalName(value?: string | null): boolean {
  const name = String(value ?? "").trim();
  return name.length >= 2 && !name.includes("@");
}

export function normalizeInstagramHandle(value?: string | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const withoutProtocol = raw.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  return withoutProtocol.replace(/^@+/, "").split(/[/?#]/)[0].trim();
}

export function instagramProfileUrl(value?: string | null): string {
  const handle = normalizeInstagramHandle(value);
  return handle ? `https://instagram.com/${encodeURIComponent(handle)}` : "";
}

export function normalizePublicHttpsUrl(value?: string | null): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return /^https:\/\//i.test(raw) ? raw : `https://${raw.replace(/^http:\/\//i, "")}`;
}

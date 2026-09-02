export type PublicLandingPresentation =
  | "generic"
  | "professional-loading"
  | "professional-profile"
  | "professional-unavailable";

export function publicLandingPresentation(
  slug: string | null,
  loading: boolean,
  hasProfile: boolean,
): PublicLandingPresentation {
  if (!slug) return "generic";
  if (loading) return "professional-loading";
  return hasProfile ? "professional-profile" : "professional-unavailable";
}

import { doc, getDoc, type DocumentData, type DocumentSnapshot } from "firebase/firestore";
import type { PublicProfessionalProfile } from "../types";
import { isFirebaseConfigured } from "./firebaseApp";
import { db } from "./firebaseFirestoreClient";
import { internationalWhatsAppDigits } from "./whatsapp";

function permissionDenied(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String(error.code) : "";
  const message = "message" in error ? String(error.message) : "";
  return code.includes("permission-denied") || message.includes("permission-denied");
}

function validPublicSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 80;
}

async function readPublicProfile(
  slug: string,
): Promise<DocumentSnapshot<DocumentData> | null> {
  try {
    return await getDoc(doc(db, "publicProfiles", slug));
  } catch (error) {
    // Firestore intentionally returns permission-denied for inactive profiles.
    // Treat it as unavailable without exposing an internal authorization error.
    if (permissionDenied(error)) return null;
    throw error;
  }
}

function mapPublicProfile(
  slug: string,
  snapshot: DocumentSnapshot<DocumentData> | null,
): PublicProfessionalProfile | null {
  if (!snapshot?.exists()) return null;
  return publicProfileFromData(slug, snapshot.data());
}

export function publicProfileFromData(
  slug: string,
  data: DocumentData,
  now = Date.now(),
): PublicProfessionalProfile | null {
  const renewAtMs = Number(data.renewAtMs ?? 0);
  const trialEndsAtMs = Number(data.trialEndsAtMs ?? data.trialUntil ?? 0);
  const accountId = String(data.accountId ?? "").trim();
  if (
    !validPublicSlug(slug)
    || !accountId
    || data.active !== true
    || (renewAtMs > 0 && renewAtMs <= now)
    || (data.status === "trial" && trialEndsAtMs > 0 && trialEndsAtMs <= now)
  ) {
    return null;
  }

  return {
    slug,
    accountId,
    professionalId: data.professionalId ? String(data.professionalId) : null,
    ownerType: data.ownerType === "clinic" ? "clinic" : "dentist",
    name: String(data.name ?? ""),
    whatsapp: internationalWhatsAppDigits(String(data.whatsapp ?? "")),
    specialty: String(data.specialty ?? ""),
    registrationNumber: String(data.registrationNumber ?? ""),
    city: String(data.city ?? ""),
    state: String(data.state ?? ""),
    bio: String(data.bio ?? ""),
    plan: data.plan === "network" || data.plan === "elite"
      ? "network"
      : data.plan === "pro"
        ? "pro"
        : "lite",
    active: true,
    status: data.status ?? "active",
    profileImage: String(data.profileImage ?? ""),
    coverImage: String(data.coverImage ?? ""),
    instagramHandle: String(data.instagramHandle ?? ""),
    bioLink: String(data.bioLink ?? ""),
    patientAssistant: data.patientAssistant
      ? {
          id: String(data.patientAssistant.id ?? "aury-patient-guide"),
          name: String(data.patientAssistant.name ?? "Aury"),
          roleName: String(data.patientAssistant.roleName ?? "Guia virtual"),
          description: String(data.patientAssistant.description ?? ""),
          greeting: String(data.patientAssistant.greeting ?? ""),
          avatarUrl: String(data.patientAssistant.avatarUrl ?? ""),
          fullImageUrl: String(data.patientAssistant.fullImageUrl ?? ""),
          primaryColor: String(data.patientAssistant.primaryColor ?? "#18AFA5"),
          secondaryColor: String(data.patientAssistant.secondaryColor ?? "#DDF4F6"),
          ctaText: String(data.patientAssistant.ctaText ?? "Falar com a clínica"),
          ctaLink: String(data.patientAssistant.ctaLink ?? ""),
          isCustom: data.patientAssistant.isCustom === true,
          tone: data.patientAssistant.tone,
          serviceContext: String(data.patientAssistant.serviceContext ?? ""),
        }
      : undefined,
  };
}

export async function getPublicProfile(
  requestedSlug: string,
): Promise<PublicProfessionalProfile | null> {
  if (!isFirebaseConfigured) {
    throw new Error("O ambiente Firebase ainda não foi configurado.");
  }

  const slug = requestedSlug.trim().toLowerCase();
  if (!validPublicSlug(slug)) return null;
  const directSnapshot = await readPublicProfile(slug);
  if (directSnapshot?.exists()) {
    return mapPublicProfile(slug, directSnapshot);
  }

  let currentSlug = slug;
  const visited = new Set<string>([slug]);
  for (let depth = 0; depth < 10; depth += 1) {
    const alias = await getDoc(doc(db, "publicSlugAliases", currentSlug));
    const target = String(alias.data()?.targetSlug ?? "").trim().toLowerCase();
    if (
      !alias.exists()
      || !validPublicSlug(target)
      || visited.has(target)
    ) return null;

    visited.add(target);
    currentSlug = target;
    const profileSnapshot = await readPublicProfile(currentSlug);
    if (profileSnapshot?.exists()) {
      return mapPublicProfile(currentSlug, profileSnapshot);
    }
  }
  return null;
}

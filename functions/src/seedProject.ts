const PRODUCTION_PROJECT_ID = "sorvysmile";

function firebaseConfigProjectId(value: string | undefined): string {
  if (!value) return "";
  try {
    const parsed = JSON.parse(value) as { projectId?: unknown };
    return typeof parsed.projectId === "string" ? parsed.projectId.trim() : "";
  } catch {
    return "";
  }
}

export function requireSeedProject(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const target = env.TARGET_FIREBASE_PROJECT_ID?.trim() ?? "";
  if (!target) {
    throw new Error(
      "Defina TARGET_FIREBASE_PROJECT_ID explicitamente antes de criar usuários.",
    );
  }

  if (
    target === PRODUCTION_PROJECT_ID
    && env.ALLOW_PRODUCTION_SEED !== "I_UNDERSTAND_SORVYSMILE_PRODUCTION"
  ) {
    throw new Error(
      "O projeto de produção sorvysmile está protegido contra seed acidental.",
    );
  }

  const activeProject = (
    env.GOOGLE_CLOUD_PROJECT
    || env.GCLOUD_PROJECT
    || firebaseConfigProjectId(env.FIREBASE_CONFIG)
    || ""
  ).trim();
  if (activeProject && activeProject !== target) {
    throw new Error(
      `O projeto ativo ${activeProject} não corresponde ao destino ${target}.`,
    );
  }

  return target;
}

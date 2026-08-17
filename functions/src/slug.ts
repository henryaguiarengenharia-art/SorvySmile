export const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "conta", "dentista", "login", "painel", "planos",
  "privacidade", "sorvy", "sorvy-smile", "suporte", "termos", "www",
]);

export function assertSlugAllowed(slug: string): void {
  if (RESERVED_SLUGS.has(slug)) throw new Error("Este endereço é reservado pela Sorvy.");
}

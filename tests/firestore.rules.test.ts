import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");

describe.skipIf(!hasEmulator)("regras do Firestore", () => {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId: "demo-sorvy-smile",
      firestore: { rules },
    });
  });

  beforeEach(async () => {
    await environment.clearFirestore();
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all([
        setDoc(doc(db, "publicProfiles", "ativo"), {
          active: true,
          accountId: "acc_a",
          professionalId: "pro_a",
        }),
        setDoc(doc(db, "publicProfiles", "inativo"), {
          active: false,
          accountId: "acc_b",
          professionalId: "pro_b",
        }),
        setDoc(doc(db, "users", "user_a"), {
          role: "professional",
          accountId: "acc_a",
          professionalId: "pro_a",
        }),
        setDoc(doc(db, "users", "user_b"), {
          role: "professional",
          accountId: "acc_b",
          professionalId: "pro_b",
        }),
        setDoc(doc(db, "users", "clinic_a"), {
          role: "clinic",
          accountId: "acc_a",
          professionalId: "pro_manager",
        }),
        setDoc(doc(db, "users", "hq"), { role: "hq" }),
        setDoc(doc(db, "accounts", "acc_a"), {
          status: "active",
          accountName: "Conta A",
        }),
        setDoc(doc(db, "accounts", "acc_b"), {
          status: "active",
          accountName: "Conta B",
        }),
        setDoc(doc(db, "professionals", "pro_a"), {
          accountId: "acc_a",
          name: "Profissional A",
          plan: "pro",
        }),
        setDoc(doc(db, "professionals", "pro_c"), {
          accountId: "acc_a",
          name: "Profissional C",
          plan: "network",
        }),
        setDoc(doc(db, "leads", "lead_a"), {
          accountId: "acc_a",
          professionalId: "pro_a",
          status: "new",
          lead: { name: "Paciente", whatsapp: "5511999999999" },
        }),
        setDoc(doc(db, "leads", "lead_b"), {
          accountId: "acc_b",
          professionalId: "pro_b",
          status: "new",
          lead: { name: "Outro", whatsapp: "5511888888888" },
        }),
        setDoc(doc(db, "leads", "lead_c"), {
          accountId: "acc_a",
          professionalId: "pro_c",
          status: "new",
          lead: { name: "Terceiro", whatsapp: "5511777777777" },
        }),
        setDoc(doc(db, "triageSessions", "session_a"), {
          uid: "anon",
          accountId: "acc_a",
        }),
        setDoc(doc(db, "usage", "acc_a_2026-07"), {
          accountId: "acc_a",
          month: "2026-07",
          triages: 3,
        }),
        setDoc(doc(db, "analysisCache", "visual-calibration-v1_hash"), {
          scores: { harmonyIndex: 60 },
          expiresAtMs: Date.now() + 86_400_000,
        }),
        setDoc(doc(db, "publicSlugAliases", "antigo"), {
          targetSlug: "ativo",
        }),
        setDoc(doc(db, "dailyPosts", "publicado"), {
          title: "Post publicado",
          status: "published",
        }),
        setDoc(doc(db, "dailyPosts", "rascunho"), {
          title: "Rascunho",
          status: "draft",
        }),
        setDoc(doc(db, "dailyPostTemplates", "template_publicado"), { title: "Template", status: "published" }),
        setDoc(doc(db, "dailyPostTemplates", "template_rascunho"), { title: "Template interno", status: "draft" }),
        setDoc(doc(db, "professionalContentPreferences", "pro_a"), { professionalId: "pro_a", accountId: "acc_a" }),
        setDoc(doc(db, "professionalContentPreferences", "pro_b"), { professionalId: "pro_b", accountId: "acc_b" }),
        setDoc(doc(db, "dailyPostAssignments", "pro_a_2026-08-17"), { professionalId: "pro_a", accountId: "acc_a", status: "assigned" }),
        setDoc(doc(db, "dailyPostAssignments", "pro_b_2026-08-17"), { professionalId: "pro_b", accountId: "acc_b", status: "assigned" }),
        setDoc(doc(db, "dailyPostEvents", "event_a"), { professionalId: "pro_a", accountId: "acc_a" }),
        setDoc(doc(db, "adminAuditLogs", "audit_a"), {
          accountId: "acc_a",
          action: "account_status_changed",
        }),
        setDoc(doc(db, "subscriptionHistory", "history_a"), {
          accountId: "acc_a",
          toStatus: "active",
        }),
        setDoc(doc(db, "assistantUsage", "user_a_2026-08-17"), {
          uid: "user_a",
          count: 1,
        }),
        setDoc(doc(db, "assistantDefinitions", "sofia-conversion"), { name: "Sofia", status: "active" }),
        setDoc(doc(db, "assistantKnowledge", "conversion-v1"), { status: "approved" }),
        setDoc(doc(db, "accountAssistantSettings", "acc_a"), { accountId: "acc_a", monthlyLimit: 100 }),
        setDoc(doc(db, "customAssistantProfiles", "custom_acc_a"), { accountId: "acc_a", name: "Cliente A" }),
        setDoc(doc(db, "assistantConversations", "conversation_a"), { accountId: "acc_a", professionalId: "pro_a", userId: "user_a" }),
        setDoc(doc(db, "assistantConversations", "conversation_a", "messages", "message_a"), { role: "assistant", sanitizedContent: "Resumo" }),
        setDoc(doc(db, "assistantActions", "action_a"), { accountId: "acc_a", status: "proposed" }),
        setDoc(doc(db, "assistantAuditLogs", "assistant_audit_a"), { accountId: "acc_a", eventType: "response_generated" }),
      ]);
    });
  });

  afterAll(async () => {
    await environment.cleanup();
  });

  it("expõe somente perfis públicos ativos", async () => {
    const anonymous = environment.unauthenticatedContext().firestore();
    await assertSucceeds(getDoc(doc(anonymous, "publicProfiles", "ativo")));
    await assertFails(getDoc(doc(anonymous, "publicProfiles", "inativo")));
  });

  it("impede leitura direta de leads e sessões sem login", async () => {
    const anonymous = environment.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonymous, "leads", "lead_a")));
    await assertFails(getDoc(doc(anonymous, "triageSessions", "session_a")));
  });

  it("não expõe o cache temporário nem mesmo para usuários internos", async () => {
    const anonymous = environment.unauthenticatedContext().firestore();
    const hq = environment.authenticatedContext("hq").firestore();
    const cache = doc(anonymous, "analysisCache", "visual-calibration-v1_hash");

    await assertFails(getDoc(cache));
    await assertFails(
      getDoc(doc(hq, "analysisCache", "visual-calibration-v1_hash")),
    );
  });

  it("limita o profissional aos leads atribuídos a ele", async () => {
    const professional = environment
      .authenticatedContext("user_a")
      .firestore();
    await assertSucceeds(getDoc(doc(professional, "accounts", "acc_a")));
    await assertSucceeds(getDoc(doc(professional, "leads", "lead_a")));
    await assertFails(getDoc(doc(professional, "accounts", "acc_b")));
    await assertFails(getDoc(doc(professional, "leads", "lead_b")));
    await assertFails(getDoc(doc(professional, "leads", "lead_c")));
    await assertSucceeds(
      getDoc(doc(professional, "usage", "acc_a_2026-07")),
    );
  });

  it("permite ao administrador da clínica gerenciar toda a própria equipe", async () => {
    const clinic = environment.authenticatedContext("clinic_a").firestore();
    await assertSucceeds(getDoc(doc(clinic, "leads", "lead_a")));
    await assertSucceeds(getDoc(doc(clinic, "leads", "lead_c")));
    await assertSucceeds(getDoc(doc(clinic, "professionals", "pro_a")));
    await assertSucceeds(getDoc(doc(clinic, "professionals", "pro_c")));
    await assertFails(getDoc(doc(clinic, "leads", "lead_b")));
  });

  it("impede alteração direta de cobrança até mesmo pelo HQ", async () => {
    const hq = environment.authenticatedContext("hq").firestore();
    await assertFails(
      updateDoc(doc(hq, "accounts", "acc_a"), {
        status: "active",
        paymentStatus: "confirmed",
      }),
    );
  });

  it("permite somente campos de CRM no lead", async () => {
    const professional = environment
      .authenticatedContext("user_a")
      .firestore();
    await assertSucceeds(
      updateDoc(doc(professional, "leads", "lead_a"), {
        status: "in_chat",
        firstContactAt: 123,
        updatedAtMs: 123,
      }),
    );
    await assertFails(
      updateDoc(doc(professional, "leads", "lead_a"), {
        accountId: "acc_b",
        updatedAtMs: 124,
      }),
    );
    await assertFails(
      setDoc(doc(professional, "leads", "new_lead"), {
        accountId: "acc_a",
        status: "new",
      }),
    );
  });

  it("protege plano e vínculo do perfil profissional", async () => {
    const professional = environment
      .authenticatedContext("user_a")
      .firestore();
    await assertSucceeds(
      updateDoc(doc(professional, "professionals", "pro_a"), {
        city: "Belo Horizonte",
        state: "MG",
        updatedAtMs: 123,
      }),
    );
    await assertFails(
      updateDoc(doc(professional, "professionals", "pro_a"), {
        profileImage: "javascript:alert(1)",
        updatedAtMs: 124,
      }),
    );
    await assertFails(
      updateDoc(doc(professional, "professionals", "pro_a"), {
        plan: "network",
        updatedAtMs: 125,
      }),
    );
  });

  it("permite ao HQ auditar todas as contas e leads", async () => {
    const hq = environment.authenticatedContext("hq").firestore();
    await assertSucceeds(getDoc(doc(hq, "accounts", "acc_b")));
    await assertSucceeds(getDoc(doc(hq, "leads", "lead_b")));
  });

  it("preserva links antigos sem permitir escrita direta de aliases", async () => {
    const anonymous = environment.unauthenticatedContext().firestore();
    const hq = environment.authenticatedContext("hq").firestore();
    await assertSucceeds(getDoc(doc(anonymous, "publicSlugAliases", "antigo")));
    await assertFails(
      setDoc(doc(hq, "publicSlugAliases", "manual"), { targetSlug: "ativo" }),
    );
  });

  it("entrega somente o Post do Dia publicado aos assinantes", async () => {
    const professional = environment.authenticatedContext("user_a").firestore();
    const hq = environment.authenticatedContext("hq").firestore();
    await assertSucceeds(getDoc(doc(professional, "dailyPosts", "publicado")));
    await assertFails(getDoc(doc(professional, "dailyPosts", "rascunho")));
    await assertSucceeds(getDoc(doc(hq, "dailyPosts", "rascunho")));
    await assertFails(
      updateDoc(doc(hq, "dailyPosts", "publicado"), { title: "Alterado direto" }),
    );
  });

  it("isola templates, preferências, atribuições e eventos por profissional", async () => {
    const professional = environment.authenticatedContext("user_a").firestore();
    const clinic = environment.authenticatedContext("clinic_a").firestore();
    const hq = environment.authenticatedContext("hq").firestore();
    await assertSucceeds(getDoc(doc(professional, "dailyPostTemplates", "template_publicado")));
    await assertFails(getDoc(doc(professional, "dailyPostTemplates", "template_rascunho")));
    await assertSucceeds(getDoc(doc(professional, "professionalContentPreferences", "pro_a")));
    await assertFails(getDoc(doc(professional, "professionalContentPreferences", "pro_b")));
    await assertSucceeds(getDoc(doc(professional, "dailyPostAssignments", "pro_a_2026-08-17")));
    await assertFails(getDoc(doc(professional, "dailyPostAssignments", "pro_b_2026-08-17")));
    await assertSucceeds(getDoc(doc(clinic, "dailyPostAssignments", "pro_a_2026-08-17")));
    await assertFails(getDoc(doc(professional, "dailyPostEvents", "event_a")));
    await assertSucceeds(getDoc(doc(hq, "dailyPostEvents", "event_a")));
    await assertFails(updateDoc(doc(hq, "dailyPostTemplates", "template_publicado"), { title: "Direto" }));
  });

  it("restringe auditoria ao HQ e bloqueia dados internos do assistente", async () => {
    const professional = environment.authenticatedContext("user_a").firestore();
    const hq = environment.authenticatedContext("hq").firestore();
    await assertFails(getDoc(doc(professional, "adminAuditLogs", "audit_a")));
    await assertFails(getDoc(doc(professional, "subscriptionHistory", "history_a")));
    await assertSucceeds(getDoc(doc(hq, "adminAuditLogs", "audit_a")));
    await assertSucceeds(getDoc(doc(hq, "subscriptionHistory", "history_a")));
    await assertFails(getDoc(doc(professional, "assistantUsage", "user_a_2026-08-17")));
    await assertFails(getDoc(doc(hq, "assistantUsage", "user_a_2026-08-17")));
    for (const path of [
      ["assistantDefinitions", "sofia-conversion"],
      ["assistantKnowledge", "conversion-v1"],
      ["accountAssistantSettings", "acc_a"],
      ["customAssistantProfiles", "custom_acc_a"],
      ["assistantConversations", "conversation_a"],
      ["assistantActions", "action_a"],
      ["assistantAuditLogs", "assistant_audit_a"],
    ]) {
      await assertFails(getDoc(doc(professional, path[0], path[1])));
      await assertFails(getDoc(doc(hq, path[0], path[1])));
    }
    await assertFails(getDoc(doc(professional, "assistantConversations", "conversation_a", "messages", "message_a")));
  });
});

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
        setDoc(doc(db, "triageSessions", "session_a"), {
          uid: "anon",
          accountId: "acc_a",
        }),
        setDoc(doc(db, "usage", "acc_a_2026-07"), {
          accountId: "acc_a",
          month: "2026-07",
          triages: 3,
        }),
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

  it("limita o profissional à própria conta", async () => {
    const professional = environment
      .authenticatedContext("user_a")
      .firestore();
    await assertSucceeds(getDoc(doc(professional, "accounts", "acc_a")));
    await assertSucceeds(getDoc(doc(professional, "leads", "lead_a")));
    await assertFails(getDoc(doc(professional, "accounts", "acc_b")));
    await assertFails(getDoc(doc(professional, "leads", "lead_b")));
    await assertSucceeds(
      getDoc(doc(professional, "usage", "acc_a_2026-07")),
    );
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
        plan: "elite",
        updatedAtMs: 124,
      }),
    );
  });

  it("permite ao HQ auditar todas as contas e leads", async () => {
    const hq = environment.authenticatedContext("hq").firestore();
    await assertSucceeds(getDoc(doc(hq, "accounts", "acc_b")));
    await assertSucceeds(getDoc(doc(hq, "leads", "lead_b")));
  });
});

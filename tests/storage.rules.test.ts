import { readFileSync } from "node:fs";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const hasEmulators = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_STORAGE_EMULATOR_HOST);
const firestoreRules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
const storageRules = readFileSync(new URL("../storage.rules", import.meta.url), "utf8");

describe.skipIf(!hasEmulators)("regras de imagens do perfil profissional", () => {
  let environment: RulesTestEnvironment;

  beforeAll(async () => {
    environment = await initializeTestEnvironment({
      projectId: "demo-sorvy-smile",
      firestore: { rules: firestoreRules },
      storage: { rules: storageRules },
    });
  });

  beforeEach(async () => {
    await Promise.all([environment.clearFirestore(), environment.clearStorage()]);
    await environment.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await Promise.all([
        setDoc(doc(db, "users", "owner"), { role: "professional", accountId: "acc_a" }),
        setDoc(doc(db, "users", "outsider"), { role: "professional", accountId: "acc_b", professionalId: "pro_b" }),
        setDoc(doc(db, "professionals", "pro_a"), { accountId: "acc_a", ownerUid: "owner" }),
      ]);
    });
  });

  afterAll(async () => environment.cleanup());

  it("permite ao ownerUid antigo enviar sua própria capa", async () => {
    const target = environment.authenticatedContext("owner").storage().ref("professional-assets/acc_a/pro_a/cover-test.webp");
    await assertSucceeds(target.put(new Uint8Array([1, 2, 3]), { contentType: "image/webp" }));
  });

  it("permite ao titular do cadastro direto enviar imagem mesmo sem documentos auxiliares", async () => {
    const uid = "aNwSY7r7w5SwlgE0NdvEzeKp5v73";
    const target = environment
      .authenticatedContext(uid)
      .storage()
      .ref(`professional-assets/acc_${uid}/pro_${uid}/cover-1788029644590.png`);

    await assertSucceeds(
      target.put(new Uint8Array([1, 2, 3]), { contentType: "image/png" }),
    );
  });

  it("não permite usar o padrão determinístico de outro usuário", async () => {
    const ownerUid = "aNwSY7r7w5SwlgE0NdvEzeKp5v73";
    const target = environment
      .authenticatedContext("different-user")
      .storage()
      .ref(`professional-assets/acc_${ownerUid}/pro_${ownerUid}/cover-1788029644590.png`);

    await assertFails(
      target.put(new Uint8Array([1]), { contentType: "image/png" }),
    );
  });

  it("nega arquivo em conta divergente e acesso de outro profissional", async () => {
    const wrongAccount = environment.authenticatedContext("owner").storage().ref("professional-assets/acc_b/pro_a/cover-test.webp");
    const outsider = environment.authenticatedContext("outsider").storage().ref("professional-assets/acc_a/pro_a/cover-test.webp");
    await assertFails(wrongAccount.put(new Uint8Array([1]), { contentType: "image/webp" }));
    await assertFails(outsider.put(new Uint8Array([1]), { contentType: "image/webp" }));
  });
});

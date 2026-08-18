import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { ASSISTANT_DEFINITIONS, ASSISTANT_KNOWLEDGE } from "./assistantDefinitions.js";

if (getApps().length === 0) initializeApp();

const projectId = process.env.TARGET_FIREBASE_PROJECT_ID
  ?? process.env.GOOGLE_CLOUD_PROJECT
  ?? process.env.GCLOUD_PROJECT;
if (projectId !== "sorvysmile-homologacao") {
  throw new Error("Defina explicitamente o projeto de homologação antes de executar o seed das assistentes.");
}

const db = getFirestore();
const batch = db.batch();
const now = Date.now();
const definitionRefs = ASSISTANT_DEFINITIONS.map((definition) => db.doc(`assistantDefinitions/${definition.id}`));
const knowledgeRefs = ASSISTANT_KNOWLEDGE.map((entry) => db.doc(`assistantKnowledge/${entry.id}`));
const snapshots = await Promise.all([...definitionRefs, ...knowledgeRefs].map((reference) => reference.get()));
const existingByPath = new Map(snapshots.map((snapshot) => [snapshot.ref.path, snapshot.data()]));
for (const [index, definition] of ASSISTANT_DEFINITIONS.entries()) {
  const reference = definitionRefs[index];
  batch.set(reference, {
    ...definition,
    createdAtMs: existingByPath.get(reference.path)?.createdAtMs ?? now,
    updatedAtMs: now,
  }, { merge: true });
}
for (const [index, entry] of ASSISTANT_KNOWLEDGE.entries()) {
  const reference = knowledgeRefs[index];
  batch.set(reference, {
    ...entry,
    createdAtMs: existingByPath.get(reference.path)?.createdAtMs ?? now,
    updatedAtMs: now,
  }, { merge: true });
}
await batch.commit();
console.log(`Definições de assistentes atualizadas em ${projectId}.`);

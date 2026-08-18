import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { DAILY_POST_TEMPLATES } from "./dailyPostLibrary.js";
import { requireSeedProject } from "./seedProject.js";

const projectId = requireSeedProject();
if (getApps().length === 0) initializeApp({ projectId });
const db = getFirestore();
const now = Date.now();
const writer = db.bulkWriter();

for (const template of DAILY_POST_TEMPLATES) {
  const { availableFrom: _availableFrom, availableUntil: _availableUntil, ...data } = template;
  writer.set(db.doc(`dailyPostTemplates/${template.id}`), {
    ...data,
    availableFromMs: null,
    availableUntilMs: null,
    createdAtMs: now,
    updatedAtMs: now,
    publishedAtMs: now,
    createdBy: "seed:daily-posts-v2",
    updatedBy: "seed:daily-posts-v2",
  }, { merge: true });
}

await writer.close();
const count = await db.collection("dailyPostTemplates").where("createdBy", "==", "seed:daily-posts-v2").count().get();
if (count.data().count !== 60) throw new Error(`A biblioteca inicial deveria conter 60 templates, mas contém ${count.data().count}.`);
console.log(`Biblioteca inicial validada: ${count.data().count} templates em ${projectId}.`);

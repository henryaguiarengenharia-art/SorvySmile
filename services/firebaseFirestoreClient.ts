import {
  connectFirestoreEmulator,
  getFirestore,
} from "firebase/firestore";
import { firebaseApp, useFirebaseEmulators } from "./firebaseApp";

export const db = getFirestore(firebaseApp);

if (useFirebaseEmulators && typeof window !== "undefined") {
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

import {
  connectAuthEmulator,
  getAuth,
} from "firebase/auth";
import {
  connectFunctionsEmulator,
  getFunctions,
} from "firebase/functions";
import {
  firebaseApp,
  isFirebaseConfigured,
  useFirebaseEmulators,
} from "./firebaseApp";
import { db } from "./firebaseFirestoreClient";

export { db, isFirebaseConfigured };

export const auth = getAuth(firebaseApp);
export const functions = getFunctions(firebaseApp, "southamerica-east1");

if (useFirebaseEmulators && typeof window !== "undefined") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}

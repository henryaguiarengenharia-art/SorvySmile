import { connectStorageEmulator, getStorage } from "firebase/storage";
import { firebaseApp, useFirebaseEmulators } from "./firebaseApp";

export const storage = getStorage(firebaseApp);

if (useFirebaseEmulators && typeof window !== "undefined") {
  connectStorageEmulator(storage, "127.0.0.1", 9199);
}

import "server-only";
import { cache } from "react";
import { firebaseAdmin } from "./admin";

/** users/{uid} una sola vez por request (layout + home lo leen los dos). */
export const getUserProfileSnapshot = cache(async (uid: string) =>
  firebaseAdmin().db.collection("users").doc(uid).get(),
);

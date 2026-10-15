import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { decryptSecret, encryptSecret } from "./crypto";
import { requireMercadoPagoOAuthEnv } from "./config";
import { refreshSellerToken } from "./oauth";

export type MpConnectionStatus = "connected" | "reconnect_required" | "disconnected";
export type MpConnection = {
  sellerId: string;
  status: MpConnectionStatus;
  liveMode: boolean;
  expiresAt: FirebaseFirestore.Timestamp | null;
  publicKey: string | null;
  lastError: string | null;
  connectedAt?: FirebaseFirestore.Timestamp | null;
};

const integrationRef = (tenantId: string) =>
  firebaseAdmin().db.collection("tenants").doc(tenantId).collection("integrations").doc("mercadopago");

export async function getMpConnection(tenantId: string): Promise<MpConnection | null> {
  const snapshot = await integrationRef(tenantId).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data()!;
  return {
    sellerId: String(data.sellerId ?? ""),
    status: (data.status ?? "disconnected") as MpConnectionStatus,
    liveMode: Boolean(data.liveMode),
    expiresAt: data.expiresAt ?? null,
    publicKey: data.publicKey ?? null,
    lastError: data.lastError ?? null,
    connectedAt: data.connectedAt ?? null,
  };
}

export async function saveMpConnection(tenantId: string, response: {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number;
  live_mode?: boolean;
  public_key?: string;
}) {
  if (!response.access_token || !response.refresh_token || !response.user_id) {
    throw new Error("Mercado Pago no devolviÃ³ credenciales completas");
  }
  const expiresAt = Timestamp.fromMillis(Date.now() + Math.max(60, Number(response.expires_in ?? 21_600)) * 1000);
  const db = firebaseAdmin().db;
  const ref = integrationRef(tenantId);
  await db.runTransaction(async (transaction) => {
    transaction.set(ref, {
      sellerId: String(response.user_id),
      status: "connected",
      liveMode: Boolean(response.live_mode),
      publicKey: response.public_key ?? null,
      accessTokenEncrypted: encryptSecret(response.access_token!),
      refreshTokenEncrypted: encryptSecret(response.refresh_token!),
      expiresAt,
      connectedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastError: null,
    }, { merge: true });
    transaction.set(db.collection("mpSellers").doc(String(response.user_id)), {
      tenantId,
      status: "connected",
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

export const oauthRepository = {
  save: saveMpConnection,
  rotate: saveMpConnection,
};

export async function sellerAccessToken(tenantId: string): Promise<string> {
  const ref = integrationRef(tenantId);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data()?.status !== "connected") {
    throw new Error("ConectÃ¡ Mercado Pago para habilitar reservas online");
  }
  const data = snapshot.data()!;
  const expiresAt = data.expiresAt?.toMillis?.() ?? 0;
  if (expiresAt > Date.now() + 5 * 60_000) return decryptSecret(String(data.accessTokenEncrypted));

  requireMercadoPagoOAuthEnv();
  try {
    const refreshed = await refreshSellerToken(decryptSecret(String(data.refreshTokenEncrypted)));
    await oauthRepository.rotate(tenantId, refreshed);
    return String(refreshed.access_token);
  } catch (error) {
    await ref.set({ status: "reconnect_required", lastError: "No se pudo renovar la conexiÃ³n", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw error;
  }
}

export async function disconnectMp(tenantId: string) {
  const db = firebaseAdmin().db;
  const ref = integrationRef(tenantId);
  const current = await ref.get();
  const sellerId = current.data()?.sellerId;
  await ref.set({ status: "disconnected", accessTokenEncrypted: FieldValue.delete(), refreshTokenEncrypted: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  if (sellerId) await db.collection("mpSellers").doc(String(sellerId)).set({ status: "disconnected", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
}

import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firebaseAdmin } from "@/server/firebase/admin";
import { decryptSecret, encryptSecret } from "./crypto";
import { requireMercadoPagoOAuthEnv } from "./config";
import { refreshSellerToken } from "./oauth";
import { isTransferReady } from "@/server/public-booking/payment-methods";

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
    throw new Error("Mercado Pago no devolvió credenciales completas");
  }
  const expiresAt = Timestamp.fromMillis(Date.now() + Math.max(60, Number(response.expires_in ?? 21_600)) * 1000);
  const db = firebaseAdmin().db;
  const ref = integrationRef(tenantId);
  const sellerId = String(response.user_id);
  const sellerRef = db.collection("mpSellers").doc(sellerId);
  await db.runTransaction(async (transaction) => {
    const [currentConnection, currentSeller] = await Promise.all([
      transaction.get(ref),
      transaction.get(sellerRef),
    ]);
    const mappedTenantId = currentSeller.data()?.tenantId;
    if (currentSeller.exists && currentSeller.data()?.status === "connected" && mappedTenantId !== tenantId) {
      throw new Error("Esta cuenta de Mercado Pago ya está conectada a otro negocio");
    }

    const previousSellerId = currentConnection.data()?.sellerId
      ? String(currentConnection.data()!.sellerId)
      : null;
    if (previousSellerId && previousSellerId !== sellerId) {
      const previousSellerRef = db.collection("mpSellers").doc(previousSellerId);
      const previousSeller = await transaction.get(previousSellerRef);
      if (previousSeller.data()?.tenantId === tenantId) {
        transaction.set(previousSellerRef, {
          status: "disconnected",
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }

    transaction.set(ref, {
      sellerId,
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
    transaction.set(sellerRef, {
      tenantId,
      status: "connected",
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.update(db.collection("tenants").doc(tenantId), {
      "settings.publicBookingEnabled": true,
      updatedAt: FieldValue.serverTimestamp(),
    });
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
    throw new Error("Conectá Mercado Pago para habilitar reservas online");
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
    await ref.set({ status: "reconnect_required", lastError: "No se pudo renovar la conexión", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw error;
  }
}

export async function disconnectMp(tenantId: string) {
  const db = firebaseAdmin().db;
  const ref = integrationRef(tenantId);
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    const sellerId = current.data()?.sellerId ? String(current.data()!.sellerId) : null;
    const sellerRef = sellerId ? db.collection("mpSellers").doc(sellerId) : null;
    const seller = sellerRef ? await transaction.get(sellerRef) : null;
    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenant = await transaction.get(tenantRef);
    // Con la transferencia lista el turnero sigue andando sin Mercado Pago:
    // solo se pausa si no queda ningún medio para cobrar la seña.
    const transferReady = isTransferReady(tenant.data()?.settings?.payments?.transfer);

    transaction.set(ref, {
      status: "disconnected",
      accessTokenEncrypted: FieldValue.delete(),
      refreshTokenEncrypted: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    if (!transferReady) {
      transaction.update(tenantRef, {
        "settings.publicBookingEnabled": false,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    if (sellerRef && seller?.data()?.tenantId === tenantId) {
      transaction.set(sellerRef, {
        status: "disconnected",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  });
}

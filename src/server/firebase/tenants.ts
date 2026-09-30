import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { firebaseAdmin } from "./admin";

export type BusinessHours = {
  weekday: number;
  opensAt: string;
  closesAt: string;
};

export type TenantRecord = {
  id: string;
  name: string;
  slug: string;
  businessTypeId: string;
  timezone: string;
  status: "trial" | "active" | "suspended";
  settings: {
    slotIntervalMin: number;
    minNoticeMin: number;
    booksByStaff: boolean;
    depositType: "none" | "fixed" | "percent";
    depositValue: number;
    depositMin: number;
  };
  businessHours: BusinessHours[];
};

function normalizedSlug(value: string) {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("La URL del turnero solo puede usar letras, nÃºmeros y guiones");
  }
  return slug;
}

export async function createTenantForOwner(input: {
  ownerUid: string;
  name: string;
  slug: string;
  businessTypeId: string;
  businessHours: BusinessHours[];
}) {
  const { db } = firebaseAdmin();
  const slug = normalizedSlug(input.slug);
  const tenantRef = db.collection("tenants").doc();
  const slugRef = db.collection("tenantSlugs").doc(slug);
  const memberRef = tenantRef.collection("members").doc(input.ownerUid);
  const userMembershipRef = db.collection("users").doc(input.ownerUid).collection("memberships").doc(tenantRef.id);

  const tenant: TenantRecord = {
    id: tenantRef.id,
    name: input.name.trim(),
    slug,
    businessTypeId: input.businessTypeId,
    timezone: "America/Argentina/Buenos_Aires",
    status: "trial",
    settings: {
      slotIntervalMin: 15,
      minNoticeMin: 60,
      booksByStaff: true,
      depositType: "none",
      depositValue: 0,
      depositMin: 0,
    },
    businessHours: input.businessHours,
  };

  await db.runTransaction(async (transaction) => {
    if ((await transaction.get(slugRef)).exists) {
      throw new Error("Esa URL de turnero ya estÃ¡ en uso, probÃ¡ con otra");
    }

    transaction.create(tenantRef, { ...tenant, createdAt: FieldValue.serverTimestamp() });
    transaction.create(slugRef, { tenantId: tenant.id, createdAt: FieldValue.serverTimestamp() });
    transaction.create(memberRef, { uid: input.ownerUid, role: "owner", status: "active", createdAt: FieldValue.serverTimestamp() });
    transaction.set(
      userMembershipRef,
      { tenantId: tenant.id, slug: tenant.slug, role: "owner", status: "active", createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    transaction.set(
      db.collection("users").doc(input.ownerUid),
      { updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  });

  return tenant;
}

export async function getTenantBySlugFromFirebase(slug: string) {
  const { db } = firebaseAdmin();
  const slugSnapshot = await db.collection("tenantSlugs").doc(normalizedSlug(slug)).get();
  const tenantId = slugSnapshot.data()?.tenantId;
  if (typeof tenantId !== "string") return null;

  const tenantSnapshot = await db.collection("tenants").doc(tenantId).get();
  if (!tenantSnapshot.exists) return null;
  return tenantSnapshot.data() as TenantRecord & { createdAt?: Timestamp };
}

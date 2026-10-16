import "server-only";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { PlanId } from "@/lib/plans";
import type { Gender } from "@/lib/gender";
import { sameHours, type FlatHours } from "@/components/ui/hours-editor-model";
import { firebaseAdmin } from "./admin";

export type BusinessHours = {
  weekday: number;
  opensAt: string;
  closesAt: string;
};

/** Seña por transferencia: el turno queda pendiente hasta que la dueña confirma el comprobante. */
export type TransferSettings = {
  enabled: boolean;
  alias: string;
  cbu: string | null;
  holderName: string;
  bankName: string | null;
};

export type TenantRecord = {
  id: string;
  name: string;
  slug: string;
  businessTypeId: string;
  timezone: string;
  status: "trial" | "active" | "suspended";
  /** Ver src/lib/plans.ts -- sin dato = Equipo (locales anteriores a los planes). */
  plan?: PlanId;
  teamMode?: "solo" | "team";
  address?: string | null;
  logoUrl?: string | null;
  instagramUrl?: string | null;
  whatsappNumber?: string | null;
  /** Bajada corta que se muestra arriba del turnero público. */
  description?: string | null;
  settings: {
    payments?: {
      /** Default true: los locales previos solo tenían Mercado Pago. */
      mercadopagoEnabled?: boolean;
      transfer?: TransferSettings;
    };
    slotIntervalMin: number;
    minNoticeMin: number;
    booksByStaff: boolean;
    depositType: "none" | "fixed" | "percent";
    depositValue: number;
    depositMin: number;
    maxBookingDays?: number;
    mpFeeMode?: "absorbed" | "passed_through";
    mpFeePercent?: number;
    publicBookingEnabled?: boolean;
  };
  businessHours: BusinessHours[];
};

function normalizedSlug(value: string) {
  const slug = value.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("La URL del turnero solo puede usar letras, números y guiones");
  }
  return slug;
}

export async function isTenantSlugTaken(value: string) {
  const slug = normalizedSlug(value);
  return (await firebaseAdmin().db.collection("tenantSlugs").doc(slug).get()).exists;
}

/** Color de agenda de la dueña: el violeta de la marca. */
export const OWNER_STAFF_COLOR = "#7069e8";

// Imágenes guardadas como data URL en Firestore (logo, avatar, foto de
// staff): solo raster y con techo de 400 KB, lejos del 1 MB por documento.
const IMAGE_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
export const MAX_IMAGE_DATA_URL_LENGTH = 400 * 1024;

export function isStorableImageDataUrl(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_IMAGE_DATA_URL_LENGTH && IMAGE_DATA_URL.test(value);
}

/** Horario propio del staff (shape de staff.schedules) a partir de los horarios del local. */
export function ownerStaffSchedules(hours: BusinessHours[]) {
  return hours.map((hour) => ({ weekday: hour.weekday, starts_at: hour.opensAt, ends_at: hour.closesAt }));
}

function toFlat(hours: BusinessHours[]): FlatHours[] {
  return hours.map((hour) => ({ weekday: hour.weekday, opens_at: hour.opensAt, closes_at: hour.closesAt }));
}

export type OwnerProfileInput = {
  fullName: string;
  gender: Gender;
  /** Se calcula de la edad que carga en el onboarding; null si no la quiso dar. */
  birthYear: number | null;
  avatarUrl: string | null;
  contactEmail: string | null;
};

export async function createTenantForOwner(input: {
  ownerUid: string;
  name: string;
  slug: string;
  businessTypeId: string;
  businessHours: BusinessHours[];
  address?: string | null;
  logoUrl?: string | null;
  plan?: PlanId;
  teamMode?: "solo" | "team";
  owner?: OwnerProfileInput;
}) {
  const { db } = firebaseAdmin();
  const slug = normalizedSlug(input.slug);
  const tenantRef = db.collection("tenants").doc();
  const slugRef = db.collection("tenantSlugs").doc(slug);
  const memberRef = tenantRef.collection("members").doc(input.ownerUid);
  const userRef = db.collection("users").doc(input.ownerUid);
  const userMembershipRef = userRef.collection("memberships").doc(tenantRef.id);
  // La dueña también atiende: sin este staff un local recién creado no tiene
  // a nadie que pueda recibir turnos.
  const ownerStaffRef = tenantRef.collection("staff").doc();

  const tenant: TenantRecord = {
    id: tenantRef.id,
    name: input.name.trim(),
    slug,
    businessTypeId: input.businessTypeId,
    timezone: "America/Argentina/Buenos_Aires",
    status: "trial",
    ...(input.plan ? { plan: input.plan } : {}),
    ...(input.teamMode ? { teamMode: input.teamMode } : {}),
    address: input.address?.trim() || null,
    logoUrl: input.logoUrl ?? null,
    settings: {
      slotIntervalMin: 15,
      minNoticeMin: 60,
      booksByStaff: true,
      depositType: "none",
      depositValue: 0,
      depositMin: 0,
      maxBookingDays: 60,
      mpFeeMode: "absorbed",
      mpFeePercent: 0,
      publicBookingEnabled: false,
    },
    businessHours: input.businessHours,
  };

  await db.runTransaction(async (transaction) => {
    const [slugSnapshot, userSnapshot] = await Promise.all([transaction.get(slugRef), transaction.get(userRef)]);
    if (slugSnapshot.exists) {
      throw new Error("Esa URL de turnero ya está en uso, probá con otra");
    }
    const profile = userSnapshot.data() ?? {};
    const owner = input.owner;
    const displayName = owner?.fullName.trim() || String(profile.fullName ?? "").trim() || tenant.name;
    const photoUrl = owner ? owner.avatarUrl : (profile.avatarUrl as string | null | undefined) ?? null;

    transaction.create(tenantRef, { ...tenant, createdAt: FieldValue.serverTimestamp() });
    transaction.create(slugRef, { tenantId: tenant.id, createdAt: FieldValue.serverTimestamp() });
    transaction.create(memberRef, {
      uid: input.ownerUid,
      role: "owner",
      status: "active",
      staffId: ownerStaffRef.id,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.create(ownerStaffRef, {
      id: ownerStaffRef.id,
      tenantId: tenant.id,
      displayName,
      photoUrl,
      active: true,
      color: OWNER_STAFF_COLOR,
      // Arranca sin servicios porque el local recién creado no tiene ninguno:
      // createService se los va sumando mientras autoAssignServices siga en true.
      serviceIds: [],
      schedules: ownerStaffSchedules(input.businessHours),
      commission: null,
      isOwner: true,
      userId: input.ownerUid,
      autoAssignServices: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(
      userMembershipRef,
      { tenantId: tenant.id, slug: tenant.slug, role: "owner", status: "active", createdAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    transaction.set(
      userRef,
      owner
        ? {
            fullName: displayName,
            gender: owner.gender,
            birthYear: owner.birthYear,
            avatarUrl: owner.avatarUrl,
            // `email` es el de login (lo escribe el registro); este es el que dejó para contactarla.
            contactEmail: owner.contactEmail,
            updatedAt: FieldValue.serverTimestamp(),
          }
        : { updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  });

  return tenant;
}

/**
 * Guarda los horarios del local y, en el MISMO batch, sincroniza el horario
 * propio de la dueña si era idéntico al del local (no lo personalizó): si
 * no, al estirar el horario del local ella quedaría atendiendo solo en el
 * horario viejo, y en plan Solo no tiene pantalla para corregirlo. Un solo
 * commit evita que una falla a mitad de camino deje los dos desfasados.
 * Devuelve cuántos staff se actualizaron.
 */
export async function saveBusinessHours(tenantId: string, previous: BusinessHours[], next: BusinessHours[]) {
  const { db } = firebaseAdmin();
  const tenantRef = db.collection("tenants").doc(tenantId);
  const owners = await tenantRef.collection("staff").where("isOwner", "==", true).get();
  const previousFlat = toFlat(previous);
  const stale = owners.docs.filter((doc) => {
    const schedules = (doc.data().schedules ?? []) as { weekday: number; starts_at: string; ends_at: string }[];
    return sameHours(
      schedules.map((s) => ({ weekday: s.weekday, opens_at: s.starts_at, closes_at: s.ends_at })),
      previousFlat,
    );
  });
  const batch = db.batch();
  batch.update(tenantRef, { businessHours: next, updatedAt: FieldValue.serverTimestamp() });
  for (const doc of stale) {
    batch.update(doc.ref, { schedules: ownerStaffSchedules(next), updatedAt: FieldValue.serverTimestamp() });
  }
  await batch.commit();
  return stale.length;
}

export async function getTenantBySlugFromFirebase(slug: string) {
  const { db } = firebaseAdmin();
  // Esta función también atiende el segmento dinámico público `/[slug]`.
  // Bots y navegadores piden rutas como `/favicon.ico` o `/.well-known`;
  // no son slugs de negocio y deben terminar en 404, no tirar un 500.
  let normalized: string;
  try {
    normalized = normalizedSlug(slug);
  } catch {
    return null;
  }
  const slugSnapshot = await db.collection("tenantSlugs").doc(normalized).get();
  const tenantId = slugSnapshot.data()?.tenantId;
  if (typeof tenantId !== "string") return null;

  const tenantSnapshot = await db.collection("tenants").doc(tenantId).get();
  if (!tenantSnapshot.exists) return null;
  return tenantSnapshot.data() as TenantRecord & { createdAt?: Timestamp };
}

export async function getTenantMembershipsForUser(uid: string) {
  const { db } = firebaseAdmin();
  const memberships = await db.collection("users").doc(uid).collection("memberships")
    .where("status", "==", "active")
    .get();

  const options = await Promise.all(memberships.docs.map(async (membership) => {
    const data = membership.data();
    const tenantId = data.tenantId;
    if (typeof tenantId !== "string") return null;
    const tenant = await db.collection("tenants").doc(tenantId).get();
    if (!tenant.exists) return null;
    const tenantData = tenant.data() as TenantRecord & { logoUrl?: string | null };
    return { id: tenantId, name: tenantData.name, slug: tenantData.slug, role: data.role as string, logoUrl: tenantData.logoUrl ?? null };
  }));

  return options.filter((option): option is NonNullable<typeof option> => option !== null);
}

export async function getTenantMember(uid: string, tenantId: string) {
  const { db } = firebaseAdmin();
  const member = await db.collection("tenants").doc(tenantId).collection("members").doc(uid).get();
  return member.exists ? member.data() : null;
}

export async function requireTenantAccess(uid: string, slug: string) {
  const tenant = await getTenantBySlugFromFirebase(slug);
  if (!tenant) throw new Error("El local no existe");
  const member = await getTenantMember(uid, tenant.id);
  if (!member || member.status !== "active") throw new Error("No tenés acceso a este local");
  return { tenant, member };
}

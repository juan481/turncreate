import "server-only";

import type { DocumentData, DocumentSnapshot } from "firebase-admin/firestore";
import { computeTotalDuration, type Phase } from "@/domain/availability";
import { UNCATEGORIZED_CATEGORY_NAME } from "@/lib/schemas/service";
import { firebaseAdmin } from "@/server/firebase/admin";

export type ServiceCategoryRecord = {
  id: string;
  name: string;
  active: boolean;
  sort: number;
};

export type ServiceRecord = {
  id: string;
  name: string;
  description: string;
  categoryId: string | null;
  categoryName: string;
  price: number;
  bufferAfterMin: number;
  phases: Phase[];
  active: boolean;
  public: boolean;
  sort: number;
  archivedAt: unknown;
};

export type PublicCatalogService = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
};

export type PublicCatalogCategory = {
  id: string;
  name: string;
  services: PublicCatalogService[];
};

function legacyCategoryId(categoryName: string) {
  if (categoryName === UNCATEGORIZED_CATEGORY_NAME) return "uncategorized";
  return `legacy:${categoryName.toLocaleLowerCase("es-AR")}`;
}

function finiteNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function serviceFromDoc(doc: DocumentSnapshot<DocumentData>): ServiceRecord {
  const data = doc.data() ?? {};
  const phases = Array.isArray(data.phases)
    ? data.phases
        .filter((phase): phase is Phase => phase?.kind === "active" || phase?.kind === "wait")
        .map((phase) => ({ kind: phase.kind, minutes: finiteNumber(phase.minutes) }))
        .filter((phase) => phase.minutes > 0)
    : [];

  return {
    id: doc.id,
    name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Servicio",
    description: typeof data.description === "string" ? data.description.trim() : "",
    categoryId: typeof data.categoryId === "string" && data.categoryId ? data.categoryId : null,
    categoryName:
      typeof data.categoryName === "string" && data.categoryName.trim()
        ? data.categoryName.trim()
        : UNCATEGORIZED_CATEGORY_NAME,
    price: finiteNumber(data.price),
    bufferAfterMin: Math.max(0, finiteNumber(data.bufferAfterMin)),
    phases,
    active: data.active !== false,
    // Los documentos anteriores a esta funcionalidad no tenían `public`.
    // Se conservan visibles para no apagar catálogos existentes al desplegar.
    public: data.public !== false,
    sort: finiteNumber(data.sort),
    archivedAt: data.archivedAt ?? null,
  };
}

export async function listServiceCategories(tenantId: string): Promise<ServiceCategoryRecord[]> {
  const snapshot = await firebaseAdmin().db
    .collection("tenants")
    .doc(tenantId)
    .collection("serviceCategories")
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Categoría",
        active: data.active !== false && !data.archivedAt,
        sort: finiteNumber(data.sort),
      };
    })
    .filter((category) => category.active)
    .sort((left, right) => left.sort - right.sort || left.name.localeCompare(right.name, "es"));
}

export async function listServices(tenantId: string): Promise<ServiceRecord[]> {
  const snapshot = await firebaseAdmin().db
    .collection("tenants")
    .doc(tenantId)
    .collection("services")
    .get();

  return snapshot.docs
    .map(serviceFromDoc)
    .filter((service) => !service.archivedAt)
    .sort((left, right) => left.sort - right.sort || left.name.localeCompare(right.name, "es"));
}

export async function getService(tenantId: string, serviceId: string): Promise<ServiceRecord | null> {
  const snapshot = await firebaseAdmin().db
    .collection("tenants")
    .doc(tenantId)
    .collection("services")
    .doc(serviceId)
    .get();
  return snapshot.exists ? serviceFromDoc(snapshot) : null;
}

/**
 * Devuelve únicamente servicios reservables, agrupados para el turnero público.
 * Es server-only y mantiene visibles los documentos anteriores al campo `public`.
 */
export async function getPublicServiceCatalog(tenantId: string): Promise<PublicCatalogCategory[]> {
  const [categories, services] = await Promise.all([
    listServiceCategories(tenantId),
    listServices(tenantId),
  ]);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const grouped = new Map<string, PublicCatalogCategory>();

  for (const service of services) {
    if (!service.active || !service.public) continue;

    const configuredCategory = service.categoryId ? categoryById.get(service.categoryId) : undefined;
    const categoryId = configuredCategory?.id ?? service.categoryId ?? legacyCategoryId(service.categoryName);
    const categoryName = configuredCategory?.name ?? service.categoryName ?? UNCATEGORIZED_CATEGORY_NAME;
    const category = grouped.get(categoryId) ?? { id: categoryId, name: categoryName, services: [] };
    category.services.push({
      id: service.id,
      name: service.name,
      description: service.description || null,
      price: service.price,
      duration: computeTotalDuration(service.phases, service.bufferAfterMin),
    });
    grouped.set(categoryId, category);
  }

  const categoryPosition = new Map(categories.map((category, index) => [category.id, index]));
  return [...grouped.values()]
    .map((category) => ({
      ...category,
      services: category.services.sort((left, right) => left.name.localeCompare(right.name, "es")),
    }))
    .sort((left, right) => {
      const leftPosition = categoryPosition.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightPosition = categoryPosition.get(right.id) ?? Number.MAX_SAFE_INTEGER;
      return leftPosition - rightPosition || left.name.localeCompare(right.name, "es");
    });
}

"use server";

import { revalidatePath } from "next/cache";
import { FieldValue, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import {
  catalogOrderSchema,
  createServiceSchema,
  serviceCategoryIdSchema,
  serviceCategorySchema,
  serviceIdSchema,
  UNCATEGORIZED_CATEGORY_NAME,
} from "@/lib/schemas/service";
import { firebaseAdmin } from "@/server/firebase/admin";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { requireTenantAccess } from "@/server/firebase/tenants";

export type ServiceActionState = { error: string | null; id?: string };

function parseService(formData: FormData) {
  const rawCategoryId = formData.get("categoryId");
  const parsed = createServiceSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    categoryId: typeof rawCategoryId === "string" && rawCategoryId.trim() ? rawCategoryId : null,
    price: formData.get("price"),
    durationMin: formData.get("durationMin"),
    public: formData.get("public") === "on",
  });
  return parsed.success
    ? { data: parsed.data }
    : { error: parsed.error.issues[0]?.message ?? "Datos inválidos" } as const;
}

// El motor de agenda sigue trabajando con fases; desde la UI un servicio
// es solo "dura N minutos", que es exactamente una fase activa sin margen.
function durationFields(durationMin: number) {
  return { phases: [{ kind: "active" as const, minutes: durationMin, position: 1 }], bufferAfterMin: 0 };
}

async function authenticatedTenant(tenantSlug: string) {
  const user = await getCurrentFirebaseUser();
  if (!user) throw new Error("Tu sesión venció. Volvé a iniciar sesión.");
  return requireTenantAccess(user.uid, tenantSlug);
}

function revalidateCatalog(tenantSlug: string, serviceId?: string) {
  revalidatePath(`/app/${tenantSlug}/servicios`);
  if (serviceId) revalidatePath(`/app/${tenantSlug}/servicios/${serviceId}`);
  revalidatePath(`/${tenantSlug}`);
}

async function categoryForService(tenantId: string, categoryId: string | null) {
  if (!categoryId) return { categoryId: null, categoryName: UNCATEGORIZED_CATEGORY_NAME };
  const parsedId = serviceCategoryIdSchema.safeParse(categoryId);
  if (!parsedId.success) throw new Error(parsedId.error.issues[0]?.message ?? "La categoría no es válida");

  const category = await firebaseAdmin().db
    .collection("tenants")
    .doc(tenantId)
    .collection("serviceCategories")
    .doc(parsedId.data)
    .get();
  if (!category.exists || category.data()?.active === false || category.data()?.archivedAt) {
    throw new Error("La categoría elegida ya no está disponible");
  }
  return { categoryId: category.id, categoryName: String(category.data()?.name ?? UNCATEGORIZED_CATEGORY_NAME) };
}

async function updateServicesInBatches(
  docs: QueryDocumentSnapshot[],
  data: Record<string, unknown>,
) {
  for (let index = 0; index < docs.length; index += 400) {
    const batch = firebaseAdmin().db.batch();
    for (const doc of docs.slice(index, index + 400)) batch.update(doc.ref, data);
    await batch.commit();
  }
}

export async function createService(
  tenantSlug: string,
  _prevState: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const input = parseService(formData);
  if (!("data" in input)) return { error: input.error };
  const data = input.data!;

  try {
    const { tenant } = await authenticatedTenant(tenantSlug);
    const category = await categoryForService(tenant.id, data.categoryId);
    const serviceRef = firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("services").doc();
    await serviceRef.create({
      id: serviceRef.id,
      tenantId: tenant.id,
      name: data.name,
      description: data.description,
      ...category,
      price: data.price,
      ...durationFields(data.durationMin),
      public: data.public,
      featured: false,
      active: true,
      sort: Date.now(),
      archivedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidateCatalog(tenantSlug);
    return { error: null, id: serviceRef.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear el servicio" };
  }
}

export async function updateService(
  tenantSlug: string,
  serviceId: string,
  _prevState: ServiceActionState,
  formData: FormData,
): Promise<ServiceActionState> {
  const input = parseService(formData);
  if (!("data" in input)) return { error: input.error };
  const data = input.data!;
  const parsedServiceId = serviceIdSchema.safeParse(serviceId);
  if (!parsedServiceId.success) return { error: parsedServiceId.error.issues[0]?.message ?? "El servicio no es válido" };

  try {
    const { tenant } = await authenticatedTenant(tenantSlug);
    const ref = firebaseAdmin().db
      .collection("tenants")
      .doc(tenant.id)
      .collection("services")
      .doc(parsedServiceId.data);
    if (!(await ref.get()).exists) return { error: "El servicio no existe" };
    const category = await categoryForService(tenant.id, data.categoryId);
    await ref.update({
      name: data.name,
      description: data.description,
      ...category,
      price: data.price,
      ...durationFields(data.durationMin),
      public: data.public,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidateCatalog(tenantSlug, parsedServiceId.data);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el servicio" };
  }
}

export async function setServiceActive(tenantSlug: string, serviceId: string, active: boolean) {
  const parsedServiceId = serviceIdSchema.safeParse(serviceId);
  if (!parsedServiceId.success || typeof active !== "boolean") return { error: "El servicio no es válido" };
  try {
    const { tenant } = await authenticatedTenant(tenantSlug);
    const ref = firebaseAdmin().db
      .collection("tenants")
      .doc(tenant.id)
      .collection("services")
      .doc(parsedServiceId.data);
    if (!(await ref.get()).exists) return { error: "El servicio no existe" };
    await ref.update({ active, updatedAt: FieldValue.serverTimestamp() });
    revalidateCatalog(tenantSlug, parsedServiceId.data);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo actualizar el servicio" };
  }
}

export async function archiveService(tenantSlug: string, serviceId: string) {
  const parsedServiceId = serviceIdSchema.safeParse(serviceId);
  if (!parsedServiceId.success) return { error: "El servicio no es válido" };
  try {
    const { tenant } = await authenticatedTenant(tenantSlug);
    const ref = firebaseAdmin().db
      .collection("tenants")
      .doc(tenant.id)
      .collection("services")
      .doc(parsedServiceId.data);
    if (!(await ref.get()).exists) return { error: "El servicio no existe" };
    await ref.update({
      active: false,
      public: false,
      archivedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidateCatalog(tenantSlug);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo archivar el servicio" };
  }
}

export async function createServiceCategory(tenantSlug: string, name: string): Promise<ServiceActionState> {
  const parsed = serviceCategorySchema.safeParse({ name });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "La categoría no es válida" };
  try {
    const { tenant } = await authenticatedTenant(tenantSlug);
    const collection = firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("serviceCategories");
    const existing = await collection.get();
    const normalized = parsed.data.name.toLocaleLowerCase("es-AR");
    if (existing.docs.some((doc) => String(doc.data().name ?? "").trim().toLocaleLowerCase("es-AR") === normalized && !doc.data().archivedAt)) {
      return { error: "Ya existe una categoría con ese nombre" };
    }
    const ref = collection.doc();
    await ref.create({
      id: ref.id,
      tenantId: tenant.id,
      name: parsed.data.name,
      active: true,
      sort: Date.now(),
      archivedAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidateCatalog(tenantSlug);
    return { error: null, id: ref.id };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo crear la categoría" };
  }
}

export async function renameServiceCategory(
  tenantSlug: string,
  categoryId: string,
  name: string,
): Promise<ServiceActionState> {
  const parsedCategory = serviceCategoryIdSchema.safeParse(categoryId);
  const parsed = serviceCategorySchema.safeParse({ name });
  if (!parsedCategory.success || !parsed.success) {
    const nameError = !parsed.success ? parsed.error.issues[0]?.message : null;
    const categoryError = !parsedCategory.success ? parsedCategory.error.issues[0]?.message : null;
    return { error: nameError ?? categoryError ?? "La categoría no es válida" };
  }

  try {
    const { tenant } = await authenticatedTenant(tenantSlug);
    const tenantRef = firebaseAdmin().db.collection("tenants").doc(tenant.id);
    const categoryRef = tenantRef.collection("serviceCategories").doc(parsedCategory.data);
    const [category, categories, services] = await Promise.all([
      categoryRef.get(),
      tenantRef.collection("serviceCategories").get(),
      tenantRef.collection("services").where("categoryId", "==", parsedCategory.data).get(),
    ]);
    if (!category.exists || category.data()?.archivedAt) return { error: "La categoría no existe" };
    const normalized = parsed.data.name.toLocaleLowerCase("es-AR");
    if (categories.docs.some((doc) => doc.id !== parsedCategory.data && !doc.data().archivedAt && String(doc.data().name ?? "").trim().toLocaleLowerCase("es-AR") === normalized)) {
      return { error: "Ya existe una categoría con ese nombre" };
    }
    await categoryRef.update({ name: parsed.data.name, updatedAt: FieldValue.serverTimestamp() });
    await updateServicesInBatches(services.docs, {
      categoryName: parsed.data.name,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidateCatalog(tenantSlug);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo renombrar la categoría" };
  }
}

export async function archiveServiceCategory(
  tenantSlug: string,
  categoryId: string,
): Promise<ServiceActionState> {
  const parsedCategory = serviceCategoryIdSchema.safeParse(categoryId);
  if (!parsedCategory.success) return { error: "La categoría no es válida" };
  try {
    const { tenant } = await authenticatedTenant(tenantSlug);
    const tenantRef = firebaseAdmin().db.collection("tenants").doc(tenant.id);
    const categoryRef = tenantRef.collection("serviceCategories").doc(parsedCategory.data);
    const [category, services] = await Promise.all([
      categoryRef.get(),
      tenantRef.collection("services").where("categoryId", "==", parsedCategory.data).get(),
    ]);
    if (!category.exists) return { error: "La categoría no existe" };
    await categoryRef.update({
      active: false,
      archivedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    await updateServicesInBatches(services.docs, {
      categoryId: null,
      categoryName: UNCATEGORIZED_CATEGORY_NAME,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidateCatalog(tenantSlug);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo archivar la categoría" };
  }
}

export async function setServiceFeatured(tenantSlug: string, serviceId: string, featured: boolean): Promise<ServiceActionState> {
  const parsedServiceId = serviceIdSchema.safeParse(serviceId);
  if (!parsedServiceId.success || typeof featured !== "boolean") return { error: "El servicio no es válido" };
  try {
    const { tenant } = await authenticatedTenant(tenantSlug);
    const ref = firebaseAdmin().db.collection("tenants").doc(tenant.id).collection("services").doc(parsedServiceId.data);
    if (!(await ref.get()).exists) return { error: "El servicio no existe" };
    await ref.update({ featured, updatedAt: FieldValue.serverTimestamp() });
    revalidateCatalog(tenantSlug, parsedServiceId.data);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo destacar el servicio" };
  }
}

// Guarda el orden tal cual quedó en pantalla: el índice de cada categoría y
// de cada servicio pasa a ser su `sort`, que es lo que usa el turnero
// público para mostrar el catálogo en ese mismo orden.
export async function saveCatalogOrder(
  tenantSlug: string,
  order: { categoryIds: string[]; serviceIds: string[] },
): Promise<ServiceActionState> {
  const parsed = catalogOrderSchema.safeParse(order);
  if (!parsed.success) return { error: "El orden no es válido" };
  try {
    const { tenant } = await authenticatedTenant(tenantSlug);
    const tenantRef = firebaseAdmin().db.collection("tenants").doc(tenant.id);
    const refs = [
      ...parsed.data.categoryIds.map((id, index) => ({ ref: tenantRef.collection("serviceCategories").doc(id), sort: index })),
      ...parsed.data.serviceIds.map((id, index) => ({ ref: tenantRef.collection("services").doc(id), sort: index })),
    ];
    for (let start = 0; start < refs.length; start += 400) {
      const batch = firebaseAdmin().db.batch();
      for (const { ref, sort } of refs.slice(start, start + 400)) batch.update(ref, { sort, updatedAt: FieldValue.serverTimestamp() });
      await batch.commit();
    }
    revalidateCatalog(tenantSlug);
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No se pudo guardar el orden" };
  }
}

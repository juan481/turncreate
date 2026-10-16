"use server";

import { z } from "zod";
import { createTenantForOwner, isStorableImageDataUrl, isTenantSlugTaken } from "@/server/firebase/tenants";
import { getCurrentFirebaseUser } from "@/server/firebase/current-user";
import { flatHoursError } from "@/components/ui/hours-editor-model";
import { todayISO } from "@/lib/dates";

const TIMEZONE = "America/Argentina/Buenos_Aires";

// Se consulta al pasar del paso 1: si la URL ya existe, la dueña se entera
// ahí mismo y no recién al final, después de cargar todo lo demás.
export async function checkSlugAvailability(slug: string): Promise<{ error: string | null }> {
  const user = await getCurrentFirebaseUser();
  if (!user) return { error: "Tu sesión expiró. Iniciá sesión nuevamente." };
  try {
    if (await isTenantSlugTaken(slug)) return { error: "Esa URL de turnero ya está en uso, probá con otra" };
    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "No pudimos verificar la URL" };
  }
}

const imageField = z
  .string()
  .nullable()
  .refine((value) => value === null || isStorableImageDataUrl(value), "La imagen no es válida. Probá con un PNG, JPG o WebP de hasta 2 MB.");

const onboardingSchema = z.object({
  business: z.object({
    name: z.string().trim().min(2, "Ingresá el nombre del local").max(80, "El nombre del local es muy largo"),
    slug: z.string().trim().min(3, "La URL necesita al menos 3 caracteres").max(60, "La URL es muy larga"),
    businessTypeId: z.string().trim().min(1, "Elegí un rubro").max(40),
    address: z.string().trim().max(160, "La dirección es muy larga"),
    logoUrl: imageField,
  }),
  owner: z.object({
    gender: z.enum(["female", "male", "unspecified"], "Contanos cómo te tratamos"),
    fullName: z.string().trim().min(2, "Ingresá tu nombre").max(80, "Tu nombre es muy largo"),
    email: z.email("Ingresá un correo válido"),
    age: z.number().int().min(14, "Revisá tu edad").max(99, "Revisá tu edad").nullable(),
    avatarUrl: imageField,
    teamMode: z.enum(["solo", "team"], "Contanos si trabajás con equipo"),
  }),
  businessHours: z
    .array(z.object({ weekday: z.number().int(), opens_at: z.string(), closes_at: z.string() }))
    .max(14, "Hay demasiadas franjas horarias"),
});

export type OnboardingInput = z.input<typeof onboardingSchema>;

// Devuelve el error en vez de tirarlo: en producción Next reemplaza el
// mensaje de una excepción de server action por uno genérico.
export async function createTenantAction(input: OnboardingInput): Promise<{ slug: string } | { error: string }> {
  const user = await getCurrentFirebaseUser();
  if (!user) return { error: "Tu sesión expiró. Iniciá sesión nuevamente." };

  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revisá los datos cargados" };
  const { business, owner, businessHours } = parsed.data;

  const hoursError = flatHoursError(businessHours);
  if (hoursError) return { error: hoursError };

  try {
    const tenant = await createTenantForOwner({
      ownerUid: user.uid,
      name: business.name,
      slug: business.slug,
      businessTypeId: business.businessTypeId,
      address: business.address || null,
      logoUrl: business.logoUrl,
      plan: owner.teamMode === "team" ? "equipo" : "solo",
      teamMode: owner.teamMode,
      businessHours: businessHours.map((hour) => ({
        weekday: hour.weekday,
        opensAt: hour.opens_at,
        closesAt: hour.closes_at,
      })),
      owner: {
        fullName: owner.fullName,
        gender: owner.gender,
        birthYear: owner.age === null ? null : Number(todayISO(TIMEZONE).slice(0, 4)) - owner.age,
        avatarUrl: owner.avatarUrl,
        contactEmail: owner.email.trim().toLowerCase(),
      },
    });
    return { slug: tenant.slug };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Hubo un error al crear el local." };
  }
}

"use client";

import { useActionState } from "react";
import { updateBusinessInfo, type ConfigActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

const initialState: ConfigActionState = { error: null };
const LABEL = "font-label-md text-label-md text-on-surface-variant";

export function BusinessInfoForm({
  tenantSlug,
  tenant,
}: {
  tenantSlug: string;
  tenant: { name: string; description: string | null; address: string | null; instagramUrl: string | null; whatsappNumber: string | null };
}) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState(async (prev: ConfigActionState, formData: FormData) => {
    const result = await updateBusinessInfo(tenantSlug, prev, formData);
    if (result.success) toast.show("Datos del local guardados");
    return result;
  }, initialState);

  return (
    <form action={formAction} className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="min-w-0 space-y-1.5 sm:col-span-2">
        <label htmlFor="local-name" className={LABEL}>Nombre del local</label>
        <Input id="local-name" name="name" defaultValue={tenant.name} required />
      </div>
      <div className="min-w-0 space-y-1.5 sm:col-span-2">
        <label htmlFor="local-description" className={LABEL}>Descripción corta</label>
        <textarea
          id="local-description"
          name="description"
          defaultValue={tenant.description ?? ""}
          maxLength={240}
          rows={3}
          placeholder="Contá en pocas palabras qué hacés y qué hace especial a tu estudio."
          className="w-full resize-y rounded-inner border-0 bg-surface-muted px-4 py-3 font-body-lg text-body-lg text-on-surface outline-none ring-2 ring-transparent transition-all placeholder:text-on-surface-variant focus:bg-surface focus:ring-secondary"
        />
      </div>
      <div className="min-w-0 space-y-1.5 sm:col-span-2">
        <label htmlFor="local-address" className={LABEL}>Dirección</label>
        <Input id="local-address" name="address" defaultValue={tenant.address ?? ""} placeholder="Av. Santa Fe 1234, CABA" autoComplete="street-address" />
      </div>
      <div className="min-w-0 space-y-1.5">
        <label htmlFor="local-instagram" className={LABEL}>Instagram</label>
        <Input id="local-instagram" name="instagramUrl" defaultValue={tenant.instagramUrl ?? ""} placeholder="@tu_local" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
      </div>
      <div className="min-w-0 space-y-1.5">
        <label htmlFor="local-whatsapp" className={LABEL}>WhatsApp del local</label>
        <Input id="local-whatsapp" name="whatsappNumber" type="tel" inputMode="tel" defaultValue={tenant.whatsappNumber ?? ""} placeholder="+5491122334455" />
      </div>
      {state.error && (
        <p role="alert" className="font-body-sm text-body-sm text-status-alert sm:col-span-2">{state.error}</p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" className="w-full sm:w-auto" disabled={pending}>
          {pending ? "Guardando…" : "Guardar datos"}
        </Button>
      </div>
    </form>
  );
}

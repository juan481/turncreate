"use client";

import { useActionState, useState } from "react";
import { addStaff, type StaffActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { ServicesCheckboxList, type ServiceOption } from "./services-checkbox-list";

const initialState: StaffActionState = { error: null };

export function NewStaffForm({ tenantSlug, services }: { tenantSlug: string; services: ServiceOption[] }) {
  const [state, formAction, pending] = useActionState(
    addStaff.bind(null, tenantSlug),
    initialState,
  );
  const [displayName, setDisplayName] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <Avatar name={displayName || "?"} src={photoUrl || null} size="lg" />
        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface-variant">
            Nombre del profesional
          </label>
          <Input
            name="displayName"
            placeholder="Sofía Martín"
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="font-label-md text-label-md text-on-surface-variant">
            Foto (obligatoria)
          </label>
          <Input
            name="photoUrl"
            type="url"
            placeholder="https://..."
            required
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Agregando…" : "Agregar"}
        </Button>
      </div>
      <p className="font-body-sm text-body-sm text-on-surface-variant">
        Quien atiende turnos tiene que tener una foto para que el cliente lo reconozca en el turnero.
        Subila a cualquier servicio (Drive, Imgur, etc.) y pegá acá el link directo a la imagen.
      </p>

      <ServicesCheckboxList services={services} />

      {state.error && (
        <p className="w-full font-body-sm text-body-sm text-status-alert">{state.error}</p>
      )}
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { updateStaffPhoto, type StaffActionState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";

const initialState: StaffActionState = { error: null };

export function EditPhotoForm({
  tenantSlug,
  staffId,
  displayName,
  currentPhotoUrl,
}: {
  tenantSlug: string;
  staffId: string;
  displayName: string;
  currentPhotoUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    updateStaffPhoto.bind(null, tenantSlug, staffId),
    initialState,
  );
  const [photoUrl, setPhotoUrl] = useState(currentPhotoUrl ?? "");

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <Avatar name={displayName} src={photoUrl || null} size="md" />
        <Input
          name="photoUrl"
          type="url"
          placeholder="https://..."
          required
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          className="h-9 flex-1 min-w-[12rem]"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
      {state.error && <p className="font-body-sm text-body-sm text-status-alert">{state.error}</p>}
    </form>
  );
}

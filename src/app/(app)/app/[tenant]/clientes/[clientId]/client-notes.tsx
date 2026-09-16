"use client";

import { useActionState } from "react";
import { addClientNote, type ClientNoteState } from "./actions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const initialState: ClientNoteState = { error: null };

export function ClientNotes(props: {
  tenantSlug: string;
  clientId: string;
  notes: { id: string; body: string; created_at: string; is_clinical: boolean }[];
}) {
  const [state, formAction, pending] = useActionState(
    addClientNote.bind(null, props.tenantSlug, props.clientId),
    initialState,
  );

  return (
    <Card className="p-lg space-y-4">
      <h2 className="font-headline-sm text-headline-sm text-on-surface">Notas</h2>
      
      <form action={formAction} className="space-y-3">
        <textarea
          name="body"
          required
          rows={3}
          placeholder="Escribir una nota..."
          className="w-full rounded-xl border-0 bg-surface-muted p-3 font-body-md text-on-surface"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 font-body-sm text-on-surface-variant cursor-pointer">
            <input type="checkbox" name="isClinical" value="true" className="rounded-sm" />
            Nota clínica
          </label>
          <Button type="submit" size="sm" disabled={pending}>
            Agregar
          </Button>
        </div>
        {state.error && <p className="font-body-sm text-status-alert">{state.error}</p>}
      </form>

      <div className="space-y-3 pt-2">
        {props.notes.map((note) => (
          <div key={note.id} className="rounded-lg bg-surface-muted p-3 space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-label-sm text-on-surface-variant">
                {new Date(note.created_at).toLocaleDateString("es-AR")}
              </span>
              {note.is_clinical && (
                <span className="font-label-sm text-status-alert bg-status-alert/10 px-2 py-0.5 rounded-full">Clínica</span>
              )}
            </div>
            <p className="font-body-md text-on-surface whitespace-pre-wrap">{note.body}</p>
          </div>
        ))}
        {props.notes.length === 0 && (
          <p className="font-body-sm text-on-surface-variant text-center py-2">No hay notas para este cliente.</p>
        )}
      </div>
    </Card>
  );
}

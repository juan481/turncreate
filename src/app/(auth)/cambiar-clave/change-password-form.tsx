"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changeTemporaryPassword, type ChangePasswordState } from "./actions";

const initial: ChangePasswordState = { error: null };
export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changeTemporaryPassword, initial);
  return <form action={action} className="w-full space-y-4"><label className="block space-y-1"><span className="font-label-md text-label-md">Nueva contraseña</span><Input name="password" type="password" autoComplete="new-password" required minLength={10} /></label><label className="block space-y-1"><span className="font-label-md text-label-md">Repetir contraseña</span><Input name="confirmation" type="password" autoComplete="new-password" required minLength={10} /></label>{state.error && <p className="text-sm text-status-alert">{state.error}</p>}<Button type="submit" className="w-full" disabled={pending}>{pending ? "Guardando..." : "Guardar y continuar"}</Button></form>;
}

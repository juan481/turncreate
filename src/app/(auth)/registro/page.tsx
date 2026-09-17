"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUp, type AuthActionState } from "../actions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialState: AuthActionState = { error: null };

export default function RegistroPage() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

  return (
    <Card className="w-full max-w-[24rem] space-y-lg">
      <div className="space-y-1">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
          Creá tu local
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          7 días de prueba, sin tarjeta.
        </p>
      </div>

      <form action={formAction} className="space-y-md">
        <div className="space-y-1.5">
          <label
            htmlFor="fullName"
            className="font-label-md text-label-md text-on-surface-variant"
          >
            Nombre completo
          </label>
          <Input id="fullName" name="fullName" autoComplete="name" required />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="font-label-md text-label-md text-on-surface-variant"
          >
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="font-label-md text-label-md text-on-surface-variant"
          >
            Contraseña
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
          />
        </div>

        {state.error && (
          <p className="font-body-sm text-body-sm text-status-alert">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creando…" : "Empezar gratis"}
        </Button>
      </form>

      <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="text-secondary">
          Iniciá sesión
        </Link>
      </p>
    </Card>
  );
}

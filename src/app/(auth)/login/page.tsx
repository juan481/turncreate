"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type AuthActionState } from "../actions";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialState: AuthActionState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <Card className="w-full max-w-sm space-y-lg">
      <div className="space-y-1">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
          Iniciá sesión
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Entrá a tu local en TurnCreate.
        </p>
      </div>

      <form action={formAction} className="space-y-md">
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
            autoComplete="current-password"
            required
          />
        </div>

        {state.error && (
          <p className="font-body-sm text-body-sm text-status-alert">
            {state.error}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>

      <p className="text-center font-body-sm text-body-sm text-on-surface-variant">
        ¿No tenés cuenta?{" "}
        <Link href="/registro" className="text-secondary">
          Creá tu local
        </Link>
      </p>
    </Card>
  );
}

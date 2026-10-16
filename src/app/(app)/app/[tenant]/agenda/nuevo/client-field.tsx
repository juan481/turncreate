"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { PHONE_HINT } from "@/lib/phone";
import { MAX_CLIENT_AGE } from "@/lib/schemas/client";
import { cn } from "@/lib/utils";
import { createClientQuick } from "./actions";

export type ClientOption = { id: string; full_name: string };

/**
 * Buscador + lista tocable de clientes, o alta rápida de uno nuevo sin
 * salir del flujo. Controlado por el padre (value/onChange); los clientes
 * recién creados se informan con `onCreated` para que el padre los
 * conserve aunque este paso se desmonte (el stepper solo monta el paso
 * actual).
 */
export function ClientField({
  tenantSlug,
  clients,
  value,
  onChange,
  onCreated,
}: {
  tenantSlug: string;
  clients: ClientOption[];
  value: string;
  onChange: (id: string) => void;
  onCreated: (client: ClientOption) => void;
}) {
  const [mode, setMode] = useState<"pick" | "create">("pick");
  const [query, setQuery] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = clients.find((c) => c.id === value);
  const trimmedQuery = query.trim();
  const filtered = useMemo(() => {
    const q = trimmedQuery.toLocaleLowerCase("es-AR");
    if (!q) return clients;
    return clients.filter((c) => c.full_name.toLocaleLowerCase("es-AR").includes(q));
  }, [clients, trimmedQuery]);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const name = fullName.trim();
      const result = await createClientQuick(tenantSlug, { fullName: name, phoneE164: phone, email, age });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onCreated({ id: result.id, full_name: name });
      onChange(result.id);
      setMode("pick");
      setFullName("");
      setPhone("");
      setAge("");
      setEmail("");
      setQuery("");
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="font-label-md text-label-md text-on-surface-variant">Cliente</span>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode(mode === "pick" ? "create" : "pick");
          }}
          aria-expanded={mode === "create"}
          className="-mr-2 inline-flex h-11 shrink-0 items-center rounded-pill px-3 font-label-md text-label-md text-secondary transition-colors hover:bg-secondary-soft"
        >
          {mode === "pick" ? "+ Cliente nuevo" : "Elegir existente"}
        </button>
      </div>

      {/* Envoltorio sin space-y: el panel cerrado mide 0 y no debe sumar margen. */}
      <div>
      <Collapsible open={mode === "pick"}>
        <div className="space-y-2">
          {selected ? (
            <div className="flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-inner border border-primary bg-primary/10 py-0.5 pl-3 pr-1">
              <div className="flex min-w-0 items-center gap-2">
                <Avatar name={selected.full_name} size="sm" />
                <span className="truncate font-label-md text-label-md text-on-surface">{selected.full_name}</span>
              </div>
              <button
                type="button"
                onClick={() => onChange("")}
                className="inline-flex h-11 shrink-0 items-center rounded-pill px-3 font-label-md text-label-md text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <Input
                placeholder="Buscar por nombre…"
                aria-label="Buscar cliente por nombre"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="max-h-48 space-y-1 overflow-y-auto overscroll-contain rounded-inner bg-surface-container-low p-1.5">
                {filtered.length === 0 && trimmedQuery && (
                  <p className="p-2 font-body-sm text-body-sm text-on-surface-variant">
                    No encontramos clientes con ese nombre. Cargalo con “+ Cliente nuevo”.
                  </p>
                )}
                {clients.length === 0 && !trimmedQuery && (
                  <p className="p-2 font-body-sm text-body-sm text-on-surface-variant">
                    Todavía no hay clientes cargados. Cargá el primero con “+ Cliente nuevo”.
                  </p>
                )}
                {filtered.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onChange(c.id)}
                    className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-inner px-2 text-left transition-colors hover:bg-surface-container"
                  >
                    <Avatar name={c.full_name} size="sm" />
                    <span className="min-w-0 truncate font-label-md text-label-md text-on-surface">{c.full_name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </Collapsible>

      <Collapsible open={mode === "create"}>
        <div className="space-y-2 rounded-inner bg-surface-container-low p-3">
          <Input
            placeholder="Nombre completo"
            aria-label="Nombre completo"
            autoComplete="off"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <div className="space-y-1">
            <Input
              placeholder="11 2233 4455"
              aria-label="Teléfono (WhatsApp)"
              aria-describedby="quick-client-phone-hint"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p id="quick-client-phone-hint" className="px-4 font-body-sm text-body-sm text-on-surface-variant">
              {PHONE_HINT}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-[6rem_minmax(0,1fr)]">
            <Input
              placeholder="Edad"
              aria-label="Edad (opcional)"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_CLIENT_AGE}
              step={1}
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
            <Input
              placeholder="Email (opcional)"
              aria-label="Email (opcional)"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button
            type="button"
            className="w-full"
            onClick={handleCreate}
            disabled={pending || !fullName.trim() || !phone.trim()}
          >
            {pending ? "Creando…" : "Crear y usar este cliente"}
          </Button>
          {error && (
            <p role="alert" className="flex items-start gap-1.5 font-body-sm text-body-sm text-status-alert">
              <Icon name="warning" className="mt-0.5 text-[14px]" />
              {error}
            </p>
          )}
        </div>
      </Collapsible>
      </div>
    </div>
  );
}

/**
 * Transición de alto + opacidad sin medir en JS: grid-template-rows de
 * 0fr a 1fr anima al alto real del contenido. El panel cerrado queda
 * `inert` (ni foco ni lector de pantalla). Con movimiento reducido el
 * cambio es instantáneo.
 */
function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      inert={!open}
      aria-hidden={!open}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      {/* -mx-1/px-1 + py-1: margen para que el anillo de foco de los
          inputs no quede recortado por el overflow-hidden. */}
      <div className="-mx-1 min-h-0 overflow-hidden px-1">
        <div className="py-1">{children}</div>
      </div>
    </div>
  );
}

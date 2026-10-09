"use client";

import { useMemo, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { createClientQuick } from "./actions";

type ClientOption = { id: string; full_name: string };

/**
 * Antes era un <select> nativo con TODOS los clientes, sin buscar --
 * incómodo de usar con el dedo ni bien el negocio pasa de unos pocos
 * clientes. Ahora es un buscador + lista tocable, controlado por el padre
 * (value/onChange) en vez de un <input name="clientId"> dentro de un form
 * GET -- el padre (TurnoForm) decide qué hacer con la selección.
 */
export function ClientField({
  tenantSlug,
  clients,
  value,
  onChange,
}: {
  tenantSlug: string;
  clients: ClientOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [mode, setMode] = useState<"pick" | "create">("pick");
  const [options, setOptions] = useState(clients);
  const [query, setQuery] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const selected = options.find((c) => c.id === value);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("es-AR");
    if (!q) return options;
    return options.filter((c) => c.full_name.toLocaleLowerCase("es-AR").includes(q));
  }, [options, query]);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createClientQuick(tenantSlug, { fullName, phoneE164: phone, email });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOptions((prev) => [{ id: result.id, full_name: fullName }, ...prev]);
      onChange(result.id);
      setMode("pick");
      setFullName("");
      setPhone("");
      setEmail("");
      setQuery("");
    });
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="font-label-md text-label-md text-on-surface-variant">Cliente</label>
        <button
          type="button"
          onClick={() => setMode(mode === "pick" ? "create" : "pick")}
          className="font-label-sm text-label-sm text-secondary transition-colors hover:text-secondary/80"
        >
          {mode === "pick" ? "+ Cliente nuevo" : "Elegir existente"}
        </button>
      </div>

      {mode === "pick" ? (
        <div className="space-y-2">
          {selected ? (
            <div className="flex min-h-11 items-center justify-between gap-2 rounded-inner border border-primary bg-primary/10 px-3 py-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <Avatar name={selected.full_name} size="sm" />
                <span className="truncate font-label-md text-label-md text-on-surface">{selected.full_name}</span>
              </div>
              <button
                type="button"
                onClick={() => onChange("")}
                className="shrink-0 font-label-sm text-label-sm text-on-surface-variant hover:text-on-surface"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <Input placeholder="Buscar por nombre…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-inner bg-surface-container-low p-1.5">
                {filtered.length === 0 && (
                  <p className="p-2 font-body-sm text-body-sm text-on-surface-variant">
                    No encontramos clientes con ese nombre.
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
      ) : (
        <div className="space-y-2 rounded-inner bg-surface-container-low p-3">
          <Input placeholder="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input placeholder="+5491122334455" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input placeholder="Email (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button
            type="button"
            size="sm"
            className="w-full"
            onClick={handleCreate}
            disabled={pending || !fullName || !phone}
          >
            {pending ? "Creando…" : "Crear y usar este cliente"}
          </Button>
          {error && <p className="font-body-sm text-body-sm text-status-alert">{error}</p>}
        </div>
      )}
    </div>
  );
}

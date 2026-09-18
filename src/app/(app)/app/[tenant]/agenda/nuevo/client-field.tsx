"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createClientQuick } from "./actions";

type ClientOption = { id: string; full_name: string };

export function ClientField({
  tenantSlug,
  clients,
  defaultClientId,
}: {
  tenantSlug: string;
  clients: ClientOption[];
  defaultClientId?: string;
}) {
  const [mode, setMode] = useState<"pick" | "create">("pick");
  const [options, setOptions] = useState(clients);
  const [selectedId, setSelectedId] = useState(defaultClientId ?? "");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createClientQuick(tenantSlug, { fullName, phoneE164: phone, email });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOptions((prev) => [{ id: result.id, full_name: fullName }, ...prev]);
      setSelectedId(result.id);
      setMode("pick");
      setFullName("");
      setPhone("");
      setEmail("");
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
        <select
          name="clientId"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          required
          className="h-11 w-full rounded-pill border-0 bg-surface-muted px-4 font-body-md text-body-md text-on-surface"
        >
          <option value="" disabled>
            Elegir…
          </option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.full_name}
            </option>
          ))}
        </select>
      ) : (
        <div className="space-y-2 rounded-inner bg-surface-container-low p-3">
          <Input
            placeholder="Nombre completo"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <Input
            placeholder="+5491122334455"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            placeholder="Email (opcional)"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
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

"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useRouter } from "next/navigation";
import { createTenantAction } from "./actions";

type BusinessType = {
  id: string;
  name: string;
  slug: string;
};

const WEEKDAYS = [
  { id: 1, label: "Lunes" },
  { id: 2, label: "Martes" },
  { id: 3, label: "Miércoles" },
  { id: 4, label: "Jueves" },
  { id: 5, label: "Viernes" },
  { id: 6, label: "Sábado" },
  { id: 0, label: "Domingo" },
];

type HourBlock = { opens_at: string; closes_at: string };
type DayHours = { weekday: number; active: boolean; blocks: HourBlock[] };

export function Wizard({ businessTypes }: { businessTypes: BusinessType[] }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [businessTypeId, setBusinessTypeId] = useState(
    businessTypes[0]?.id || ""
  );

  const [hours, setHours] = useState<DayHours[]>(
    WEEKDAYS.map((day) => ({
      weekday: day.id,
      active: day.id >= 1 && day.id <= 5, // Mon-Fri active by default
      blocks: [{ opens_at: "09:00", closes_at: "18:00" }],
    }))
  );

  const router = useRouter();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    // Auto-generate slug if in step 1
    if (step === 1) {
      setSlug(
        newName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
      );
    }
  };

  const toggleDayActive = (weekday: number, active: boolean) => {
    setHours((prev) => prev.map((h) => (h.weekday === weekday ? { ...h, active } : h)));
  };

  const updateBlock = (weekday: number, index: number, field: keyof HourBlock, value: string) => {
    setHours((prev) =>
      prev.map((h) =>
        h.weekday === weekday
          ? { ...h, blocks: h.blocks.map((b, i) => (i === index ? { ...b, [field]: value } : b)) }
          : h
      )
    );
  };

  // Horario cortado: un segundo bloque para el corte de mediodía
  // (p. ej. 09:00-13:00 y 17:00-21:00). business_hours no tiene
  // restricción de un solo rango por día -- el motor de disponibilidad
  // ya opera sobre listas de rangos (src/domain/availability/ranges.ts).
  const addBlock = (weekday: number) => {
    setHours((prev) =>
      prev.map((h) =>
        h.weekday === weekday
          ? { ...h, blocks: [...h.blocks, { opens_at: "17:00", closes_at: "21:00" }] }
          : h
      )
    );
  };

  const removeBlock = (weekday: number, index: number) => {
    setHours((prev) =>
      prev.map((h) =>
        h.weekday === weekday ? { ...h, blocks: h.blocks.filter((_, i) => i !== index) } : h
      )
    );
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setSubmitError(null);
      const activeHours = hours
        .filter((h) => h.active)
        .flatMap((h) =>
          h.blocks.map((b) => ({
            weekday: h.weekday,
            opens_at: b.opens_at,
            closes_at: b.closes_at,
          }))
        );
      const { slug: newSlug } = await createTenantAction({
        name,
        slug,
        businessTypeId,
        businessHours: activeHours,
      });
      router.push(`/app/${newSlug}`);
    } catch (error) {
      console.error(error);
      setSubmitError(error instanceof Error ? error.message : "Hubo un error al crear el local.");
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-lg">
      <div className="space-y-1">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
          {step === 1 && "Contanos de tu local"}
          {step === 2 && "¿Cuál es tu rubro?"}
          {step === 3 && "¿Cuándo abrís?"}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          {step === 1 && "Con esto armamos tu turnero público."}
          {step === 2 && "Elegí la categoría que mejor describa tu negocio."}
          {step === 3 && "Configurá tus días y horarios de atención."}
        </p>
      </div>

      <div className="space-y-md">
        {step === 1 && (
          <>
            <div className="space-y-1.5">
              <label className="font-label-md text-label-md text-on-surface-variant">
                Nombre del local
              </label>
              <Input
                placeholder="Studio Lumière"
                value={name}
                onChange={handleNameChange}
              />
            </div>
            <div className="space-y-1.5">
              <label className="font-label-md text-label-md text-on-surface-variant">
                URL del turnero
              </label>
              <Input
                placeholder="studio-lumiere"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <div className="space-y-1.5">
            <label className="font-label-md text-label-md text-on-surface-variant">
              Rubro
            </label>
            <select
              value={businessTypeId}
              onChange={(e) => setBusinessTypeId(e.target.value)}
              className="h-11 w-full rounded-pill border-0 bg-surface-muted px-4 font-body-md text-body-md text-on-surface outline-none ring-2 ring-transparent transition-shadow focus:ring-secondary appearance-none"
            >
              {businessTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            {hours.map((h) => {
              const dayLabel = WEEKDAYS.find((w) => w.id === h.weekday)?.label;
              return (
                <div key={h.weekday} className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={h.active}
                      onChange={(e) => toggleDayActive(h.weekday, e.target.checked)}
                      className="h-5 w-5 rounded border-gray-300 accent-secondary"
                    />
                    <span className="w-24 font-body-sm">{dayLabel}</span>
                    {!h.active && (
                      <span className="text-on-surface-variant text-sm">Cerrado</span>
                    )}
                  </div>
                  {h.active && (
                    <div className="space-y-1.5 pl-8">
                      {h.blocks.map((b, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Input
                            type="time"
                            value={b.opens_at}
                            onChange={(e) => updateBlock(h.weekday, i, "opens_at", e.target.value)}
                            className="h-9 w-[8.5rem] px-3"
                          />
                          <span>-</span>
                          <Input
                            type="time"
                            value={b.closes_at}
                            onChange={(e) => updateBlock(h.weekday, i, "closes_at", e.target.value)}
                            className="h-9 w-[8.5rem] px-3"
                          />
                          {h.blocks.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeBlock(h.weekday, i)}
                              className="flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-muted hover:text-status-alert"
                              aria-label="Quitar franja"
                            >
                              <Icon name="close" className="text-[16px]" />
                            </button>
                          )}
                        </div>
                      ))}
                      {h.blocks.length < 2 && (
                        <button
                          type="button"
                          onClick={() => addBlock(h.weekday)}
                          className="flex items-center gap-1 font-label-sm text-label-sm text-secondary transition-colors hover:text-secondary/80"
                        >
                          <Icon name="add" className="text-[16px]" />
                          Agregar corte (ej. horario partido)
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {submitError && (
          <p className="font-body-sm text-body-sm text-status-alert">{submitError}</p>
        )}

        <div className="flex gap-3 pt-4">
          {step > 1 && (
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setStep(step - 1)}
              disabled={loading}
            >
              Atrás
            </Button>
          )}
          {step < 3 ? (
            <Button
              className="flex-1"
              onClick={() => setStep(step + 1)}
              disabled={!name || !slug}
            >
              Continuar
            </Button>
          ) : (
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Creando..." : "Finalizar"}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

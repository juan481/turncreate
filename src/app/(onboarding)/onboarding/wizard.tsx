"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

export function Wizard({ businessTypes }: { businessTypes: BusinessType[] }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [businessTypeId, setBusinessTypeId] = useState(
    businessTypes[0]?.id || ""
  );
  
  const [hours, setHours] = useState<
    { weekday: number; opens_at: string; closes_at: string; active: boolean }[]
  >(
    WEEKDAYS.map((day) => ({
      weekday: day.id,
      opens_at: "09:00",
      closes_at: "18:00",
      active: day.id >= 1 && day.id <= 5, // Mon-Fri active by default
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

  const handleHourChange = (weekday: number, field: string, value: string | boolean) => {
    setHours((prev) =>
      prev.map((h) => (h.weekday === weekday ? { ...h, [field]: value } : h))
    );
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const activeHours = hours
        .filter((h) => h.active)
        .map((h) => ({
          weekday: h.weekday,
          opens_at: h.opens_at,
          closes_at: h.closes_at,
        }));
      const { slug: newSlug } = await createTenantAction({
        name,
        slug,
        businessTypeId,
        businessHours: activeHours,
      });
      router.push(`/app/${newSlug}`);
    } catch (error) {
      console.error(error);
      alert("Hubo un error al crear el local.");
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
          <div className="space-y-2">
            {hours.map((h) => {
              const dayLabel = WEEKDAYS.find((w) => w.id === h.weekday)?.label;
              return (
                <div key={h.weekday} className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={h.active}
                    onChange={(e) =>
                      handleHourChange(h.weekday, "active", e.target.checked)
                    }
                    className="h-5 w-5 rounded border-gray-300 accent-secondary"
                  />
                  <span className="w-24 font-body-sm">{dayLabel}</span>
                  {h.active ? (
                    <>
                      <Input
                        type="time"
                        value={h.opens_at}
                        onChange={(e) =>
                          handleHourChange(h.weekday, "opens_at", e.target.value)
                        }
                        className="h-9 px-2 w-28"
                      />
                      <span>-</span>
                      <Input
                        type="time"
                        value={h.closes_at}
                        onChange={(e) =>
                          handleHourChange(
                            h.weekday,
                            "closes_at",
                            e.target.value
                          )
                        }
                        className="h-9 px-2 w-28"
                      />
                    </>
                  ) : (
                    <span className="text-on-surface-variant text-sm">Cerrado</span>
                  )}
                </div>
              );
            })}
          </div>
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

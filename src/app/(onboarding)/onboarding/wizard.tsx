"use client";

import { useState } from "react";
import { preload } from "react-dom";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { checkSlugAvailability, createTenantAction } from "./actions";
import { CreatingOverlay, JUST_CREATE_ICON } from "./creating-overlay";

type BusinessType = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  hint: string;
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

const STEPS = [
  { title: "Contanos de tu local", subtitle: "Con esto armamos tu turnero público." },
  { title: "¿Cuál es tu rubro?", subtitle: "Elegí el que mejor describa tu negocio." },
  { title: "¿Cuándo abrís?", subtitle: "Configurá tus días y horarios de atención." },
];

// Mínimo que se ve la pantalla de "creando": aunque Firestore responda en
// 300 ms, un parpadeo de animación se siente como un error, no como algo
// que se armó para vos.
const MIN_CREATING_MS = 2200;
const DONE_MS = 900;

type HourBlock = { opens_at: string; closes_at: string };
type DayHours = { weekday: number; active: boolean; blocks: HourBlock[] };

// "Uñas Lumière" -> "unas-lumiere": sin acentos ni eñes, que es lo que
// acepta la URL del turnero (si no, el alta fallaba con "solo letras,
// números y guiones").
function toSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "");
}

export function Wizard({ businessTypes }: { businessTypes: BusinessType[] }) {
  preload(JUST_CREATE_ICON, { as: "image" });
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [businessTypeId, setBusinessTypeId] = useState(businessTypes[0]?.id || "");

  const [hours, setHours] = useState<DayHours[]>(
    WEEKDAYS.map((day) => ({
      weekday: day.id,
      active: day.id >= 1 && day.id <= 5,
      blocks: [{ opens_at: "09:00", closes_at: "18:00" }],
    })),
  );

  const router = useRouter();

  const goTo = (next: number) => {
    setDirection(next > step ? "forward" : "back");
    setStep(next);
  };

  const continueFromStep = async () => {
    if (step !== 1) return goTo(step + 1);
    setCheckingSlug(true);
    setSlugError(null);
    const { error } = await checkSlugAvailability(slug.replace(/-+$/, ""));
    setCheckingSlug(false);
    if (error) {
      setSlugError(error);
      return;
    }
    goTo(2);
  };

  const handleNameChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
    if (!slugTouched) setSlug(toSlug(event.target.value).replace(/-+$/, ""));
  };

  const toggleDayActive = (weekday: number, active: boolean) => {
    setHours((prev) => prev.map((h) => (h.weekday === weekday ? { ...h, active } : h)));
  };

  const updateBlock = (weekday: number, index: number, field: keyof HourBlock, value: string) => {
    setHours((prev) =>
      prev.map((h) =>
        h.weekday === weekday
          ? { ...h, blocks: h.blocks.map((b, i) => (i === index ? { ...b, [field]: value } : b)) }
          : h,
      ),
    );
  };

  // Horario cortado: un segundo bloque para el corte de mediodía
  // (p. ej. 09:00-13:00 y 17:00-21:00). El motor de disponibilidad ya
  // opera sobre listas de rangos (src/domain/availability/ranges.ts).
  const addBlock = (weekday: number) => {
    setHours((prev) =>
      prev.map((h) =>
        h.weekday === weekday ? { ...h, blocks: [...h.blocks, { opens_at: "17:00", closes_at: "21:00" }] } : h,
      ),
    );
  };

  const removeBlock = (weekday: number, index: number) => {
    setHours((prev) =>
      prev.map((h) => (h.weekday === weekday ? { ...h, blocks: h.blocks.filter((_, i) => i !== index) } : h)),
    );
  };

  const handleSubmit = async () => {
    setCreating(true);
    setSubmitError(null);
    const startedAt = Date.now();
    try {
      const activeHours = hours
        .filter((h) => h.active)
        .flatMap((h) => h.blocks.map((b) => ({ weekday: h.weekday, opens_at: b.opens_at, closes_at: b.closes_at })));
      const { slug: newSlug } = await createTenantAction({
        name,
        slug: slug.replace(/-+$/, ""),
        businessTypeId,
        businessHours: activeHours,
      });
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, MIN_CREATING_MS - (Date.now() - startedAt))));
      setCreated(true);
      await new Promise((resolve) => setTimeout(resolve, DONE_MS));
      router.push(`/app/${newSlug}`);
    } catch (error) {
      console.error(error);
      setSubmitError(error instanceof Error ? error.message : "Hubo un error al crear el local.");
      setCreating(false);
    }
  };

  const current = STEPS[step - 1];
  const stepAnimation = direction === "forward" ? "animate-step-in-right" : "animate-step-in-left";

  return (
    <>
      {/* Fuera de la Card a propósito: un ancestro con transform (la animación
          de cada paso) haría que este `fixed` se acomode a él y no a la pantalla. */}
      {creating && <CreatingOverlay done={created} />}

      <div className="mb-lg space-y-2">
        <div className="flex items-center justify-between font-label-sm text-label-sm text-on-surface-variant">
          <span>Paso {step} de {STEPS.length}</span>
          <span>{Math.round((step / STEPS.length) * 100)}%</span>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((_, index) => (
            <div key={index} className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-muted">
              <div
                className="h-full rounded-pill bg-secondary transition-[width] duration-500 ease-out"
                style={{ width: index < step ? "100%" : "0%" }}
              />
            </div>
          ))}
        </div>
      </div>

      <Card hoverLift={false} className="overflow-hidden">
        <div key={step} className={cn("space-y-lg motion-reduce:animate-none", stepAnimation)}>
          <div className="space-y-1">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">{current.title}</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">{current.subtitle}</p>
          </div>

          <div className="space-y-md">
            {step === 1 && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="onboarding-name" className="font-label-md text-label-md text-on-surface-variant">Nombre del local</label>
                  <Input id="onboarding-name" placeholder="Studio Lumière" value={name} onChange={handleNameChange} autoFocus />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="onboarding-slug" className="font-label-md text-label-md text-on-surface-variant">URL del turnero</label>
                  <Input
                    id="onboarding-slug"
                    value={slug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      setSlugError(null);
                      setSlug(toSlug(event.target.value));
                    }}
                    placeholder="studio-lumiere"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                  <p className="flex min-w-0 items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
                    <Icon name="link" className="shrink-0 text-[14px] text-secondary" />
                    <span className="min-w-0 truncate">
                      turn.justcreate.com.ar/<strong className="font-semibold text-on-surface">{slug.replace(/-+$/, "") || "tu-local"}</strong>
                    </span>
                  </p>
                  {slugError && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{slugError}</p>}
                </div>
              </>
            )}

            {step === 2 && (
              <div role="radiogroup" aria-label="Rubro" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {businessTypes.map((type) => {
                  const selected = businessTypeId === type.id;
                  return (
                    <button
                      key={type.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setBusinessTypeId(type.id)}
                      className={cn(
                        "relative flex min-h-[4.5rem] items-center gap-3 rounded-inner border-2 p-3 text-left transition-all duration-200 active:scale-[0.98]",
                        selected
                          ? "border-secondary bg-secondary-soft shadow-card"
                          : "border-border bg-surface hover:border-secondary/40 hover:bg-surface-container-low",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors",
                          selected ? "bg-secondary text-on-primary" : "bg-surface-container-low text-secondary",
                        )}
                      >
                        <Icon name={type.icon} className="text-[20px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-label-lg text-label-lg text-on-surface">{type.name}</span>
                        <span className="block truncate font-body-sm text-body-sm text-on-surface-variant">{type.hint}</span>
                      </span>
                      {selected && (
                        <span className="grid h-6 w-6 shrink-0 animate-pop-in place-items-center rounded-full bg-secondary text-on-primary">
                          <Icon name="check" className="text-[14px]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                {hours.map((h) => {
                  const dayLabel = WEEKDAYS.find((w) => w.id === h.weekday)?.label;
                  return (
                    <div key={h.weekday} className="space-y-1.5">
                      <label className="flex min-h-11 items-center gap-3">
                        <input
                          type="checkbox"
                          checked={h.active}
                          onChange={(e) => toggleDayActive(h.weekday, e.target.checked)}
                          className="h-5 w-5 rounded border-gray-300 accent-secondary"
                        />
                        <span className="w-24 font-body-sm">{dayLabel}</span>
                        {!h.active && <span className="text-sm text-on-surface-variant">Cerrado</span>}
                      </label>
                      {h.active && (
                        <div className="space-y-1.5 pl-8">
                          {h.blocks.map((b, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <Input
                                type="time"
                                value={b.opens_at}
                                onChange={(e) => updateBlock(h.weekday, i, "opens_at", e.target.value)}
                                className="h-10 w-[8.5rem] px-3"
                              />
                              <span>-</span>
                              <Input
                                type="time"
                                value={b.closes_at}
                                onChange={(e) => updateBlock(h.weekday, i, "closes_at", e.target.value)}
                                className="h-10 w-[8.5rem] px-3"
                              />
                              {h.blocks.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeBlock(h.weekday, i)}
                                  className="flex h-10 w-10 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:bg-surface-muted hover:text-status-alert"
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
                              className="flex min-h-9 items-center gap-1 font-label-sm text-label-sm text-secondary transition-colors hover:text-secondary/80"
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

            {submitError && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{submitError}</p>}
          </div>
        </div>

        <div className="mt-lg flex gap-3">
          {step > 1 && (
            <Button variant="secondary" className="flex-1" onClick={() => goTo(step - 1)} disabled={creating}>
              Atrás
            </Button>
          )}
          {step < STEPS.length ? (
            <Button className="flex-1" onClick={continueFromStep} disabled={checkingSlug || !name.trim() || slug.replace(/-+$/, "").length < 3}>
              {checkingSlug ? "Verificando…" : "Continuar"}
            </Button>
          ) : (
            <Button className="flex-1" onClick={handleSubmit} disabled={creating}>
              Crear mi turnero
            </Button>
          )}
        </div>
      </Card>
    </>
  );
}

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
import { HoursEditor } from "@/components/ui/hours-editor";
import { daysToHours, defaultWeek, weekError, type DayHours } from "@/components/ui/hours-editor-model";

type BusinessType = {
  id: string;
  name: string;
  slug: string;
  icon: string;
  hint: string;
};

export type OwnerDefaults = {
  fullName: string;
  email: string;
  gender: "female" | "male" | "unspecified" | null;
  age: string;
  avatarUrl: string | null;
};

const STEPS = [
  { title: "Contanos de tu local", subtitle: "Con esto armamos tu turnero público." },
  { title: "¿Cuál es tu rubro?", subtitle: "Elegí el que mejor describa tu negocio." },
  { title: "Ahora, sobre vos", subtitle: "Estos datos identifican a la persona que atiende." },
  { title: "¿Cuándo abrís?", subtitle: "Configurá tus días y horarios de atención." },
];

// Mínimo que se ve la pantalla de "creando": aunque Firestore responda en
// 300 ms, un parpadeo de animación se siente como un error, no como algo
// que se armó para vos.
const MIN_CREATING_MS = 2200;
const DONE_MS = 900;

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

export function Wizard({ businessTypes, owner }: { businessTypes: BusinessType[]; owner: OwnerDefaults }) {
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
  const [address, setAddress] = useState("");
  const [ownerName, setOwnerName] = useState(owner.fullName);
  const [ownerEmail, setOwnerEmail] = useState(owner.email);
  const [ownerGender, setOwnerGender] = useState<"female" | "male" | "unspecified">(owner.gender ?? "unspecified");
  const [ownerAge, setOwnerAge] = useState(owner.age);
  const [teamMode, setTeamMode] = useState<"solo" | "team">("solo");

  const [hours, setHours] = useState<DayHours[]>(defaultWeek);

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

  const handleSubmit = async () => {
    setCreating(true);
    setSubmitError(null);
    const startedAt = Date.now();
    try {
      const activeHours = daysToHours(hours);
      const result = await createTenantAction({
        business: {
          name,
          slug: slug.replace(/-+$/, ""),
          businessTypeId,
          address,
          logoUrl: null,
        },
        owner: {
          fullName: ownerName || name,
          email: ownerEmail,
          gender: ownerGender,
          age: ownerAge ? Number(ownerAge) : null,
          avatarUrl: owner.avatarUrl,
          teamMode,
        },
        businessHours: activeHours,
      });
      if ("error" in result) throw new Error(result.error);
      const newSlug = result.slug;
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
                <div className="space-y-1.5">
                  <label htmlFor="onboarding-address" className="font-label-md text-label-md text-on-surface-variant">Dirección (opcional)</label>
                  <Input id="onboarding-address" placeholder="Barrio, ciudad o dirección" value={address} onChange={(event) => setAddress(event.target.value)} />
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
              <div className="space-y-md">
                <div className="space-y-1.5">
                  <label htmlFor="onboarding-owner-name" className="font-label-md text-label-md text-on-surface-variant">Tu nombre</label>
                  <Input id="onboarding-owner-name" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} autoComplete="name" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="onboarding-owner-email" className="font-label-md text-label-md text-on-surface-variant">Email de contacto</label>
                    <Input id="onboarding-owner-email" type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} autoComplete="email" />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="onboarding-owner-age" className="font-label-md text-label-md text-on-surface-variant">Edad (opcional)</label>
                    <Input id="onboarding-owner-age" type="number" min="14" max="99" value={ownerAge} onChange={(event) => setOwnerAge(event.target.value)} inputMode="numeric" />
                  </div>
                </div>
                <fieldset className="space-y-2">
                  <legend className="font-label-md text-label-md text-on-surface-variant">¿Cómo te hablamos?</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {([
                      ["female", "Femenino"],
                      ["male", "Masculino"],
                      ["unspecified", "Neutral"],
                    ] as const).map(([value, label]) => (
                      <button key={value} type="button" onClick={() => setOwnerGender(value)} className={cn("min-h-11 rounded-pill border px-2 font-label-sm text-label-sm", ownerGender === value ? "border-secondary bg-secondary-soft text-secondary" : "border-border text-on-surface-variant")}>{label}</button>
                    ))}
                  </div>
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="font-label-md text-label-md text-on-surface-variant">¿Trabajás sola o con equipo?</legend>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setTeamMode("solo")} className={cn("min-h-14 rounded-inner border p-3 text-left", teamMode === "solo" ? "border-secondary bg-secondary-soft" : "border-border")}><strong className="block font-label-md text-label-md">Trabajo sola</strong><span className="font-body-sm text-body-sm text-on-surface-variant">Plan Solo, sin arqueo ni selector de profesional.</span></button>
                    <button type="button" onClick={() => setTeamMode("team")} className={cn("min-h-14 rounded-inner border p-3 text-left", teamMode === "team" ? "border-secondary bg-secondary-soft" : "border-border")}><strong className="block font-label-md text-label-md">Tengo equipo</strong><span className="font-body-sm text-body-sm text-on-surface-variant">Agenda y caja para varias personas.</span></button>
                  </div>
                </fieldset>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <HoursEditor value={hours} onChange={setHours} />
                {weekError(hours) && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{weekError(hours)}</p>}
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
            <Button className="flex-1" onClick={continueFromStep} disabled={checkingSlug || (step === 1 && (!name.trim() || slug.replace(/-+$/, "").length < 3)) || (step === 3 && (!ownerName.trim() || !ownerEmail.includes("@")))}>
              {checkingSlug ? "Verificando…" : "Continuar"}
            </Button>
          ) : (
            <Button className="flex-1" onClick={handleSubmit} disabled={creating || Boolean(weekError(hours))}>
              Crear mi turnero
            </Button>
          )}
        </div>
      </Card>
    </>
  );
}

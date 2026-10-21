"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { HoursEditor } from "@/components/ui/hours-editor";
import { daysToHours, defaultWeek, weekError, type DayHours } from "@/components/ui/hours-editor-model";
import { byGender, type Gender } from "@/lib/gender";
import { cn } from "@/lib/utils";
import { checkSlugAvailability, createTenantAction } from "./actions";
import { CreatingOverlay } from "./creating-overlay";
import { ImagePicker } from "./image-picker";

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
  gender: Gender | null;
  age: string;
  avatarUrl: string | null;
};

const STEPS = [
  { label: "Tu local", title: "Contanos de tu local", subtitle: "Con esto armamos tu turnero público." },
  { label: "Rubro", title: "¿Cuál es tu rubro?", subtitle: "Elegí el que mejor describa tu negocio." },
  { label: "Vos", title: "Ahora, sobre vos", subtitle: "Así te mostramos en la agenda y sabemos cómo hablarte." },
  { label: "Horarios", title: "¿Cuándo abrís?", subtitle: "Configurá tus días y horarios de atención." },
];

const GENDER_OPTIONS: ReadonlyArray<readonly [Gender, string]> = [
  ["female", "Mujer"],
  ["male", "Hombre"],
  ["unspecified", "Prefiero no decir"],
];

// Mínimo que se ve la pantalla de "creando": aunque Firestore responda en
// 300 ms, un parpadeo de animación se siente como un error, no como algo
// que se armó para vos.
const MIN_CREATING_MS = 2200;
const DONE_MS = 900;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ageProblem(value: string) {
  if (!value.trim()) return null;
  const age = Number(value);
  return Number.isInteger(age) && age >= 14 && age <= 99 ? null : "Revisá tu edad (entre 14 y 99).";
}

export function Wizard({ businessTypes, owner }: { businessTypes: BusinessType[]; owner: OwnerDefaults }) {
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
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [ownerName, setOwnerName] = useState(owner.fullName);
  const [ownerEmail, setOwnerEmail] = useState(owner.email);
  const [emailTouched, setEmailTouched] = useState(false);
  // Sin preselección: el copy se adapta a lo que elija y no a lo que supongamos.
  const [ownerGender, setOwnerGender] = useState<Gender | null>(owner.gender);
  const [ownerAge, setOwnerAge] = useState(owner.age);
  // Arranca con la foto que ya tenía (de un local anterior); una nueva la reemplaza.
  const [avatarUrl, setAvatarUrl] = useState<string | null>(owner.avatarUrl);
  const [teamMode, setTeamMode] = useState<"solo" | "team">("solo");

  const [hours, setHours] = useState<DayHours[]>(defaultWeek);
  const [slotIntervalMin, setSlotIntervalMin] = useState<15 | 30 | 45 | 60>(15);
  const [minNoticeMin, setMinNoticeMin] = useState(60);

  const router = useRouter();
  // Doble envío: el estado `creating` deshabilita el botón recién en el
  // próximo render; este ref corta un segundo toque que llegue antes.
  const submittingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const shownStep = useRef(step);

  // Al cambiar de paso: arriba de todo (el de horarios es largo) y foco en
  // el título, para que el lector de pantalla anuncie el paso nuevo. Compara
  // con el paso ya mostrado (y no con un flag de "primer render") para que el
  // doble efecto de StrictMode no le robe el autofocus al nombre del local.
  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const cleanSlug = slug.replace(/-+$/, "");
  const firstName = ownerName.trim().split(/\s+/)[0] ?? "";
  const emailValid = EMAIL_PATTERN.test(ownerEmail.trim());
  const ageError = ageProblem(ownerAge);
  const step1Valid = name.trim().length >= 2 && cleanSlug.length >= 3;

  const step3Missing = [
    ownerName.trim().length < 2 && "tu nombre",
    ownerGender === null && "tu sexo",
    !emailValid && "un correo válido",
  ].filter((item): item is string => Boolean(item));
  const step3Valid = step3Missing.length === 0 && !ageError;

  const g = ownerGender;
  const welcome = byGender(g, {
    female: firstName ? `¡Bienvenida, ${firstName}!` : "¡Bienvenida!",
    male: firstName ? `¡Bienvenido, ${firstName}!` : "¡Bienvenido!",
    neutral: firstName ? `¡Te damos la bienvenida, ${firstName}!` : "¡Te damos la bienvenida!",
  });

  const goTo = (next: number) => {
    setDirection(next > step ? "forward" : "back");
    setStep(next);
  };

  const continueFromStep = async () => {
    if (step !== 1) return goTo(step + 1);
    setCheckingSlug(true);
    setSlugError(null);
    const { error } = await checkSlugAvailability(cleanSlug);
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
    if (submittingRef.current) return;
    submittingRef.current = true;
    setCreating(true);
    setSubmitError(null);
    const startedAt = Date.now();
    try {
      const result = await createTenantAction({
        business: {
          name,
          slug: cleanSlug,
          businessTypeId,
          address,
          logoUrl,
        },
        owner: {
          fullName: ownerName || name,
          email: ownerEmail.trim(),
          gender: ownerGender ?? "unspecified",
          age: ownerAge.trim() ? Number(ownerAge) : null,
          avatarUrl,
          teamMode,
        },
        businessHours: daysToHours(hours),
        bookingRules: { slotIntervalMin, minNoticeMin },
      });
      if ("error" in result) {
        submittingRef.current = false;
        setCreating(false);
        // La URL se ocupó mientras cargaba el resto: de vuelta al paso 1, con
        // el aviso al lado del campo, sin perder nada de lo cargado.
        if (result.field === "slug") {
          setSlugError(result.error);
          goTo(1);
        } else {
          setSubmitError(result.error);
        }
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, MIN_CREATING_MS - (Date.now() - startedAt))));
      setCreated(true);
      await new Promise((resolve) => setTimeout(resolve, DONE_MS));
      router.push(`/app/${result.slug}`);
    } catch (error) {
      console.error(error);
      submittingRef.current = false;
      setSubmitError(error instanceof Error ? error.message : "Hubo un error al crear el local.");
      setCreating(false);
    }
  };

  const current = STEPS[step - 1];
  const stepAnimation = direction === "forward" ? "animate-step-in-right" : "animate-step-in-left";
  const hoursError = weekError(hours);

  return (
    <>
      {/* Fuera de la Card a propósito: un ancestro con transform (la animación
          de cada paso) haría que este `fixed` se acomode a él y no a la pantalla. */}
      {creating && <CreatingOverlay done={created} gender={ownerGender} firstName={firstName} />}

      <div className="mb-lg space-y-2">
        <div className="flex min-w-0 items-baseline justify-between gap-3 font-label-md text-label-md">
          <span className="shrink-0 text-on-surface">Paso {step} de {STEPS.length}</span>
          <span className="min-w-0 truncate text-on-surface-variant">{current.label}</span>
        </div>
        <div
          role="progressbar"
          aria-label="Progreso del alta"
          aria-valuemin={1}
          aria-valuemax={STEPS.length}
          aria-valuenow={step}
          aria-valuetext={`Paso ${step} de ${STEPS.length}: ${current.label}`}
          className="grid grid-cols-4 gap-1.5"
        >
          {STEPS.map((item, index) => (
            <div key={item.label} className="min-w-0 space-y-1">
              <div className="h-1.5 overflow-hidden rounded-pill bg-surface-container-high">
                <div
                  className="h-full rounded-pill bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
                  style={{ width: index < step ? "100%" : "0%" }}
                />
              </div>
              <span
                aria-hidden
                className={cn(
                  "block truncate font-label-xs text-label-xs transition-colors",
                  index < step ? "text-primary" : "text-on-surface-variant",
                )}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <Card hoverLift={false} className="overflow-hidden p-lg sm:p-xl">
        <div key={step} className={cn("min-w-0 space-y-lg motion-reduce:animate-none", stepAnimation)}>
          <div className="space-y-1">
            <h1 ref={headingRef} tabIndex={-1} className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface outline-none">
              {current.title}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">{current.subtitle}</p>
          </div>

          <div className="space-y-md">
            {step === 1 && (
              <>
                <div className="space-y-1.5">
                  <label htmlFor="onboarding-name" className="font-label-md text-label-md text-on-surface-variant">Nombre del local</label>
                  <Input id="onboarding-name" placeholder="Studio Lumière" value={name} onChange={handleNameChange} autoFocus autoComplete="organization" />
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
                    aria-invalid={slugError ? true : undefined}
                    aria-describedby="onboarding-slug-preview"
                  />
                  <p id="onboarding-slug-preview" className="flex min-w-0 items-center gap-1.5 font-body-sm text-body-sm text-on-surface-variant">
                    <Icon name="link" className="shrink-0 text-[14px] text-secondary" />
                    <span className="min-w-0 truncate">
                      turn.justcreate.com.ar/<strong className="font-semibold text-on-surface">{cleanSlug || "tu-local"}</strong>
                    </span>
                  </p>
                  {slugError && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{slugError}</p>}
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="onboarding-address" className="font-label-md text-label-md text-on-surface-variant">Dirección (opcional)</label>
                  <Input id="onboarding-address" placeholder="Barrio, ciudad o dirección" value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="street-address" />
                </div>
                <ImagePicker
                  shape="square"
                  value={logoUrl}
                  onChange={setLogoUrl}
                  label="Logo del local (opcional)"
                  hint="PNG, JPG o WebP de hasta 2 MB. Lo podés cambiar cuando quieras."
                  fallbackIcon="storefront"
                />
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
                        "relative flex min-h-[4.5rem] min-w-0 items-center gap-3 rounded-inner border-2 p-3 text-left transition-all duration-200 active:scale-[0.98] motion-reduce:transition-none",
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
                        <span className="grid h-6 w-6 shrink-0 animate-pop-in place-items-center rounded-full bg-secondary text-on-primary motion-reduce:animate-none">
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
                <ImagePicker
                  shape="round"
                  value={avatarUrl}
                  onChange={setAvatarUrl}
                  title={welcome}
                  label="Tu foto (opcional)"
                  hint="Así te reconocen en la agenda."
                  fallbackName={ownerName}
                  fallbackIcon="person"
                />

                <div className="space-y-1.5">
                  <label htmlFor="onboarding-owner-name" className="font-label-md text-label-md text-on-surface-variant">Tu nombre</label>
                  <Input id="onboarding-owner-name" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} autoComplete="name" />
                </div>

                <fieldset className="min-w-0 space-y-2">
                  <legend className="mb-2 font-label-md text-label-md text-on-surface-variant">Sexo</legend>
                  <div role="radiogroup" aria-label="Sexo" className="grid grid-cols-3 gap-2">
                    {GENDER_OPTIONS.map(([value, label]) => {
                      const selected = ownerGender === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setOwnerGender(value)}
                          className={cn(
                            "min-h-11 min-w-0 rounded-pill border px-2 py-1.5 font-label-md text-label-md leading-tight transition-colors duration-200 motion-reduce:transition-none",
                            selected
                              ? "border-secondary bg-secondary-soft text-secondary"
                              : "border-border bg-surface text-on-surface-variant hover:border-secondary/40",
                          )}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,7rem)_minmax(0,1fr)]">
                  <div className="min-w-0 space-y-1.5">
                    <label htmlFor="onboarding-owner-age" className="font-label-md text-label-md text-on-surface-variant">Edad (opcional)</label>
                    <Input
                      id="onboarding-owner-age"
                      type="number"
                      min="14"
                      max="99"
                      inputMode="numeric"
                      value={ownerAge}
                      onChange={(event) => setOwnerAge(event.target.value)}
                      aria-invalid={ageError ? true : undefined}
                      className="tabular-nums"
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <label htmlFor="onboarding-owner-email" className="font-label-md text-label-md text-on-surface-variant">Correo de contacto</label>
                    <Input
                      id="onboarding-owner-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      value={ownerEmail}
                      onChange={(event) => setOwnerEmail(event.target.value)}
                      onBlur={() => setEmailTouched(true)}
                      aria-invalid={emailTouched && !emailValid ? true : undefined}
                    />
                  </div>
                </div>
                {ageError && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{ageError}</p>}
                {emailTouched && !emailValid && (
                  <p role="alert" className="font-body-sm text-body-sm text-status-alert">Revisá el correo, parece incompleto.</p>
                )}

                <fieldset className="min-w-0 space-y-2">
                  <legend className="mb-2 font-label-md text-label-md text-on-surface-variant">
                    {byGender(g, {
                      female: "¿Trabajás sola o con equipo?",
                      male: "¿Trabajás solo o con equipo?",
                      neutral: "¿Trabajás con equipo?",
                    })}
                  </legend>
                  <div role="radiogroup" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {([
                      {
                        value: "solo",
                        icon: "person",
                        title: byGender(g, { female: "Trabajo sola", male: "Trabajo solo", neutral: "Trabajo sin equipo" }),
                        description: "Plan Individual: tu agenda, sin arqueo de caja ni selector de profesional.",
                      },
                      {
                        value: "team",
                        icon: "groups",
                        title: "Tengo equipo",
                        description: "Plan Estudio: agenda y caja para varias personas.",
                      },
                    ] as const).map((option) => {
                      const selected = teamMode === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setTeamMode(option.value)}
                          className={cn(
                            "flex min-h-14 min-w-0 items-start gap-3 rounded-inner border-2 p-3 text-left transition-colors duration-200 motion-reduce:transition-none",
                            selected ? "border-secondary bg-secondary-soft" : "border-border bg-surface hover:border-secondary/40",
                          )}
                        >
                          <span
                            className={cn(
                              "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                              selected ? "bg-secondary text-on-primary" : "bg-surface-container-low text-secondary",
                            )}
                          >
                            <Icon name={option.icon} className="text-[18px]" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <strong className="block font-label-lg text-label-lg text-on-surface">{option.title}</strong>
                            <span className="block font-body-sm text-body-sm text-on-surface-variant">{option.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-md">
                <HoursEditor value={hours} onChange={setHours} />
                {hoursError && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{hoursError}</p>}
                <div className="grid grid-cols-1 gap-3 rounded-inner bg-surface-container-low p-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="onboarding-slot-interval" className="font-label-md text-label-md text-on-surface-variant">Turnos disponibles cada</label>
                    <select id="onboarding-slot-interval" value={slotIntervalMin} onChange={(event) => setSlotIntervalMin(Number(event.target.value) as 15 | 30 | 45 | 60)} className="h-11 w-full rounded-pill border border-border bg-surface px-4 text-base">
                      {[15, 30, 45, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutos</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="onboarding-min-notice" className="font-label-md text-label-md text-on-surface-variant">Reservar con al menos</label>
                    <select id="onboarding-min-notice" value={minNoticeMin} onChange={(event) => setMinNoticeMin(Number(event.target.value))} className="h-11 w-full rounded-pill border border-border bg-surface px-4 text-base">
                      <option value={0}>Sin anticipación mínima</option>
                      <option value={60}>1 hora</option>
                      <option value={120}>2 horas</option>
                      <option value={360}>6 horas</option>
                      <option value={720}>12 horas</option>
                      <option value={1440}>24 horas</option>
                    </select>
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant sm:col-span-2">La duración de cada atención se define después, al crear los servicios.</p>
                </div>
              </div>
            )}

            {submitError && <p role="alert" className="font-body-sm text-body-sm text-status-alert">{submitError}</p>}
          </div>
        </div>

        <div className="mt-lg flex gap-3">
          {step > 1 && (
            <Button variant="secondary" className="min-w-0 flex-1" onClick={() => goTo(step - 1)} disabled={creating}>
              Atrás
            </Button>
          )}
          {step < STEPS.length ? (
            <Button
              className="min-w-0 flex-1"
              onClick={continueFromStep}
              disabled={checkingSlug || (step === 1 && !step1Valid) || (step === 3 && !step3Valid)}
            >
              {checkingSlug ? "Verificando…" : "Continuar"}
            </Button>
          ) : (
            <Button className="min-w-0 flex-1" onClick={handleSubmit} disabled={creating || Boolean(hoursError)}>
              {creating ? "Creando…" : "Crear mi turnero"}
            </Button>
          )}
        </div>
        {step === 3 && step3Missing.length > 0 && (
          <p className="mt-3 text-center font-body-sm text-body-sm text-on-surface-variant">
            Para seguir, nos falta {step3Missing.join(", ").replace(/, ([^,]*)$/, " y $1")}.
          </p>
        )}
      </Card>
    </>
  );
}

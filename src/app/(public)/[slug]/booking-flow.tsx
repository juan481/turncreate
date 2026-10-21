"use client";

import { useEffect, useRef, useState } from "react";
import { TZDate } from "@date-fns/tz";
import { format, parseISO, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { MercadoPagoLogo } from "@/components/ui/mercado-pago-logo";
import { cn } from "@/lib/utils";
import { PHONE_HINT } from "@/lib/phone";
import { TRANSFER_MIN_LEAD_HOURS, transferAllowedFor } from "@/server/public-booking/payment-methods";
import {
  getPublicCatalog,
  getPublicStaffForService,
  getPublicDaySlots,
  createHold,
  getPublicCheckoutQuote,
  startPublicCheckout,
  startTransferBooking,
} from "./actions";
import { TransferInstructions } from "./transfer-instructions";
import { PublicMonthCalendar } from "./public-month-calendar";
import type { PublicCategory, PublicHold, PublicService, PublicSlot, PublicStaffMember, TransferPanelData } from "./types";

type StepId = "service" | "staff" | "date" | "time" | "data" | "payment";
type PayMethod = "mercadopago" | "transfer";

const money = (value: number) => `$${value.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`;

function ProgressHeader({ current, total, name, title }: { current: number; total: number; name: string; title: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex min-h-7 items-center rounded-pill bg-secondary-soft px-3 font-label-sm text-label-sm text-secondary">Paso {current} de {total} · {name}</span>
        <span className="font-label-sm text-label-sm tabular-nums text-on-surface-variant">{Math.round((current / total) * 100)}%</span>
      </div>
      <div role="progressbar" aria-label="Progreso de la reserva" aria-valuemin={1} aria-valuemax={total} aria-valuenow={current} className="h-2 overflow-hidden rounded-pill bg-surface-container-high">
        <div className="h-full rounded-pill bg-primary transition-[width] duration-300" style={{ width: `${(current / total) * 100}%` }} />
      </div>
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">{title}</h1>
    </div>
  );
}

export function BookingFlow({
  tenantId,
  slug,
  timezone,
  booksByStaff,
  maxBookingDays,
  paymentMethods,
  cancellationRefundHours,
  bookableWeekdays,
}: {
  tenantId: string;
  slug: string;
  timezone: string;
  booksByStaff: boolean;
  maxBookingDays: number;
  paymentMethods: { mercadopago: boolean; transfer: boolean };
  cancellationRefundHours: number;
  bookableWeekdays: number[];
}) {
  const [step, setStep] = useState(1);
  const [catalog, setCatalog] = useState<PublicCategory[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [staffList, setStaffList] = useState<PublicStaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string>("any");
  const [selectedDate, setSelectedDate] = useState<string>(format(new TZDate(new Date(), timezone), "yyyy-MM-dd"));
  const [daySlots, setDaySlots] = useState<PublicSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [hold, setHold] = useState<PublicHold | null>(null);
  const [quote, setQuote] = useState<{ appliedAmount: number; surchargeAmount: number; grossAmount: number } | null>(null);
  const [clientData, setClientData] = useState({ full_name: "", phone_e164: "", email: "", age: "" });
  const [method, setMethod] = useState<PayMethod>(paymentMethods.mercadopago ? "mercadopago" : "transfer");
  const [transferPanel, setTransferPanel] = useState<TransferPanelData | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Evita que la lista de profesionales de un servicio elegido antes pise la del actual.
  const staffRequest = useRef(0);

  const allServices = catalog.flatMap((cat) => cat.services);
  const singleService = catalogLoaded && allServices.length === 1;
  // El paso de profesional solo aparece si hay a quién elegir para ESTE servicio.
  const showStaffStep = booksByStaff && (staffLoading || staffList.length > 1);
  const visibleSteps: StepId[] = [
    ...(singleService ? [] : (["service"] as StepId[])),
    ...(showStaffStep ? (["staff"] as StepId[]) : []),
    "date",
    "time",
    "data",
    "payment",
  ];
  const stepNumber = (id: StepId) => Math.max(1, visibleSteps.indexOf(id) + 1);

  const track = (event: "views" | "bookingStarted" | "checkoutStarted") => {
    void fetch("/api/analytics/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, event }), keepalive: true });
  };

  const chooseService = async (svc: PublicService) => {
    const request = ++staffRequest.current;
    setSelectedService(svc);
    setSelectedStaff("any");
    setSelectedTime(null);
    setErrorMessage(null);
    if (!booksByStaff) {
      setStep(3);
      return;
    }
    setStaffList([]);
    setStaffLoading(true);
    setStep(2);
    let list: PublicStaffMember[] = [];
    try {
      list = await getPublicStaffForService(tenantId, svc.id);
    } catch (err) {
      console.error(err);
    }
    if (request !== staffRequest.current) return;
    setStaffList(list);
    setStaffLoading(false);
    // Una sola profesional (o ninguna): no hay nada que elegir.
    if (list.length <= 1) {
      setSelectedStaff(list[0]?.id ?? "any");
      setStep(3);
    }
  };

  useEffect(() => { track("views"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let cancelled = false;
    getPublicCatalog(tenantId)
      .then((result) => {
        if (cancelled) return;
        setCatalog(result);
        setCatalogLoaded(true);
        const services = result.flatMap((cat) => cat.services);
        // Un solo servicio público: se elige solo y arranca por la fecha.
        if (services.length === 1) void chooseService(services[0]);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setCatalogLoaded(true);
      });
    return () => { cancelled = true; };
  }, [tenantId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== 4 || !selectedService) return;

    let cancelled = false;
    // Flag de loading para el fetch de slots al cambiar fecha/staff/servicio;
    // no hay forma de derivarlo sin loading propio (availableSlots queda
    // "stale" del fetch anterior mientras llega el nuevo).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    // El horario elegido pertenece a la fecha/profesional/servicio
    // ANTERIOR -- si no se limpia, el usuario puede elegir una hora,
    // cambiar de día (o volver y cambiar de profesional) y apretar
    // "Continuar" sin volver a tocar los horarios: `selectedTime` queda
    // con el string ISO viejo (fecha vieja, hora vieja) y la reserva se
    // confirma para ESE instante, no para el día nuevo elegido en
    // pantalla. Limpiarlo acá (se ejecuta en cada cambio de fecha/staff/
    // servicio, exactamente cuando los slots dejan de ser válidos) cierra
    // el hueco por completo, no solo "al cambiar de día".
    setSelectedTime(null);
    getPublicDaySlots(
      tenantId,
      selectedService.id,
      selectedStaff,
      selectedDate,
    ).then(slots => {
      if (cancelled) return;
      setDaySlots(slots);
    }).catch((err) => {
      console.error(err);
      if (!cancelled) setDaySlots([]);
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [step, selectedDate, selectedStaff, selectedService, tenantId, staffList, timezone]);

  const handleCreateHold = async () => {
    if (!selectedTime || !selectedService) return;
    setErrorMessage(null);
    setLoading(true);
    try {
      const result = await createHold(
        tenantId,
        selectedService.id,
        selectedStaff,
        staffList.map(s => s.id),
        selectedTime,
        selectedDate,
        timezone,
      );
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      if (singleService) track("bookingStarted");
      setHold(result.data);
      setQuote(await getPublicCheckoutQuote(tenantId, selectedService.id));
      setStep(5);
    } catch (err) {
      console.error(err);
      setErrorMessage("No pudimos reservar ese horario. Intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const formIsValid = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const form = (e.currentTarget as HTMLButtonElement).form;
    return !form || form.reportValidity();
  };

  const continueToPayment = (e: React.SyntheticEvent) => {
    if (!formIsValid(e)) return;
    setErrorMessage(null);
    setStep(6);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const chooseDate = (dateISO: string) => {
    setSelectedDate(dateISO);
    setErrorMessage(null);
    setStep(4);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const createPreferenceAndRedirect = async (e: React.SyntheticEvent) => {
    if (!formIsValid(e) || !hold) return;
    setErrorMessage(null);
    setLoading(true);
    try {
      const result = await startPublicCheckout(slug, hold.id, clientData);
      if (!result.ok) {
        setErrorMessage(result.error);
        setLoading(false);
        return;
      }
      track("checkoutStarted");
      window.location.assign(result.data.init_point);
    } catch (err) {
      console.error(err);
      setErrorMessage("No pudimos iniciar el pago. Elegí el horario nuevamente.");
      setLoading(false);
    }
  };

  const reserveWithTransfer = async (e: React.SyntheticEvent) => {
    if (!formIsValid(e) || !hold) return;
    setErrorMessage(null);
    setLoading(true);
    try {
      const result = await startTransferBooking(slug, hold.id, clientData);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      track("checkoutStarted");
      setTransferPanel(result.data);
      setStep(7);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setErrorMessage("No pudimos reservar el turno. Elegí el horario nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div key={step} className="animate-fade-up space-y-lg">
        <ProgressHeader current={stepNumber("service")} total={visibleSteps.length} name="Servicio" title="Elegí tu tratamiento" />
        {!catalogLoaded ? (
          <p className="flex items-center justify-center gap-2 py-8 text-center font-body-md text-body-md text-on-surface-variant">
            <Icon name="progress_activity" className="animate-spin text-[18px]" />
            Cargando servicios...
          </p>
        ) : allServices.length === 0 ? (
          <p className="py-8 text-center font-body-md text-body-md text-on-surface-variant">
            Por ahora no hay servicios para reservar online.
          </p>
        ) : (
          <div className="space-y-4">
            {catalog.map(cat => (
              <div key={cat.id} className="space-y-2">
                <h2 className="font-headline-sm text-headline-sm text-on-surface">{cat.name}</h2>
                {cat.services.map((svc) => (
                  <Card
                    key={svc.id}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "cursor-pointer p-4 hover:border-primary/30",
                      svc.featured && "border-primary/40 bg-gradient-to-br from-primary/10 to-surface",
                    )}
                    onClick={() => {
                      track("bookingStarted");
                      void chooseService(svc);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      track("bookingStarted");
                      void chooseService(svc);
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        {svc.featured && (
                          <span className="mb-1 inline-flex items-center gap-1 rounded-pill bg-primary px-2 py-0.5 font-label-xs text-label-xs text-on-primary">
                            <Icon name="star" filled className="text-[11px]" />
                            Destacado
                          </span>
                        )}
                        <h3 className="break-words font-label-lg text-label-lg">{svc.name}</h3>
                        {svc.description && <p className="line-clamp-2 font-body-sm text-body-sm text-on-surface-variant">{svc.description}</p>}
                        <p className="font-body-sm text-body-sm text-on-surface-variant">{svc.duration} min</p>
                      </div>
                      <div className="shrink-0 font-label-lg text-label-lg tabular-nums">{money(svc.price)}</div>
                    </div>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (step === 2) {
    return (
      <div key={step} className="animate-fade-up space-y-lg">
        <ProgressHeader current={stepNumber("staff")} total={visibleSteps.length} name="Profesional" title="¿Con quién querés atenderte?" />
        {staffLoading ? (
          <p className="flex items-center justify-center gap-2 py-8 text-center font-body-md text-body-md text-on-surface-variant">
            <Icon name="progress_activity" className="animate-spin text-[18px]" />
            Buscando profesionales...
          </p>
        ) : (
          <div className="space-y-4">
            {/* "Cualquiera" solo tiene sentido si este servicio lo hace más de una persona. */}
            {staffList.length > 1 && (
              <Card
                role="button"
                tabIndex={0}
                className="flex cursor-pointer items-center gap-4 p-4 hover:border-primary/30"
                onClick={() => {
                  setSelectedStaff("any");
                  setStep(3);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setSelectedStaff("any");
                  setStep(3);
                }}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                  <Icon name="groups" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-label-lg text-label-lg">Cualquiera disponible</h3>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">Ver todos los horarios libres</p>
                </div>
              </Card>
            )}
            {staffList.map(staff => (
              <Card
                key={staff.id}
                role="button"
                tabIndex={0}
                className="flex cursor-pointer items-center gap-4 p-4 hover:border-primary/30"
                onClick={() => {
                  setSelectedStaff(staff.id);
                  setStep(3);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  setSelectedStaff(staff.id);
                  setStep(3);
                }}
              >
                <Avatar name={staff.name} src={staff.photo_url} size="lg" />
                <div className="min-w-0">
                  <h3 className="truncate font-label-lg text-label-lg">{staff.name}</h3>
                </div>
              </Card>
            ))}
          </div>
        )}
        {!singleService && <Button variant="ghost" onClick={() => setStep(1)}>Volver</Button>}
      </div>
    );
  }

  if (step === 3) {
    const today = new TZDate(new Date(), timezone);
    const firstDate = format(today, "yyyy-MM-dd");
    const lastDate = format(addDays(today, Math.max(0, maxBookingDays)), "yyyy-MM-dd");
    const backStep = showStaffStep ? 2 : singleService ? null : 1;
    return (
      <div key={step} className="animate-fade-up space-y-lg">
        <ProgressHeader current={stepNumber("date")} total={visibleSteps.length} name="Fecha" title="Elegí el día" />
        {selectedService && <p className="font-body-md text-body-md text-on-surface-variant">{selectedService.name} · {selectedService.duration} min · {money(selectedService.price)}</p>}
        <PublicMonthCalendar timezone={timezone} selectedDate={selectedDate} onSelect={chooseDate} minDate={firstDate} maxDate={lastDate} bookableWeekdays={bookableWeekdays} />
        <div className={cn("sticky bottom-[calc(var(--safe-b)+0.75rem)] z-20 flex items-center rounded-pill border border-border bg-surface/95 p-1 shadow-card-hover backdrop-blur-xl", backStep === null ? "justify-end" : "justify-between")}>
          {backStep !== null && <Button variant="ghost" onClick={() => setStep(backStep)}>Volver</Button>}
          <span className="pr-3 font-label-sm text-label-sm text-on-surface-variant">Elegí un día para continuar</span>
        </div>
      </div>
    );
  }

  if (step === 4) {
    return (
      <div key={step} className="animate-fade-up space-y-lg">
        <ProgressHeader current={stepNumber("time")} total={visibleSteps.length} name="Horario" title="Elegí un horario" />
        <p className="font-body-md text-body-md capitalize text-on-surface-variant">{format(new TZDate(`${selectedDate}T12:00:00`, timezone), "EEEE d 'de' MMMM", { locale: es })}</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {loading ? (
            <p className="col-span-4 flex items-center justify-center gap-2 py-8 text-center font-body-md text-body-md text-on-surface-variant">
              <Icon name="progress_activity" className="animate-spin text-[18px]" />
              Buscando horarios...
            </p>
          ) : daySlots.length === 0 ? (
            <p className="col-span-4 animate-fade-up py-8 text-center font-body-md text-body-md text-on-surface-variant">No hay horarios disponibles para esta fecha.</p>
          ) : (
            daySlots.map((slot, i) => (
              <button
                key={slot.starts_at}
                type="button"
                disabled={!slot.available}
                aria-pressed={selectedTime === slot.starts_at}
                aria-label={`${format(new TZDate(parseISO(slot.starts_at), timezone), "HH:mm")}${slot.available ? "" : ", ocupado"}`}
                onClick={() => setSelectedTime(slot.starts_at)}
                style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                className={cn(
                  "min-h-12 min-w-0 animate-fade-up rounded-inner border px-1 font-label-lg text-label-lg tabular-nums transition-all duration-200 ease-out active:scale-95",
                  selectedTime === slot.starts_at
                    ? "border-primary bg-primary text-on-primary shadow-card-hover"
                    : slot.available
                      ? "border-border bg-surface hover:-translate-y-0.5 hover:bg-surface-muted hover:shadow-card"
                      : "cursor-not-allowed border-border/60 bg-surface-container-low text-on-surface-variant/50 line-through",
                )}
              >
                <span className="block">{format(new TZDate(parseISO(slot.starts_at), timezone), "HH:mm")}</span>
                {!slot.available && <span className="block text-[10px] font-medium no-underline">Ocupado</span>}
              </button>
            ))
          )}
        </div>
        <p className="flex items-center gap-2 font-body-sm text-body-sm text-on-surface-variant"><span className="h-px w-5 bg-on-surface-variant/50" />Los horarios tachados ya tienen reserva.</p>

        {errorMessage && <p role="alert" className="rounded-inner bg-status-alert-bg px-3 py-2 font-body-sm text-body-sm text-status-alert">{errorMessage}</p>}

        <div className="sticky bottom-[calc(var(--safe-b)+0.75rem)] z-20 flex items-center justify-between rounded-pill border border-border bg-surface/95 p-1 shadow-card-hover backdrop-blur-xl">
          <Button variant="ghost" onClick={() => { setErrorMessage(null); setStep(3); }}>Cambiar fecha</Button>
          <Button
            onClick={handleCreateHold}
            disabled={!selectedTime || loading}
          >
            Continuar
          </Button>
        </div>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div key={step} className="animate-fade-up space-y-lg">
        <ProgressHeader current={stepNumber("data")} total={visibleSteps.length} name="Tus datos" title="¿A nombre de quién reservamos?" />

        <Card hoverLift={false} className="space-y-2 bg-surface-muted p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="break-words font-label-lg text-label-lg">{selectedService?.name}</div>
              <div className="font-body-md text-body-md text-on-surface-variant first-letter:uppercase">
                {format(new TZDate(parseISO(selectedTime!), timezone), "EEEE d 'de' MMMM, HH:mm 'hs'", { locale: es })}
              </div>
            </div>
            <strong className="shrink-0 font-headline-sm text-headline-sm tabular-nums text-on-surface">{money(selectedService?.price ?? 0)}</strong>
          </div>
          {quote && <div className="flex items-center justify-between border-t border-border pt-2 font-body-sm text-body-sm text-on-surface-variant"><span>Seña para reservar</span><strong className="tabular-nums text-on-surface">{money(quote.appliedAmount)}</strong></div>}
        </Card>

        <form className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="client_full_name" className="font-label-md text-label-md text-on-surface-variant">Nombre completo</label>
            <Input
              id="client_full_name"
              required
              autoComplete="name"
              value={clientData.full_name}
              onChange={e => setClientData({...clientData, full_name: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="client_phone" className="font-label-md text-label-md text-on-surface-variant">Teléfono (WhatsApp)</label>
            <Input
              id="client_phone"
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="11 2233 4455"
              aria-describedby="client_phone_hint"
              value={clientData.phone_e164}
              onChange={e => setClientData({...clientData, phone_e164: e.target.value})}
            />
            <p id="client_phone_hint" className="px-1 font-body-sm text-body-sm text-on-surface-variant">{PHONE_HINT}</p>
          </div>
          <div className="space-y-1">
            <label htmlFor="client_email" className="font-label-md text-label-md text-on-surface-variant">Email</label>
            <Input
              id="client_email"
              type="email"
              required
              autoComplete="email"
              value={clientData.email}
              onChange={e => setClientData({...clientData, email: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="client_age" className="font-label-md text-label-md text-on-surface-variant">Edad</label>
            <Input id="client_age" type="number" inputMode="numeric" min={1} max={110} step={1} required placeholder="Ej: 34" value={clientData.age} onChange={e => setClientData({...clientData, age: e.target.value})} />
          </div>

          <p className="flex gap-2 rounded-inner bg-surface-container-low px-3 py-2.5 font-body-sm text-body-sm text-on-surface-variant">
            <Icon name="lock" className="mt-0.5 shrink-0 text-[16px] text-secondary" />
            Tus datos solo serán utilizados para enviarte la confirmación, el enlace para gestionar y el recordatorio de tu turno.
          </p>

          {errorMessage && <p role="alert" className="rounded-inner bg-status-alert-bg px-3 py-2 font-body-sm text-body-sm text-status-alert">{errorMessage}</p>}
          <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
            <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => { setErrorMessage(null); setStep(4); }}>Volver</Button>
            <Button type="button" onClick={continueToPayment} disabled={!quote} className="w-full min-w-0 sm:flex-1">Continuar al pago</Button>
          </div>
        </form>
      </div>
    );
  }

  if (step === 6) {
    const startsAt = selectedTime ? new Date(selectedTime) : null;
    const transferPossible = paymentMethods.transfer && startsAt !== null && transferAllowedFor(startsAt);
    const mpPossible = paymentMethods.mercadopago;
    const chosen: PayMethod | null = method === "transfer" && transferPossible ? "transfer" : mpPossible ? "mercadopago" : transferPossible ? "transfer" : null;
    const canChoose = mpPossible && transferPossible;
    return (
      <div key={step} className="animate-fade-up space-y-lg">
        <ProgressHeader current={stepNumber("payment")} total={visibleSteps.length} name="Pago" title="Confirmá y pagá la seña" />
        <Card hoverLift={false} className="space-y-2 bg-surface-muted p-4">
          <div className="break-words font-label-lg text-label-lg">{selectedService?.name}</div>
          <div className="font-body-md text-body-md text-on-surface-variant first-letter:uppercase">{format(new TZDate(parseISO(selectedTime!), timezone), "EEEE d 'de' MMMM, HH:mm 'hs'", { locale: es })}</div>
          {quote && <div className="mt-3 space-y-1 border-t border-border pt-3 font-body-md text-body-md">
            <div className="flex justify-between gap-3"><span>Seña</span><strong className="tabular-nums">{money(quote.appliedAmount)}</strong></div>
            {chosen !== "transfer" && quote.surchargeAmount > 0 && <div className="flex justify-between gap-3 text-on-surface-variant"><span>Cargo de procesamiento</span><span className="tabular-nums">{money(quote.surchargeAmount)}</span></div>}
            <div className="flex justify-between gap-3 font-label-lg text-label-lg"><span>Total a pagar ahora</span><span className="tabular-nums">{money(chosen === "transfer" ? quote.appliedAmount : quote.grossAmount)}</span></div>
          </div>}
        </Card>
        {canChoose && <fieldset className="space-y-2">
          <legend className="mb-1 font-label-md text-label-md text-on-surface-variant">¿Cómo querés pagar la seña?</legend>
          {([
            { id: "mercadopago", title: "Mercado Pago", hint: "Tarjeta o dinero en cuenta. Se confirma al instante.", icon: "credit_card" },
            { id: "transfer", title: "Transferencia bancaria", hint: "Te mostramos alias y CBU; se confirma cuando llega.", icon: "account_balance" },
          ] as const).map((option) => <label key={option.id} className={cn("flex min-h-14 cursor-pointer items-center gap-3 rounded-inner border-2 p-md transition-colors", chosen === option.id ? "border-primary bg-secondary-soft" : "border-border bg-surface hover:bg-surface-muted")}>
            <input type="radio" name="pay_method" value={option.id} checked={chosen === option.id} onChange={() => setMethod(option.id)} className="sr-only" />
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-secondary"><Icon name={option.icon} className="text-[19px]" /></span>
            <span className="min-w-0"><span className="block font-label-lg text-label-lg text-on-surface">{option.title}</span><span className="block font-body-sm text-body-sm text-on-surface-variant">{option.hint}</span></span>
          </label>)}
        </fieldset>}
        {paymentMethods.transfer && mpPossible && !transferPossible && <p className="rounded-inner bg-surface-container-low px-3 py-2 font-body-sm text-body-sm text-on-surface-variant">Para turnos con menos de {TRANSFER_MIN_LEAD_HOURS} h de anticipación la seña se paga con Mercado Pago.</p>}
        <div className="space-y-2 rounded-inner border border-secondary/25 bg-secondary-soft p-3 font-body-sm text-body-sm text-on-surface">
          <p className="flex gap-2"><Icon name="verified_user" className="mt-0.5 shrink-0 text-[17px] text-secondary" /><span>La seña es reembolsable cancelando hasta <strong>{cancellationRefundHours} horas antes del turno</strong>.</span></p>
          <p className="flex gap-2"><Icon name="link" className="mt-0.5 shrink-0 text-[17px] text-secondary" /><span>Te enviaremos por email un enlace único para consultar, reprogramar o cancelar tu reserva.</span></p>
        </div>
        {errorMessage && <p role="alert" className="rounded-inner bg-status-alert-bg px-3 py-2 font-body-sm text-body-sm text-status-alert">{errorMessage}</p>}
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => setStep(5)}>Volver</Button>
          {chosen === "transfer" ? <Button type="button" onClick={reserveWithTransfer} disabled={loading || !quote} className="w-full min-w-0 sm:flex-1"><Icon name="account_balance" className="text-[18px]" />{loading ? "Reservando..." : "Reservar y ver datos para transferir"}</Button>
            : chosen === "mercadopago" ? <button type="button" onClick={createPreferenceAndRedirect} disabled={loading || !quote} className="inline-flex min-h-11 w-full min-w-0 items-center justify-center rounded-pill bg-primary px-4 font-label-lg text-label-lg text-on-primary disabled:opacity-50 sm:flex-1" data-mp-checkout-cta="checkout-pro" data-mp-marketplace-checkout="checkout-pro"><MercadoPagoLogo className="mr-2 rounded-full bg-white px-1 py-0.5 text-[20px]" />{loading ? "Abriendo Mercado Pago..." : "Pagar seña con Mercado Pago"}</button>
            : <p className="font-body-sm text-body-sm text-status-alert">Ese horario está muy cerca para pagar la seña por transferencia. Volvé y elegí otro.</p>}
        </div>
      </div>
    );
  }

  if (step === 7 && transferPanel) {
    return <div data-booking-confirmation><TransferInstructions key={step} panel={transferPanel} /></div>;
  }

  return null;
}

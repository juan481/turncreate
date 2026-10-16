"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { longDayLabel, weekdayOf } from "@/lib/dates";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { MonthCalendar } from "@/components/ui/month-calendar";
import { StepPanel, StepperHeader } from "@/components/ui/stepper";
import { cn } from "@/lib/utils";
import { ClientField, type ClientOption } from "./client-field";
import { SlotPicker, SummaryStep, type Slot } from "./slots-and-deposit";
import {
  eligibleStaffFor,
  needsStaffStep,
  resolveStaffId,
  suggestedDepositFor,
  type DepositRule,
  type ServiceOption,
  type StaffOption,
} from "./booking-rules";

type StepKey = "cliente" | "profesional" | "horario" | "resumen";

const STEP_TITLES: Record<StepKey, string> = {
  cliente: "Cliente y servicio",
  profesional: "Profesional",
  horario: "Día y horario",
  resumen: "Resumen",
};

/**
 * "Nuevo turno" como stepper de 4 pasos: (1) cliente + servicio,
 * (2) profesional -- se saltea solo cuando hay un único profesional
 * posible para el servicio --, (3) día en un calendario mensual + horario,
 * (4) resumen con seña/nota y "Crear turno".
 *
 * Todo el estado vive acá (solo se monta el paso actual), así que ir y
 * volver entre pasos no pierde nada.
 *
 * Los horarios se siguen calculando en el SERVIDOR para la combinación
 * actual: al entrar al paso 3 o cambiar de día se hace un router.replace
 * con ?serviceId=&staffId=&date= (sin sumar historial) y la página
 * devuelve `slots` junto con `slotsFor` (para qué combinación son). La
 * lista solo se muestra si `slotsFor` coincide con lo elegido y no hay
 * navegación en vuelo -- nunca se puede tocar un horario de una
 * combinación vieja (el bug que tenía el formulario GET original).
 */
export function TurnoForm({
  tenantSlug,
  todayISO,
  lastDateISO,
  openWeekdays,
  staffList,
  servicesList,
  clientsList,
  initialStaffId,
  initialServiceId,
  initialClientId,
  initialDateISO,
  slotsFor,
  slots,
  depositRule,
  rescheduleFrom,
  keepDeposit,
}: {
  tenantSlug: string;
  todayISO: string;
  lastDateISO: string;
  /** Días de la semana (0 = domingo) en que el local abre. */
  openWeekdays: number[];
  staffList: StaffOption[];
  servicesList: ServiceOption[];
  clientsList: ClientOption[];
  initialStaffId: string;
  initialServiceId: string;
  initialClientId?: string;
  initialDateISO: string;
  slotsFor: { serviceId: string; staffId: string; dateISO: string };
  slots: Slot[];
  depositRule: DepositRule;
  rescheduleFrom?: string;
  keepDeposit: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [createdClients, setCreatedClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [serviceId, setServiceId] = useState(initialServiceId);
  const [staffId, setStaffId] = useState(initialStaffId);
  const [dateISO, setDateISO] = useState(initialDateISO);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [step, setStep] = useState<StepKey>(() =>
    initialClientId && initialServiceId && initialStaffId ? "horario" : "cliente",
  );
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  // Los clientes creados en este flujo todavía no vienen en `clientsList`
  // hasta la próxima navegación: se suman adelante, sin duplicar.
  const clients = useMemo(() => {
    const createdIds = new Set(createdClients.map((c) => c.id));
    return [...createdClients, ...clientsList.filter((c) => !createdIds.has(c.id))];
  }, [createdClients, clientsList]);

  const steps: StepKey[] = needsStaffStep(staffList, serviceId)
    ? ["cliente", "profesional", "horario", "resumen"]
    : ["cliente", "horario", "resumen"];
  const stepIndex = Math.max(0, steps.indexOf(step));

  const selectedClient = clients.find((c) => c.id === clientId);
  const selectedService = servicesList.find((s) => s.id === serviceId);
  const selectedStaff = staffList.find((s) => s.id === staffId);

  const slotsMatch = slotsFor.serviceId === serviceId && slotsFor.staffId === staffId && slotsFor.dateISO === dateISO;
  const slotsReady = slotsMatch && !isPending;

  function navigate(next: { serviceId: string; staffId: string; dateISO: string }) {
    const params = new URLSearchParams();
    params.set("date", next.dateISO);
    if (next.serviceId) params.set("serviceId", next.serviceId);
    if (next.staffId) params.set("staffId", next.staffId);
    if (clientId) params.set("clientId", clientId);
    if (rescheduleFrom) {
      params.set("rescheduleFrom", rescheduleFrom);
      params.set("keepDeposit", keepDeposit ? "true" : "false");
    }
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  // Al cambiar de paso, el encabezado vuelve a quedar a la vista (el
  // contenedor del modal puede haber quedado scrolleado abajo, p. ej.
  // después de una lista larga de horarios).
  const headerRef = useRef<HTMLDivElement>(null);
  function revealHeader() {
    requestAnimationFrame(() => headerRef.current?.scrollIntoView({ block: "nearest" }));
  }

  function goTo(target: StepKey) {
    setDirection(steps.indexOf(target) >= stepIndex ? "forward" : "back");
    setStep(target);
    revealHeader();
    if (target === "horario" && !slotsMatch) navigate({ serviceId, staffId, dateISO });
  }

  function next() {
    const target = steps[stepIndex + 1];
    if (target) goTo(target);
  }

  function back() {
    const target = steps[stepIndex - 1];
    if (target) goTo(target);
  }

  function chooseService(id: string) {
    setServiceId(id);
    setStaffId((current) => resolveStaffId(staffList, id, current));
    setSlot(null);
  }

  function chooseStaff(id: string) {
    setStaffId(id);
    setSlot(null);
  }

  function chooseDate(iso: string) {
    if (iso === dateISO) return;
    setDateISO(iso);
    setSlot(null);
    navigate({ serviceId, staffId, dateISO: iso });
  }

  const openSet = useMemo(() => new Set(openWeekdays), [openWeekdays]);

  const canContinue =
    step === "cliente"
      ? Boolean(clientId && serviceId)
      : step === "profesional"
        ? Boolean(staffId)
        : step === "horario"
          ? Boolean(slot)
          : false;

  const missingHint =
    step === "cliente" && !canContinue
      ? !clientId && !serviceId
        ? "Elegí el cliente y el servicio para seguir."
        : !clientId
          ? "Falta elegir el cliente."
          : "Falta elegir el servicio."
      : step === "profesional" && !staffId
        ? "Elegí con quién va el turno."
        : null;

  return (
    <div className="flex min-w-0 flex-col gap-lg">
      <div ref={headerRef} className="scroll-mt-4">
        <StepperHeader current={stepIndex + 1} total={steps.length} title={STEP_TITLES[step]} />
      </div>

      <StepPanel key={step} direction={direction} className="min-w-0">
        {step === "cliente" && (
          <div className="flex flex-col gap-lg">
            <ClientField
              tenantSlug={tenantSlug}
              clients={clients}
              value={clientId}
              onChange={setClientId}
              onCreated={(client) => setCreatedClients((prev) => [client, ...prev])}
            />
            <ServicePicker services={servicesList} value={serviceId} onChange={chooseService} />
          </div>
        )}

        {step === "profesional" && (
          <StaffPicker staff={staffList} serviceId={serviceId} value={staffId} onChange={chooseStaff} />
        )}

        {step === "horario" && (
          <div className="flex flex-col gap-lg">
            <MonthCalendar
              value={dateISO}
              onChange={chooseDate}
              todayISO={todayISO}
              minISO={todayISO}
              maxISO={lastDateISO}
              isDayDisabled={(iso) => !openSet.has(weekdayOf(iso))}
            />
            <div className="space-y-2">
              <p className="font-label-md text-label-md text-on-surface-variant">
                Horarios del <span className="text-on-surface">{longDayLabel(dateISO, { capital: false })}</span>
              </p>
              {slotsReady ? (
                <SlotPicker
                  slots={slots}
                  value={slot?.startsAtISO ?? null}
                  onSelect={(chosen) => {
                    setSlot(chosen);
                    setDirection("forward");
                    setStep("resumen");
                    revealHeader();
                  }}
                />
              ) : !isPending ? (
                // Red de seguridad: si por algo la página no devolvió los
                // horarios de esta combinación, se pueden pedir a mano en
                // vez de quedar "buscando" para siempre.
                <Button type="button" variant="secondary" className="w-full" onClick={() => navigate({ serviceId, staffId, dateISO })}>
                  <Icon name="autorenew" className="text-[18px]" />
                  Ver horarios
                </Button>
              ) : (
                <p
                  role="status"
                  className="flex items-center justify-center gap-2 rounded-inner bg-surface-container-low p-lg font-body-sm text-body-sm text-on-surface-variant"
                >
                  <Icon name="progress_activity" className="animate-spin text-[18px]" />
                  Buscando horarios…
                </p>
              )}
            </div>
          </div>
        )}

        {step === "resumen" && selectedClient && selectedService && slot && (
          <SummaryStep
            tenantSlug={tenantSlug}
            client={{ id: selectedClient.id, name: selectedClient.full_name }}
            service={selectedService}
            staff={
              staffId === "any"
                ? { id: "any", name: "Cualquiera", photoUrl: null }
                : { id: staffId, name: selectedStaff?.displayName ?? "", photoUrl: selectedStaff?.photoUrl ?? null }
            }
            dateISO={dateISO}
            slot={slot}
            suggestedDeposit={suggestedDepositFor(selectedService.price, depositRule)}
            rescheduleFrom={rescheduleFrom}
            keepDeposit={keepDeposit}
          />
        )}
      </StepPanel>

      {missingHint && <p className="-mt-2 font-body-sm text-body-sm text-on-surface-variant">{missingHint}</p>}

      {/* En los pasos con "Siguiente" la barra queda pegada abajo (en este
          flujo no hay barra inferior): con muchos servicios el botón quedaba
          fuera de la pantalla. En Resumen va estática, debajo de "Crear turno". */}
      <div
        className={cn(
          "flex min-w-0 items-center gap-2",
          step !== "resumen" && "sticky bottom-[calc(0.75rem+var(--safe-b))] z-20 -mx-2 rounded-pill bg-canvas/90 p-2 backdrop-blur-md",
        )}
      >
        {stepIndex > 0 && (
          <Button type="button" variant="secondary" onClick={back} className="shrink-0">
            <Icon name="chevron_left" className="text-[18px]" />
            Atrás
          </Button>
        )}
        {step !== "resumen" && (
          <Button type="button" onClick={next} disabled={!canContinue} className="min-w-0 flex-1">
            Siguiente
            <Icon name="chevron_right" className="text-[18px]" />
          </Button>
        )}
      </div>
    </div>
  );
}

function ServicePicker({
  services,
  value,
  onChange,
}: {
  services: ServiceOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="font-label-md text-label-md text-on-surface-variant">Servicio</span>
      <div role="group" aria-label="Servicio" className="flex flex-col gap-2">
        {services.map((s) => {
          const active = s.id === value;
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(s.id)}
              className={cn(
                "flex min-h-11 min-w-0 items-center justify-between gap-2 rounded-inner border px-4 py-2 text-left transition-all duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
                active ? "border-primary bg-primary/10" : "border-border bg-surface-muted hover:bg-surface-container",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                {active && <Icon name="check_circle" className="shrink-0 text-[16px] text-primary" />}
                <span className="min-w-0 truncate font-label-md text-label-md text-on-surface">{s.name}</span>
              </span>
              <span className="shrink-0 font-label-md text-label-md tabular-nums text-on-surface-variant">
                ${s.price.toLocaleString("es-AR")}
              </span>
            </button>
          );
        })}
        {services.length === 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">Todavía no hay servicios activos.</p>
        )}
      </div>
    </div>
  );
}

function StaffPicker({
  staff,
  serviceId,
  value,
  onChange,
}: {
  staff: StaffOption[];
  serviceId: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const { options, allowAny } = eligibleStaffFor(staff, serviceId);

  if (options.length === 0) {
    return (
      <p className="rounded-inner bg-surface-container-low p-3 font-body-sm text-body-sm text-on-surface-variant">
        Todavía no hay profesionales activos. Sumá al menos uno en Equipo para poder agendar.
      </p>
    );
  }

  const rows: { id: string; name: string; photoUrl: string | null; hint?: string }[] = [
    ...(allowAny ? [{ id: "any", name: "Cualquiera", photoUrl: null, hint: "Se asigna al primero que tenga el horario libre" }] : []),
    ...options.map((s) => ({ id: s.id, name: s.displayName, photoUrl: s.photoUrl })),
  ];

  return (
    <div role="group" aria-label="Profesional" className="flex flex-col gap-2">
      {rows.map((row) => {
        const active = row.id === value;
        return (
          <button
            key={row.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(row.id)}
            className={cn(
              "flex min-h-14 min-w-0 items-center gap-3 rounded-inner border px-3 py-2 text-left transition-colors duration-200 motion-reduce:transition-none",
              active ? "border-primary bg-primary/10" : "border-border bg-surface-muted hover:bg-surface-container",
            )}
          >
            {row.id === "any" ? (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
                <Icon name="groups" className="text-[18px]" />
              </span>
            ) : (
              <Avatar name={row.name} src={row.photoUrl} size="md" />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-label-lg text-label-lg text-on-surface">{row.name}</span>
              {row.hint && <span className="block truncate font-body-sm text-body-sm text-on-surface-variant">{row.hint}</span>}
            </span>
            {active && <Icon name="check_circle" className="shrink-0 text-[18px] text-primary" />}
          </button>
        );
      })}
    </div>
  );
}

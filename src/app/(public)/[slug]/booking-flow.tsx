"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO, addDays, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import {
  getPublicCatalog,
  getPublicStaffForService,
  getAvailableSlots,
  createHold,
  confirmHold,
} from "./actions";
import type { PublicCategory, PublicHold, PublicService, PublicStaffMember, PublicAppointment } from "./types";

export function BookingFlow({
  tenantId,
  slug,
  timezone,
  rescheduleFrom,
}: {
  tenantId: string;
  slug: string;
  timezone: string;
  rescheduleFrom?: string;
}) {
  const [step, setStep] = useState(1);
  const [catalog, setCatalog] = useState<PublicCategory[]>([]);
  const [staffList, setStaffList] = useState<PublicStaffMember[]>([]);

  const [selectedService, setSelectedService] = useState<PublicService | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string>("any");
  const [selectedDate, setSelectedDate] = useState<string>(startOfToday().toISOString().split("T")[0]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [hold, setHold] = useState<PublicHold | null>(null);
  const [clientData, setClientData] = useState({ full_name: "", phone_e164: "", email: "" });

  const [loading, setLoading] = useState(false);
  const [confirmedData, setConfirmedData] = useState<PublicAppointment | null>(null);

  useEffect(() => {
    getPublicCatalog(tenantId).then(setCatalog);
  }, [tenantId]);

  useEffect(() => {
    // staffList arranca en [] -- no hace falta resetearlo acá, solo
    // evitar el fetch cuando todavía no hay servicio elegido.
    if (!selectedService) return;
    getPublicStaffForService(tenantId, selectedService.id).then(setStaffList);
  }, [tenantId, selectedService]);

  useEffect(() => {
    if (step !== 3 || !selectedService) return;

    let cancelled = false;
    // Flag de loading para el fetch de slots al cambiar fecha/staff/servicio;
    // no hay forma de derivarlo sin loading propio (availableSlots queda
    // "stale" del fetch anterior mientras llega el nuevo).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getAvailableSlots(
      tenantId,
      selectedService.id,
      selectedStaff,
      selectedDate,
      timezone,
      staffList.map(s => s.id)
    ).then(slots => {
      if (cancelled) return;
      setAvailableSlots(slots);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [step, selectedDate, selectedStaff, selectedService, tenantId, staffList, timezone]);

  const handleCreateHold = async () => {
    if (!selectedTime || !selectedService) return;
    setLoading(true);
    try {
      const h = await createHold(
        tenantId,
        selectedService.id,
        selectedStaff,
        staffList.map(s => s.id),
        selectedTime,
        selectedDate,
        timezone,
        rescheduleFrom,
      );
      setHold(h);
      setStep(4);
    } catch (err) {
      console.error(err);
      alert("Error al reservar el turno. Por favor intentá de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hold) return;
    setLoading(true);
    try {
      const result = await confirmHold(hold.id, clientData);
      setConfirmedData(result);
      setStep(5);
    } catch (err) {
      console.error(err);
      alert("Error al confirmar. La reserva pudo haber expirado.");
    } finally {
      setLoading(false);
    }
  };

  if (step === 1) {
    return (
      <div className="space-y-lg">
        <div className="space-y-2">
          {rescheduleFrom && (
            <StatusPill status="draft">Estás reprogramando tu turno</StatusPill>
          )}
          <StatusPill status="pending">Paso 1 de 4 · Servicio</StatusPill>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            Elegí tu tratamiento
          </h1>
        </div>
        <div className="space-y-4">
          {catalog.map(cat => (
            <div key={cat.id} className="space-y-2">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">{cat.name}</h2>
              {cat.services.map((svc) => (
                <Card 
                  key={svc.id} 
                  className="p-4 cursor-pointer hover:border-primary transition-colors"
                  onClick={() => {
                    setSelectedService(svc);
                    setStep(2);
                  }}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-label-lg text-label-lg">{svc.name}</h3>
                      <p className="text-on-surface-variant font-body-sm">{svc.duration} min</p>
                    </div>
                    <div className="font-label-lg">${svc.price}</div>
                  </div>
                </Card>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="space-y-lg">
        <div className="space-y-2">
          <StatusPill status="pending">Paso 2 de 4 · Profesional</StatusPill>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            ¿Con quién querés atenderte?
          </h1>
        </div>
        <div className="space-y-4">
          <Card 
            className="p-4 cursor-pointer hover:border-primary transition-colors flex items-center gap-4"
            onClick={() => {
              setSelectedStaff("any");
              setStep(3);
            }}
          >
            <div className="w-12 h-12 rounded-full bg-surface-muted flex items-center justify-center">
              <Icon name="groups" />
            </div>
            <div>
              <h3 className="font-label-lg text-label-lg">Cualquiera disponible</h3>
              <p className="text-on-surface-variant font-body-sm">Ver todos los horarios libres</p>
            </div>
          </Card>
          {staffList.map(staff => (
            <Card 
              key={staff.id} 
              className="p-4 cursor-pointer hover:border-primary transition-colors flex items-center gap-4"
              onClick={() => {
                setSelectedStaff(staff.id);
                setStep(3);
              }}
            >
              <div className="w-12 h-12 rounded-full bg-surface-muted flex items-center justify-center">
                <Icon name="person" />
              </div>
              <div>
                <h3 className="font-label-lg text-label-lg">{staff.name}</h3>
              </div>
            </Card>
          ))}
        </div>
        <Button variant="ghost" onClick={() => setStep(1)}>Volver</Button>
      </div>
    );
  }

  if (step === 3) {
    const dates = Array.from({ length: 14 }).map((_, i) => addDays(startOfToday(), i));
    return (
      <div className="space-y-lg">
        <div className="space-y-2">
          <StatusPill status="pending">Paso 3 de 4 · Fecha y Hora</StatusPill>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            ¿Cuándo venís?
          </h1>
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dates.map(d => {
            const dateStr = d.toISOString().split("T")[0];
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`min-w-[80px] p-2 rounded-xl border ${selectedDate === dateStr ? 'bg-primary text-on-primary border-primary' : 'bg-surface border-border'} text-center flex-shrink-0`}
              >
                <div className="text-xs uppercase opacity-80">{format(d, "EEE", { locale: es })}</div>
                <div className="text-xl font-bold">{format(d, "d")}</div>
              </button>
            )
          })}
        </div>

        <div className="grid grid-cols-4 gap-2">
          {loading ? (
            <p className="col-span-4 text-center text-on-surface-variant py-8">Buscando horarios...</p>
          ) : availableSlots.length === 0 ? (
            <p className="col-span-4 text-center text-on-surface-variant py-8">No hay horarios disponibles para esta fecha.</p>
          ) : (
            availableSlots.map(slot => (
              <button
                key={slot}
                onClick={() => setSelectedTime(slot)}
                className={`py-2 rounded-pill border text-sm font-medium transition-colors ${selectedTime === slot ? 'bg-primary text-on-primary border-primary' : 'bg-surface border-border hover:bg-surface-muted'}`}
              >
                {format(parseISO(slot), "HH:mm")}
              </button>
            ))
          )}
        </div>
        
        <div className="flex justify-between items-center pt-4">
          <Button variant="ghost" onClick={() => setStep(2)}>Volver</Button>
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

  if (step === 4) {
    return (
      <div className="space-y-lg">
        <div className="space-y-2">
          <StatusPill status="pending">Paso 4 de 4 · Tus datos</StatusPill>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
            Confirmá tu turno
          </h1>
        </div>
        
        <Card className="p-4 space-y-2 bg-surface-muted">
          <div className="font-label-md">{selectedService?.name}</div>
          <div className="text-on-surface-variant text-sm">
            {format(parseISO(selectedTime!), "EEEE d 'de' MMMM, HH:mm 'hs'", { locale: es })}
          </div>
        </Card>

        <form onSubmit={handleConfirm} className="space-y-4">
          <div className="space-y-1">
            <label className="font-label-md text-label-md text-on-surface-variant">Nombre completo</label>
            <Input
              required
              value={clientData.full_name}
              onChange={e => setClientData({...clientData, full_name: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="font-label-md text-label-md text-on-surface-variant">Teléfono (WhatsApp)</label>
            <Input
              required
              type="tel"
              placeholder="+5491122334455"
              value={clientData.phone_e164}
              onChange={e => setClientData({...clientData, phone_e164: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="font-label-md text-label-md text-on-surface-variant">Email (opcional)</label>
            <Input
              type="email"
              value={clientData.email}
              onChange={e => setClientData({...clientData, email: e.target.value})}
            />
          </div>

          <div className="pt-4 flex gap-4">
            <Button type="button" variant="ghost" onClick={() => setStep(3)}>Volver</Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Confirmando..." : "Confirmar turno"}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  if (step === 5) {
    return (
      <div className="space-y-lg text-center py-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-status-confirmed-bg text-status-confirmed">
          <Icon name="check" className="text-[28px]" />
        </div>
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
          ¡Turno confirmado!
        </h1>
        <p className="mx-auto max-w-sm font-body-md text-body-md text-on-surface-variant">
          Te esperamos el {format(parseISO(selectedTime!), "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es })}.
        </p>
        {confirmedData?.token && (
          <Link
            href={`/${slug}/mi-turno/${confirmedData.token}`}
            className={buttonVariants({ variant: "secondary" })}
          >
            Ver mi turno
          </Link>
        )}
      </div>
    );
  }

  return null;
}

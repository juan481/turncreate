import Link from "next/link";
import { TZDate } from "@date-fns/tz";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { type StatusPillStatus } from "@/components/ui/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { firebaseAdmin } from "@/server/firebase/admin";
import { requireTenantPage } from "@/server/firebase/tenant-page";
import { ageFromBirthYear } from "@/lib/schemas/client";
import { todayISO } from "@/lib/dates";
import { ClientNotes } from "./client-notes";

const STATUS_LABEL: Record<string, { label: string; tone: StatusPillStatus }> = {
  pending_payment: { label: "Pendiente de pago", tone: "pending" },
  confirmed: { label: "Confirmado", tone: "confirmed" },
  completed: { label: "Completado", tone: "confirmed" },
  no_show: { label: "No vino", tone: "alert" },
  cancelled: { label: "Cancelado", tone: "alert" },
  expired: { label: "Vencido", tone: "alert" },
};

type AppointmentRow = {
  id: string;
  status: string;
  startsAt: { toDate?: () => Date } | string;
  staffName?: string;
  staffPhoto?: string | null;
  total?: number;
  items?: { name?: string }[];
  note?: string | null;
};

export default async function ClientDetailPage({ params }: PageProps<"/app/[tenant]/clientes/[clientId]">) {
  const { tenant: tenantSlug, clientId } = await params;
  const { tenant } = await requireTenantPage(tenantSlug);
  const { db } = firebaseAdmin();
  const clientRef = db.collection("tenants").doc(tenant.id).collection("clients").doc(clientId);
  const [clientSnapshot, notesSnapshot, appointmentsSnapshot] = await Promise.all([
    clientRef.get(),
    clientRef.collection("notes").orderBy("createdAt", "desc").get(),
    // Sin `.limit()` a propósito: "Turnos"/"Gastado"/"Ausencias" se calculan
    // abajo a partir de TODOS los turnos del cliente (los contadores
    // denormalizados en el documento del cliente nunca se actualizan), y
    // el historial visible usa solo los primeros 10 de esta misma lista.
    db
      .collection("tenants")
      .doc(tenant.id)
      .collection("appointments")
      .where("clientId", "==", clientId)
      .orderBy("startsAt", "desc")
      .get(),
  ]);
  if (!clientSnapshot.exists) notFound();
  const client = clientSnapshot.data()!;
  const notes = notesSnapshot.docs.map((doc) => {
    const note = doc.data();
    return {
      id: doc.id,
      body: note.body as string,
      is_clinical: Boolean(note.isClinical),
      created_at: note.createdAt?.toDate?.().toISOString?.() ?? new Date(0).toISOString(),
    };
  });
  const allAppointments = appointmentsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as AppointmentRow);
  const recentAppointments = allAppointments.slice(0, 10);
  const completedAppointments = allAppointments.filter((app) => app.status === "completed");
  const turnosCount = completedAppointments.length;
  // Es plata efectivamente registrada, no el precio teórico de los turnos
  // completados (un servicio puede quedar con saldo pendiente).
  const totalSpent = Number(client.totalSpent ?? 0);
  const noShowCount = allAppointments.filter((app) => app.status === "no_show").length;
  const age = ageFromBirthYear(client.birthYear, Number(todayISO(tenant.timezone).slice(0, 4)));

  return (
    <div className="space-y-lg">
      <div className="flex items-center gap-3">
        <Link
          href={`/app/${tenantSlug}/clientes`}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant transition-colors hover:bg-surface-container lg:flex"
          aria-label="Volver"
        >
          <Icon name="arrow_back" className="text-[18px]" />
        </Link>
        <Avatar name={client.fullName as string} src={(client.photoUrl as string | null) ?? null} size="md" />
        <h1 className="min-w-0 truncate font-headline-lg-mobile text-headline-lg-mobile text-on-surface">
          {client.fullName as string}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-lg lg:grid-cols-3">
        <div className="space-y-lg lg:col-span-1">
          <Card hoverLift={false} className="space-y-4 p-lg">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">Datos de contacto</h2>
            <div className="flex min-w-0 items-center gap-2 font-body-md text-body-md text-on-surface">
              <Icon name="call" className="text-[18px] text-on-surface-variant" />
              <span className="truncate">{client.phoneE164 as string}</span>
            </div>
            {client.email && (
              <div className="flex min-w-0 items-center gap-2 font-body-md text-body-md text-on-surface">
                <Icon name="mail" className="text-[18px] text-on-surface-variant" />
                <span className="truncate">{client.email as string}</span>
              </div>
            )}
            {age !== null && (
              <div className="flex min-w-0 items-center gap-2 font-body-md text-body-md text-on-surface">
                <Icon name="cake" className="text-[18px] text-on-surface-variant" />
                {/* Se guarda solo el año: la edad puede correr ±1 según si ya cumplió. */}
                <span className="truncate tabular-nums">{age} años</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-4">
              <div className="text-center">
                <p className="font-label-md text-label-md text-on-surface-variant">Turnos</p>
                <p className="font-headline-md text-headline-md tabular-nums text-on-surface">{turnosCount}</p>
              </div>
              <div className="text-center">
                <p className="font-label-md text-label-md text-on-surface-variant">Gastado</p>
                <p className="font-headline-md text-headline-md tabular-nums text-on-surface">
                  ${totalSpent.toLocaleString("es-AR")}
                </p>
              </div>
              <div className="text-center">
                <p className="font-label-md text-label-md text-on-surface-variant">Ausencias</p>
                <p className="font-headline-md text-headline-md tabular-nums text-status-alert">{noShowCount}</p>
              </div>
            </div>
          </Card>
          <ClientNotes tenantSlug={tenantSlug} clientId={clientId} notes={notes} />
        </div>

        <div className="space-y-lg lg:col-span-2">
          <Card hoverLift={false} className="p-0">
            <div className="border-b border-border p-lg">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">Últimos turnos</h2>
            </div>
            <div className="divide-y divide-border">
              {recentAppointments.map((app) => {
                const status = STATUS_LABEL[String(app.status)] ?? { label: String(app.status), tone: "pending" as StatusPillStatus };
                const startsAt = typeof app.startsAt === "string" ? new Date(app.startsAt) : app.startsAt.toDate?.() ?? new Date();
                return (
                  <Link
                    key={app.id}
                    href={`/app/${tenantSlug}/agenda/${app.id}`}
                    className="flex items-center gap-3 px-lg py-4 transition-colors hover:bg-surface-container-low"
                  >
                    <Avatar name={String(app.staffName ?? "")} src={(app.staffPhoto as string | null) ?? null} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-label-md text-label-md text-on-surface">
                        {new TZDate(startsAt, tenant.timezone).toLocaleString("es-AR", { dateStyle: "long", timeStyle: "short" })}
                      </p>
                      <p className="truncate font-body-sm text-body-sm text-on-surface-variant">{String(app.staffName ?? "")}</p>
                      <p className="truncate font-body-sm text-body-sm text-on-surface-variant">{(app.items ?? []).map((item) => item.name).filter(Boolean).join(", ")}</p>
                      {app.note && <p className="mt-1 line-clamp-2 break-words font-body-sm text-body-sm text-on-surface-variant">Nota: {app.note}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                      <p className="font-label-md text-label-md tabular-nums text-on-surface">
                        ${Number(app.total ?? 0).toLocaleString("es-AR")}
                      </p>
                      <StatusDot tone={status.tone}>{status.label}</StatusDot>
                    </div>
                  </Link>
                );
              })}
              {recentAppointments.length === 0 && (
                <p className="p-lg font-body-md text-body-md text-on-surface-variant">No hay turnos registrados.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

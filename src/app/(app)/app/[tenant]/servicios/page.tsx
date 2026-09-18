import Link from "next/link";
import { createClient } from "@/server/supabase/server";
import { getTenantBySlug } from "@/server/tenant";
import { computeTotalDuration, type Phase } from "@/domain/availability";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { StatusPill } from "@/components/ui/status-pill";
import { SectionHeaderNew } from "@/components/ui/section-header-new";
import { NewServiceForm } from "./new-service-form";

export default async function ServiciosPage({
  params,
}: PageProps<"/app/[tenant]/servicios">) {
  const { tenant: tenantSlug } = await params;
  const supabase = await createClient();
  const tenant = await getTenantBySlug(supabase, tenantSlug);

  const [{ data: services, error }, staffServicesRes, staffCountRes] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, price, buffer_after_min, active, service_phases(kind, minutes)")
      .eq("tenant_id", tenant.id)
      .is("archived_at", null)
      .order("sort"),
    supabase.from("staff_services").select("service_id, staff(active)"),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("active", true),
  ]);

  if (error) throw error;
  if (staffServicesRes.error) throw staffServicesRes.error;
  if (staffCountRes.error) throw staffCountRes.error;
  const totalActiveStaff = staffCountRes.count ?? 0;

  // "Servicio suspendido por falta de personal" (sección 3.3): si el
  // único profesional activo que lo atiende se da de baja o falta, nadie
  // más puede tomarlo -- se avisa acá para que el admin lo note antes de
  // que un cliente intente reservarlo sin éxito.
  const activeStaffCountByService = new Map<string, number>();
  for (const row of staffServicesRes.data) {
    if (!row.staff?.active) continue;
    activeStaffCountByService.set(row.service_id, (activeStaffCountByService.get(row.service_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-lg">
      <SectionHeaderNew
        title="Servicios"
        subtitle={`${services.length} servicio${services.length === 1 ? "" : "s"} en el catálogo`}
        newLabel="Nuevo servicio"
        newIcon="add_circle"
      >
        <NewServiceForm tenantSlug={tenantSlug} />
      </SectionHeaderNew>

      <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => {
          const phases: Phase[] = service.service_phases.map((p) => ({
            kind: p.kind as Phase["kind"],
            minutes: p.minutes,
          }));
          const duration = computeTotalDuration(phases, service.buffer_after_min);
          const activeStaffCount = activeStaffCountByService.get(service.id) ?? 0;

          return (
            <Link key={service.id} href={`/app/${tenantSlug}/servicios/${service.id}`}>
              <Card className="flex h-full flex-col gap-2 p-lg">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-low text-secondary">
                    <Icon name="content_cut" className="text-[20px]" />
                  </span>
                  {!service.active && <StatusPill status="draft">Inactivo</StatusPill>}
                </div>
                <h2 className="flex items-center gap-1.5 font-headline-sm text-headline-sm text-on-surface">
                  {service.name}
                  <Icon name="edit" className="text-[14px] text-on-surface-variant" />
                </h2>
                <p className="flex items-center gap-1 font-body-sm text-body-sm text-on-surface-variant">
                  <Icon name="schedule" className="text-[15px]" />
                  {duration} min
                  {service.buffer_after_min > 0 && ` (incluye ${service.buffer_after_min} de buffer)`}
                </p>
                <p className="font-headline-sm text-headline-sm text-on-surface">
                  ${Number(service.price).toLocaleString("es-AR")}
                </p>
                {service.active && activeStaffCount === 0 && (
                  <p className="flex items-center gap-1 font-label-sm text-label-sm text-status-alert">
                    <Icon name="error" className="text-[14px]" />
                    Nadie lo atiende — nadie puede agendarlo
                  </p>
                )}
                {service.active && activeStaffCount === 1 && totalActiveStaff > 1 && (
                  <p className="flex items-center gap-1 font-label-sm text-label-sm text-status-draft">
                    <Icon name="info" className="text-[14px]" />
                    Solo 1 profesional lo atiende — si falta, queda sin cobertura
                  </p>
                )}
              </Card>
            </Link>
          );
        })}
        {services.length === 0 && (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Todavía no hay servicios cargados.
          </p>
        )}
      </div>
    </div>
  );
}

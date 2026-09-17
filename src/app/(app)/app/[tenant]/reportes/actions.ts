"use server";

export async function exportarTurnosCsv(tenantSlug: string) {
  // Simulación de obtención de turnos y generación de CSV
  const header = "Fecha,Cliente,Servicio,Estado,Monto\n";
  const rows = [
    "2026-09-01,Juan Perez,Corte Clásico,Completado,5000",
    "2026-09-02,Maria Gomez,Perfilado,Cancelado,0",
    "2026-09-03,Carlos Lopez,Barba y Perfilado,Completado,3500",
    "2026-09-03,Ana Sanchez,Corte y Barba,Completado,7500",
  ];
  
  const csvContent = header + rows.join("\n");
  
  return {
    filename: `turnos-${tenantSlug}-${new Date().toISOString().split("T")[0]}.csv`,
    content: csvContent
  };
}

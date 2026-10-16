import { test, expect, type Page } from "@playwright/test";
import { SLUG, loginAsOwner, expectNoHorizontalScroll, futureDateISO, projectIndex } from "./fixtures";

// Cada proyecto agenda en su propio día futuro (5..8 días adelante): así
// nunca se pisa con otro proyecto ni con public-booking.spec.ts (1..4 días),
// y no depende de la hora en que se corra la suite -- reservando "hoy" a la
// tarde quedaban pocos horarios y el día se llenaba.
//
// "Nuevo turno" es un stepper: (1) cliente + servicio, (2) profesional --
// el seed tiene un solo profesional ("owner"), así que ese paso se saltea
// solo --, (3) calendario + horarios, (4) resumen con seña y "Crear turno".
async function createTurnoManual(page: Page, options: { dateISO: string; clientPhoneSuffix: string; method: "Efectivo" | "Transferencia"; slotIndex: number }) {
  await page.goto(`/app/${SLUG}/agenda/nuevo?date=${options.dateISO}`);
  await expectNoHorizontalScroll(page);
  await expect(page.getByText(/^Paso 1 de \d/)).toBeVisible();

  // Paso 1: cliente nuevo (teléfono en formato local, como lo escribe la dueña) + servicio.
  // Nombre único por corrida: los 4 proyectos (y los retries) crean clientes
  // en el mismo local, y con nombres repetidos la búsqueda devuelve varios.
  const clientName = `Cliente Manual ${options.method} ${options.clientPhoneSuffix}`;
  await page.getByRole("button", { name: "+ Cliente nuevo" }).click();
  await page.getByPlaceholder("Nombre completo").fill(clientName);
  await page.getByPlaceholder("11 2233 4455").fill(`11${options.clientPhoneSuffix}`);
  await page.getByLabel("Edad (opcional)").fill("34");
  await page.getByRole("button", { name: "Crear y usar este cliente" }).click();
  await expect(page.getByText(clientName)).toBeVisible();

  await page.getByRole("button", { name: /Manicuría semipermanente/ }).click();
  await page.getByRole("button", { name: "Siguiente" }).click();

  // Paso 3 (el 2 se saltea: un solo profesional). El día por defecto es el
  // ?date= de la URL; se toca igual su celda del calendario por data-date.
  await expect(page.getByText(/^Paso 2 de 3/)).toBeVisible();
  await page.locator(`[data-date="${options.dateISO}"]`).click();
  await expect(page.locator(`[data-date="${options.dateISO}"]`)).toHaveAttribute("aria-pressed", "true");

  const slotButtons = page.getByRole("button", { name: /^\d{2}:\d{2}$/ });
  await expect(slotButtons.nth(options.slotIndex)).toBeVisible({ timeout: 15_000 });
  await expectNoHorizontalScroll(page);
  await slotButtons.nth(options.slotIndex).click();

  // Paso 4: resumen + seña.
  await expect(page.getByText(/^Paso 3 de 3/)).toBeVisible();
  await page.getByText("Cobrar seña ahora").click();
  await page.getByRole("button", { name: options.method }).click();
  await page.getByRole("button", { name: "Crear turno" }).click();

  // La agenda muestra el aviso y limpia `creado=1` de la URL enseguida, así
  // que se verifica lo que ve la dueña, no el parámetro.
  await expect(page.getByText(/Turno agendado para/).first()).toBeVisible({ timeout: 15_000 });
  await expect(page).toHaveURL(/\/agenda/);
}

test("turno manual con seña en efectivo queda agendado y cobrado", async ({ page }, testInfo) => {
  await loginAsOwner(page);
  await createTurnoManual(page, {
    dateISO: futureDateISO(5 + projectIndex(testInfo.project.name)),
    clientPhoneSuffix: `1${Date.now().toString().slice(-7)}`,
    method: "Efectivo",
    slotIndex: 20,
  });
  await expectNoHorizontalScroll(page);
});

test("turno manual con seña por transferencia queda agendado y cobrado", async ({ page }, testInfo) => {
  await loginAsOwner(page);
  await createTurnoManual(page, {
    dateISO: futureDateISO(5 + projectIndex(testInfo.project.name)),
    clientPhoneSuffix: `2${Date.now().toString().slice(-7)}`,
    method: "Transferencia",
    slotIndex: 40,
  });
  await expectNoHorizontalScroll(page);
});

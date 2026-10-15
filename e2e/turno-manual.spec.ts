import { test, expect, type Page } from "@playwright/test";
import { SLUG, loginAsOwner, expectNoHorizontalScroll, futureDateISO, projectIndex } from "./fixtures";

// Cada proyecto agenda en su propio día futuro (5..8 días adelante): así
// nunca se pisa con otro proyecto ni con public-booking.spec.ts (1..4 días),
// y no depende de la hora en que se corra la suite -- reservando "hoy" a la
// tarde quedaban pocos horarios y el día se llenaba.
async function createTurnoManual(page: Page, options: { dateISO: string; clientPhoneSuffix: string; method: "Efectivo" | "Transferencia"; slotIndex: number }) {
  await page.goto(`/app/${SLUG}/agenda/nuevo?date=${options.dateISO}`);
  await expectNoHorizontalScroll(page);

  await page.getByRole("button", { name: "+ Cliente nuevo" }).click();
  await page.getByPlaceholder("Nombre completo").fill(`Cliente Manual ${options.method}`);
  await page.getByPlaceholder("+5491122334455").fill(`+54911${options.clientPhoneSuffix}`);
  await page.getByRole("button", { name: "Crear y usar este cliente" }).click();
  await expect(page.getByText(`Cliente Manual ${options.method}`)).toBeVisible();

  await page.getByRole("button", { name: /Manicuría semipermanente/ }).click();

  const slotButtons = page.getByRole("button", { name: /^\d{2}:\d{2}$/ });
  await expect(slotButtons.nth(options.slotIndex)).toBeVisible({ timeout: 15_000 });

  await page.getByText("Cobrar seña ahora").click();
  await page.getByRole("button", { name: options.method }).click();

  await slotButtons.nth(options.slotIndex).click();
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

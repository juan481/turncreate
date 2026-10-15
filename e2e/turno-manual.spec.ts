import { test, expect, type Page } from "@playwright/test";
import { SLUG, loginAsOwner, expectNoHorizontalScroll } from "./fixtures";

const PROJECT_ORDER = ["pixel-7", "w320", "w360", "w390"];

// El turnero sólo tiene un profesional ("owner"), así que cada turno manual
// compite por el mismo horario de ese profesional contra el resto de los
// proyectos (y contra public-booking.spec.ts, que usa índices bajos sobre
// la misma agenda de "hoy"). Arranca bien lejos de ese rango y separa
// efectivo/transferencia entre sí para no superponerse (servicio de 45min
// con slots cada 15min).
function slotIndexFor(projectName: string, which: "cash" | "transfer") {
  const projectIndex = Math.max(0, PROJECT_ORDER.indexOf(projectName));
  return 40 + projectIndex * 10 + (which === "transfer" ? 5 : 0);
}

async function createTurnoManual(page: Page, options: { clientPhoneSuffix: string; method: "Efectivo" | "Transferencia"; slotIndex: number }) {
  await page.goto(`/app/${SLUG}/agenda/nuevo`);
  await expectNoHorizontalScroll(page);

  await page.getByRole("button", { name: "+ Cliente nuevo" }).click();
  await page.getByPlaceholder("Nombre completo").fill(`Cliente Manual ${options.method}`);
  await page.getByPlaceholder("+5491122334455").fill(`+54911${options.clientPhoneSuffix}`);
  await page.getByRole("button", { name: "Crear y usar este cliente" }).click();
  await expect(page.getByText(`Cliente Manual ${options.method}`)).toBeVisible();

  await page.getByRole("button", { name: /Manicuría semipermanente/ }).click();

  const slotButtons = page.getByRole("button", { name: /^\d{2}:\d{2}$/ });
  await expect(slotButtons.first()).toBeVisible({ timeout: 10_000 });
  const count = await slotButtons.count();

  await page.getByText("Cobrar seña ahora").click();
  await page.getByRole("button", { name: options.method }).click();

  await slotButtons.nth(options.slotIndex % count).click();
  await expect(page).toHaveURL(/\/agenda\?.*creado=1/, { timeout: 10_000 });
}

test("turno manual con seña en efectivo queda agendado y cobrado", async ({ page }, testInfo) => {
  await loginAsOwner(page);
  await createTurnoManual(page, {
    clientPhoneSuffix: `1${Date.now().toString().slice(-7)}`,
    method: "Efectivo",
    slotIndex: slotIndexFor(testInfo.project.name, "cash"),
  });
  await expectNoHorizontalScroll(page);
});

test("turno manual con seña por transferencia queda agendado y cobrado", async ({ page }, testInfo) => {
  await loginAsOwner(page);
  await createTurnoManual(page, {
    clientPhoneSuffix: `2${Date.now().toString().slice(-7)}`,
    method: "Transferencia",
    slotIndex: slotIndexFor(testInfo.project.name, "transfer"),
  });
  await expectNoHorizontalScroll(page);
});

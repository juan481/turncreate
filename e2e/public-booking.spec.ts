import { test, expect } from "@playwright/test";
import { SLUG, ATTEMPT_IDS, expectNoHorizontalScroll } from "./fixtures";

// 4 proyectos (pixel-7/w320/w360/w390) corren este spec en paralelo contra
// el mismo tenant/servicio/staff del emulador: cada uno debe tomar un
// horario distinto para no pelearse por el mismo hold.
const PROJECT_ORDER = ["pixel-7", "w320", "w360", "w390"];

test("reserva pública completa: elige turno, paga la seña (MP stub) y llega al checkout", async ({ page }, testInfo) => {
  const projectIndex = Math.max(0, PROJECT_ORDER.indexOf(testInfo.project.name));

  await page.goto(`/${SLUG}`);
  await expectNoHorizontalScroll(page);

  // Paso 1: servicio.
  await page.getByText("Manicuría semipermanente", { exact: true }).click();

  // Paso 2: "cualquiera disponible".
  await page.getByText("Cualquiera disponible", { exact: true }).click();

  // Paso 3: fecha (hoy, ya seleccionada) y horario. El servicio dura 45min
  // con slots cada 15min, así que slots vecinos se superponen en la misma
  // ocupación: cada proyecto salta de 5 en 5 (75min) para no pisarse.
  const timeButtons = page.getByRole("button", { name: /^\d{2}:\d{2}$/ });
  await expect(timeButtons.first()).toBeVisible({ timeout: 15_000 });
  const count = await timeButtons.count();
  await timeButtons.nth((projectIndex * 5) % count).click();
  await page.getByRole("button", { name: "Continuar" }).click();

  // Paso 4: datos del cliente.
  await expect(page.getByText("Confirmá tu turno")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await page.getByLabel("Nombre completo").fill("Cliente E2E");
  await page.getByLabel("Teléfono (WhatsApp)").fill("+5491122334455");
  await page.getByRole("button", { name: "Pagar seña con Mercado Pago" }).click();

  // MP_E2E_STUB=1: nunca pega contra Mercado Pago real. El intento queda
  // "pending" y redirige directo al checkout de vuelta en TurnCreate.
  await expect(page).toHaveURL(/\/checkout\?attempt=/);
  await expect(page.getByText("Estamos verificando tu pago")).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test.describe("checkout: estados del pago", () => {
  test("pago aprobado muestra el turno confirmado", async ({ page }) => {
    await page.goto(`/${SLUG}/checkout?attempt=${ATTEMPT_IDS.approved}`);
    await expect(page.getByText("¡Turno confirmado!")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver mi turno" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("pago rechazado explica que no quedó reservado", async ({ page }) => {
    await page.goto(`/${SLUG}/checkout?attempt=${ATTEMPT_IDS.rejected}`);
    await expect(page.getByText("El pago no se completó")).toBeVisible();
    await expect(page.getByRole("link", { name: "Volver al turnero" })).toBeVisible();
  });

  test("aprobación tardía sobre un horario ya ocupado pide revisión, no confirma el turno", async ({ page }) => {
    await page.goto(`/${SLUG}/checkout?attempt=${ATTEMPT_IDS.refundRequired}`);
    await expect(page.getByText("Necesitamos revisar tu pago")).toBeVisible();
    await expect(page.getByText(/no confirmamos el turno/i)).toBeVisible();
  });

  test("pago pendiente se queda verificando sin confirmar nada todavía", async ({ page }) => {
    await page.goto(`/${SLUG}/checkout?attempt=${ATTEMPT_IDS.pending}`);
    await expect(page.getByText("Estamos verificando tu pago")).toBeVisible();
  });
});

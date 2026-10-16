import { test, expect, type Page } from "@playwright/test";
import { SLUG, ATTEMPT_IDS, expectNoHorizontalScroll, loginAsOwner, projectIndex } from "./fixtures";

// 4 proyectos (pixel-7/w320/w360/w390) corren este spec en paralelo contra
// el mismo tenant/servicio/staff del emulador: cada uno reserva en su
// propio día futuro, así no se pelean por el mismo horario ni dependen de
// cuántas horas le queden al día de hoy. Mercado Pago: días 1..4;
// transferencia: días 9..12 (turno-manual.spec.ts usa 5..8).

/** Pasos 1-3 del turnero: servicio, (profesional se saltea), día y horario. */
async function pickSlot(page: Page, dayOffset: number) {
  await page.goto(`/${SLUG}`);
  await expectNoHorizontalScroll(page);

  // Paso 1: servicio (el seed tiene 2 públicos, así que no se autoelige).
  await page.getByText("Manicuría semipermanente", { exact: true }).click();

  // Paso 2: el tenant E2E tiene una sola profesional para el servicio:
  // salta la elección y nunca ofrece "Cualquiera disponible".
  await expect(page.getByText("Cualquiera disponible", { exact: true })).toHaveCount(0);

  // Paso 3: fecha y horario. La tira de días arranca hoy; cada botón se
  // llama "<día abreviado><número>" (p. ej. "vie16").
  const dayButtons = page.getByRole("button", { name: /^\D{2,5}\d{1,2}$/ });
  await expect(dayButtons.first()).toBeVisible({ timeout: 15_000 });
  await dayButtons.nth(dayOffset).click();
  const timeButtons = page.getByRole("button", { name: /^\d{2}:\d{2}$/ });
  await expect(timeButtons.nth(30)).toBeVisible({ timeout: 15_000 });
  // Los horarios se tocan bien con el dedo (≥44px).
  const box = await timeButtons.nth(30).boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(43.5);
  await expectNoHorizontalScroll(page);
  await timeButtons.nth(30).click();
  await page.getByRole("button", { name: "Continuar" }).click();

  // Paso 4: datos del cliente.
  await expect(page.getByText("Confirmá tu turno")).toBeVisible();
  await expectNoHorizontalScroll(page);
}

test("reserva pública completa: elige turno, paga la seña (MP stub) y llega al checkout", async ({ page }, testInfo) => {
  await pickSlot(page, 1 + projectIndex(testInfo.project.name));

  // El teléfono se escribe como lo escribe cualquiera (sin +549).
  const phone = page.getByLabel("Teléfono (WhatsApp)");
  await expect(phone).toHaveAttribute("placeholder", "11 2233 4455");
  await expect(page.getByText("Con código de área, ej: 11 2233 4455")).toBeVisible();
  await page.getByLabel("Nombre completo").fill("Cliente E2E");
  await phone.fill("11 2233 4455");
  await page.getByRole("button", { name: "Pagar seña con Mercado Pago" }).click();

  // MP_E2E_STUB=1: nunca pega contra Mercado Pago real. El intento queda
  // "pending" y redirige directo al checkout de vuelta en TurnCreate.
  await expect(page).toHaveURL(/\/checkout\?attempt=/);
  await expect(page.getByText("Estamos verificando tu pago")).toBeVisible();
  await expectNoHorizontalScroll(page);
});

test("el turnero público lleva la firma de Just Create al pie", async ({ page }) => {
  await page.goto(`/${SLUG}`);
  await expect(page.getByRole("link", { name: /Desarrollado y diseñado por Just Create/ })).toBeVisible();
  await expectNoHorizontalScroll(page);
});

// Necesita que el seed habilite la transferencia en el tenant E2E (ver
// e2e/README.md / reporte): settings.payments.transfer = { enabled: true,
// alias, cbu, holderName, bankName } + whatsappNumber. Con el seed actual
// (solo Mercado Pago) el paso 4 no ofrece transferencia y el test se saltea.
test("reserva con seña por transferencia: datos para transferir, Mi turno y la dueña la confirma", async ({ page, context }, testInfo) => {
  const index = projectIndex(testInfo.project.name);
  const clientName = `Cliente Transferencia ${testInfo.project.name}`;
  await pickSlot(page, 9 + index);

  const transferOption = page.getByRole("radio", { name: /Transferencia bancaria/ });
  test.skip((await transferOption.count()) === 0, "El seed E2E no tiene la transferencia habilitada");

  await transferOption.check();
  await page.getByLabel("Nombre completo").fill(clientName);
  // Un WhatsApp distinto por proyecto: hay un tope de transferencias pendientes por teléfono.
  await page.getByLabel("Teléfono (WhatsApp)").fill(`11 3000 000${index}`);
  await page.getByRole("button", { name: "Reservar y ver datos para transferir" }).click();

  await expect(page.getByRole("heading", { name: "Turno reservado — pendiente de confirmación" })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Monto exacto de la seña")).toBeVisible();
  await expect(page.getByText("Alias", { exact: true })).toBeVisible();
  await expectNoHorizontalScroll(page);

  try {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  } catch {
    // Algunos navegadores no exponen permisos de portapapeles; el botón cae al fallback.
  }
  await page.getByRole("button", { name: "Copiar alias" }).click();
  await expect(page.getByRole("button", { name: "Copiar alias" })).toContainText(/Copiado|Copialo a mano/);

  const whatsapp = page.getByRole("link", { name: "Mandar comprobante por WhatsApp" });
  if (await whatsapp.count()) await expect(whatsapp).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+\?text=/);

  // Mi turno muestra lo mismo mientras espera la transferencia.
  await page.getByRole("link", { name: "Ver mi turno" }).click();
  await expect(page).toHaveURL(/\/mi-turno\//);
  await expect(page.getByText("Esperando transferencia")).toBeVisible();
  await expect(page.getByText("Monto exacto de la seña")).toBeVisible();
  await expectNoHorizontalScroll(page);

  // La dueña la ve en /transferencias y la confirma.
  await loginAsOwner(page);
  await page.goto(`/app/${SLUG}/transferencias`);
  const card = page.getByRole("listitem").filter({ hasText: clientName });
  await expect(card).toBeVisible();
  await expectNoHorizontalScroll(page);
  await card.getByRole("button", { name: /Confirmar seña/ }).click();
  await expect(page.getByText("Seña confirmada: el turno quedó confirmado")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: clientName })).toHaveCount(0);
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

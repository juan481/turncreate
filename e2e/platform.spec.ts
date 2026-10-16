import { test, expect, type Page } from "@playwright/test";
import { OWNER_EMAIL, SLUG, expectNoHorizontalScroll, loginAsOwner } from "./fixtures";

// Consola de plataforma (/platform). Dos bloques:
//  1. Sin permiso (siempre corre): cookie inventada y dueña de un local con
//     sesión real -> 404 en todas las rutas y el payload RSC sin datos de
//     ningún local. Regresión del chequeo que vivía solo en el layout.
//  2. Admin (solo si PLATFORM_ADMIN_EMAIL está en el entorno E2E): listado,
//     detalle y el ciclo apagar/prender sobre un tenant PROPIO de este spec
//     (e2e_platform_tenant), nunca sobre e2e-nails: apagarlo rompería los
//     specs de reserva que corren en paralelo.

const TENANT_ID = "e2e_nails_tenant";
const TENANT_NAME = "E2E Nails";
const FAKE_SESSION = "turncreate_session=cookie-inventada";
const PLATFORM_PATHS = ["/platform", `/platform/${TENANT_ID}`, "/platform/auditoria"];

function expectNoTenantData(body: string) {
  expect(body).not.toContain(TENANT_NAME);
  // El id viaja en la URL pedida (y vuelve en el 404 de dev): se chequea el
  // slug, que solo aparecería si se filtraran datos del local.
  expect(body).not.toContain(SLUG);
  expect(body).not.toContain(OWNER_EMAIL);
}

test.describe("consola de plataforma sin permiso", () => {
  for (const path of PLATFORM_PATHS) {
    test(`con una cookie inventada, ${path} no filtra locales en el RSC`, async ({ request }) => {
      const variants: Record<string, string>[] = [{ Cookie: FAKE_SESSION }, { Cookie: FAKE_SESSION, RSC: "1" }];
      for (const headers of variants) {
        const response = await request.get(path, { headers, maxRedirects: 0 });
        expectNoTenantData(await response.text());
      }
    });
  }

  test("la dueña de un local (sesión real, no admin) recibe 404 en /platform y no ve datos", async ({ page }) => {
    await loginAsOwner(page);
    for (const path of PLATFORM_PATHS) {
      const response = await page.request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(404);
      expectNoTenantData(await response.text());

      const rsc = await page.request.get(path, { headers: { RSC: "1" }, maxRedirects: 0 });
      expectNoTenantData(await rsc.text());
    }
  });
});

// ---------------------------------------------------------------------
// Admin de plataforma. Para habilitarlo: PLATFORM_ADMIN_EMAIL en E2E_ENV
// (y en process.env del runner) + el usuario admin y e2e_platform_tenant
// en scripts/seed-e2e.cjs. Sin eso, este bloque se saltea.
// ---------------------------------------------------------------------

const ADMIN_EMAIL = process.env.PLATFORM_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD ?? "Plataforma2026!";
const OWN_TENANT_ID = "e2e_platform_tenant";
const OWN_TENANT_NAME = "E2E Plataforma";

async function loginAsPlatformAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL ?? "");
  await page.getByLabel("Contraseña").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  // Sin local propio, el login la manda al onboarding: alcanza con salir de /login.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

async function confirmInSheet(page: Page, confirmLabel: string, reason?: string) {
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  const confirm = sheet.getByRole("button", { name: confirmLabel });
  if (reason !== undefined) {
    await expect(confirm).toBeDisabled();
    await sheet.getByRole("textbox").fill(reason);
  }
  await expect(confirm).toBeEnabled();
  await confirm.click();
  await expect(sheet).toBeHidden();
}

test.describe("consola de plataforma como admin", () => {
  test.skip(!ADMIN_EMAIL, "PLATFORM_ADMIN_EMAIL no está definido para el entorno E2E (ver playwright.config.ts)");

  test("listado: KPIs, búsqueda y filtro, sin scroll lateral", async ({ page }) => {
    await loginAsPlatformAdmin(page);
    await page.goto("/platform");
    await expect(page.getByRole("heading", { name: "Locales de la plataforma" })).toBeVisible();
    await expect(page.getByText(TENANT_NAME).first()).toBeVisible();
    await expectNoHorizontalScroll(page);

    const search = page.getByRole("searchbox", { name: /Buscar local/ });
    await search.fill(SLUG);
    await expect(page.getByText(TENANT_NAME).first()).toBeVisible();
    await search.fill("zzz-no-existe-ningun-local");
    await expect(page.getByText("No hay locales con ese filtro")).toBeVisible();
    await search.fill("");

    await page.getByRole("button", { name: /^Apagados/ }).click();
    await expect(page.getByRole("button", { name: /^Apagados/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /^Todos/ }).click();

    await page.locator(`a[href="/platform/${TENANT_ID}"]`).first().click();
    await expect(page).toHaveURL(new RegExp(`/platform/${TENANT_ID}$`));
    await expect(page.getByRole("heading", { name: TENANT_NAME })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Uso" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Configuración" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("apagar y prender el local y su turnero queda auditado", async ({ page }, testInfo) => {
    // Un solo proyecto muta el tenant: los 4 en paralelo se pisarían el estado.
    test.skip(testInfo.project.name !== "pixel-7", "El ciclo apagar/prender corre solo en pixel-7");
    await loginAsPlatformAdmin(page);

    const response = await page.goto(`/platform/${OWN_TENANT_ID}`);
    test.skip(response?.status() === 404, `Falta ${OWN_TENANT_ID} en scripts/seed-e2e.cjs`);
    await expect(page.getByRole("heading", { name: OWN_TENANT_NAME })).toBeVisible();

    // Si un intento anterior quedó a mitad de camino, arrancar desde prendido.
    if (await page.getByRole("button", { name: "Prender local" }).isVisible()) {
      await page.getByRole("button", { name: "Prender local" }).click();
      await confirmInSheet(page, "Prender local");
    }
    if (await page.getByRole("button", { name: "Prender turnero" }).isVisible()) {
      await page.getByRole("button", { name: "Prender turnero" }).click();
      await confirmInSheet(page, "Prender turnero");
    }

    const suspendReason = `E2E: prueba de apagado ${Date.now()}`;
    await page.getByRole("button", { name: "Apagar local" }).click();
    await confirmInSheet(page, "Apagar local", suspendReason);
    await expect(page.getByText(`${OWN_TENANT_NAME} quedó apagado`)).toBeVisible();
    await expect(page.getByText(`Motivo: ${suspendReason}`)).toBeVisible();
    await expect(page.getByText(`“${suspendReason}”`)).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByRole("button", { name: "Prender local" }).click();
    await confirmInSheet(page, "Prender local");
    await expect(page.getByText(`${OWN_TENANT_NAME} quedó activo`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Apagar local" })).toBeVisible();

    const bookingReason = `E2E: pausa del turnero ${Date.now()}`;
    await page.getByRole("button", { name: "Apagar turnero" }).click();
    await confirmInSheet(page, "Apagar turnero", bookingReason);
    await expect(page.getByText(`Turnero de ${OWN_TENANT_NAME} apagado`)).toBeVisible();
    await page.getByRole("button", { name: "Prender turnero" }).click();
    await confirmInSheet(page, "Prender turnero");
    await expect(page.getByText(`Turnero de ${OWN_TENANT_NAME} prendido`)).toBeVisible();

    await page.goto("/platform/auditoria");
    await expect(page.getByText(`“${suspendReason}”`)).toBeVisible();
    await expect(page.getByText(`“${bookingReason}”`)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});

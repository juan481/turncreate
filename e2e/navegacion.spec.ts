import { test, expect, type Page } from "@playwright/test";
import { SLUG, loginAsOwner, expectNoHorizontalScroll } from "./fixtures";

async function expectPageLoadedOk(page: Page) {
  await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
  await expectNoHorizontalScroll(page);
}

test("navegación mobile: clientes, agenda, calendario, caja y reportes cargan sin errores ni scroll lateral", async ({ page }) => {
  await loginAsOwner(page);

  await page.goto(`/app/${SLUG}/clientes`);
  await expect(page).toHaveURL(/\/clientes$/);
  await expectPageLoadedOk(page);

  await page.goto(`/app/${SLUG}/agenda`);
  await expect(page).toHaveURL(/\/agenda(\?|$)/);
  await expectPageLoadedOk(page);

  await page.goto(`/app/${SLUG}/agenda/mes`);
  await expect(page).toHaveURL(/\/agenda\/mes/);
  await expectPageLoadedOk(page);

  await page.goto(`/app/${SLUG}/caja`);
  await expect(page).toHaveURL(/\/caja$/);
  await expectPageLoadedOk(page);

  await page.goto(`/app/${SLUG}/reportes`);
  await expect(page).toHaveURL(/\/reportes$/);
  await expectPageLoadedOk(page);
});

test("back físico: volver desde servicios cae en la pantalla anterior sin romper nada", async ({ page }) => {
  await loginAsOwner(page);

  await page.goto(`/app/${SLUG}/clientes`);
  await page.goto(`/app/${SLUG}/servicios`);
  await expect(page).toHaveURL(/\/servicios$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/clientes$/);
  await expectPageLoadedOk(page);

  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/app/${SLUG}$`));
  await expectPageLoadedOk(page);
});

import { test, expect } from "@playwright/test";
import { SLUG, loginAsOwner, expectNoHorizontalScroll } from "./fixtures";

test("alta y edición de servicio: crear, ver en el catálogo, editar precio y pausar", async ({ page }, testInfo) => {
  const name = `Servicio E2E ${testInfo.project.name} ${Date.now()}`;

  await loginAsOwner(page);
  await page.goto(`/app/${SLUG}/servicios`);
  await expectNoHorizontalScroll(page);

  // Alta.
  await page.getByRole("button", { name: "Nuevo servicio" }).click();
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel("Precio").fill("15000");
  await page.getByRole("button", { name: "Agregar servicio" }).click();

  const card = page.getByRole("link", { name: new RegExp(name) });
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card.getByText("$15.000", { exact: false })).toBeVisible();
  await expect(card.getByText("En el turnero")).toBeVisible();

  // Edición: precio nuevo y lo pauso.
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/servicios/[^/]+$`));
  await expectNoHorizontalScroll(page);
  await page.getByLabel("Precio").fill("18500");
  await page.getByRole("button", { name: "Activar o desactivar servicio" }).click();
  await expect(page.getByText("Servicio inactivo")).toBeVisible();
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();

  // Vuelvo al listado: precio actualizado y marcado como pausado.
  await page.goto(`/app/${SLUG}/servicios`);
  const updatedCard = page.getByRole("link", { name: new RegExp(name) });
  await expect(updatedCard.getByText("$18.500", { exact: false })).toBeVisible();
  await expect(updatedCard.getByText("Pausado")).toBeVisible();
});

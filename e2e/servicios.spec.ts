import { test, expect, type Page } from "@playwright/test";
import { SLUG, loginAsOwner, expectNoHorizontalScroll } from "./fixtures";

async function createService(page: Page, options: { name: string; price: string; duration?: string; category?: string }) {
  await page.goto(`/app/${SLUG}/servicios/nuevo`);
  await page.getByLabel("Nombre", { exact: true }).fill(options.name);
  await page.getByLabel("Precio").fill(options.price);
  if (options.duration) await page.getByLabel("Duración (min)").fill(options.duration);
  if (options.category) await page.getByRole("radio", { name: options.category }).click();
  await page.getByRole("button", { name: "Crear servicio" }).click();
  await expect(page.getByText("¡Servicio creado!")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/app/${SLUG}/servicios$`));
}

test("alta y edición de servicio: crear, ver en el catálogo, editar precio y pausar", async ({ page }, testInfo) => {
  const name = `Servicio E2E ${testInfo.project.name} ${Date.now()}`;

  await loginAsOwner(page);
  await page.goto(`/app/${SLUG}/servicios`);
  await expectNoHorizontalScroll(page);

  // Alta en su propia pantalla: sin categoría (es opcional) y sin fases.
  await page.getByRole("link", { name: "Nuevo servicio" }).click();
  await expect(page).toHaveURL(/\/servicios\/nuevo$/);
  await expectNoHorizontalScroll(page);
  await expect(page.getByText("Limpieza después del turno")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Sin categoría" })).toHaveAttribute("aria-checked", "true");
  await page.getByLabel("Nombre", { exact: true }).fill(name);
  await page.getByLabel("Precio").fill("15000");
  await page.getByRole("button", { name: "45 min" }).click();
  await page.getByRole("button", { name: "Crear servicio" }).click();

  await expect(page.getByText("¡Servicio creado!")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/app/${SLUG}/servicios$`));
  const row = page.getByRole("link", { name: new RegExp(name) });
  await expect(row).toBeVisible();
  await expect(row.getByText("$15.000")).toBeVisible();
  await expect(row.getByText("45 min")).toBeVisible();

  // Edición: precio nuevo y lo pauso.
  await row.click();
  await expect(page).toHaveURL(/\/servicios\/[^/]+$/);
  await expectNoHorizontalScroll(page);
  await page.getByLabel("Precio").fill("18500");
  await page.getByRole("button", { name: "Activar o desactivar servicio" }).click();
  await expect(page.getByText("Servicio pausado", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Guardar cambios" }).click();

  await expect(page.getByText("¡Cambios guardados!")).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/app/${SLUG}/servicios$`));
  const updatedRow = page.getByRole("link", { name: new RegExp(name) });
  await expect(updatedRow.getByText("$18.500")).toBeVisible();
  await expect(updatedRow.getByText("Pausado")).toBeVisible();
});

test("categoría creada en el momento, destacar y ordenar servicios", async ({ page }, testInfo) => {
  const stamp = `${testInfo.project.name}-${Date.now()}`;
  const category = `Cat ${stamp}`;
  const first = `Primero ${stamp}`;
  const second = `Segundo ${stamp}`;

  await loginAsOwner(page);

  // La categoría se crea desde el mismo formulario, sin salir a otra pantalla.
  await page.goto(`/app/${SLUG}/servicios/nuevo`);
  await page.getByRole("button", { name: "Nueva categoría" }).click();
  await page.getByLabel("Nombre de la nueva categoría").fill(category);
  await page.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(page.getByRole("radio", { name: category })).toHaveAttribute("aria-checked", "true");
  await page.getByLabel("Nombre", { exact: true }).fill(first);
  await page.getByLabel("Precio").fill("9000");
  await page.getByRole("button", { name: "Crear servicio" }).click();
  await expect(page.getByText("¡Servicio creado!")).toBeVisible();

  await createService(page, { name: second, price: "11000", category });

  const group = page.getByRole("region", { name: category });
  const names = group.getByRole("listitem").locator("p.font-label-lg");
  await expect(names).toHaveText([first, second]);

  // Destacar el segundo.
  await group.getByRole("button", { name: `Destacar ${second}` }).click();
  await expect(page.getByText(`"${second}" destacado`)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: category }).getByRole("button", { name: `Quitar destacado de ${second}` })).toHaveAttribute("aria-pressed", "true");

  // Ordenar con el teclado (mismo sensor que el arrastre): el segundo pasa arriba.
  const handle = page.getByRole("region", { name: category }).getByRole("button", { name: `Mover ${second}` });
  // Se espera cada anuncio del live region de dnd-kit antes de la próxima
  // tecla: al "agarrar", la librería mide las posiciones en el siguiente
  // frame, y una flecha apretada antes de eso no tiene adónde moverse.
  await handle.focus();
  await page.keyboard.press("Space");
  await expect(page.getByText(/Picked up draggable item svc:|was moved over droppable area svc:/)).toHaveCount(1);
  await page.keyboard.press("ArrowUp");
  // Sobre OTRO servicio (al agarrarlo, dnd-kit anuncia que está sobre sí mismo).
  await expect(page.getByText(/item (svc:\S+) was moved over droppable area (?!\1\.)svc:/)).toHaveCount(1);
  await page.keyboard.press("Space");
  await expect(page.getByText("Orden guardado")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: category }).getByRole("listitem").locator("p.font-label-lg")).toHaveText([second, first]);
});

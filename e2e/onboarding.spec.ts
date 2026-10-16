import { test, expect } from "@playwright/test";
import { expectNoHorizontalScroll } from "./fixtures";

test("alta de un local nuevo: registro, onboarding mobile, pantalla de creación y checklist en el inicio", async ({ page }, testInfo) => {
  const stamp = `${testInfo.project.name}${Date.now()}`;
  const email = `onboarding+${stamp}@turncreate.test`;

  await page.goto("/registro");
  await page.getByLabel("Nombre completo").fill("Dueña E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill("Testing2026!");
  await page.getByRole("button", { name: "Empezar gratis" }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  // Paso 1: el slug se arma solo, sin acentos ni eñes.
  await expect(page.getByText("Paso 1 de 4")).toBeVisible();
  await page.getByLabel("Nombre del local").fill(`Uñas Lumière ${stamp}`);
  await expect(page.getByLabel("URL del turnero")).toHaveValue(new RegExp(`^unas-lumiere-${stamp.toLowerCase()}$`));
  await expectNoHorizontalScroll(page);

  // Una URL ya tomada se avisa acá, no recién al final del alta.
  await page.getByLabel("URL del turnero").fill("e2e-nails");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("Esa URL de turnero ya está en uso, probá con otra")).toBeVisible();
  await expect(page.getByText("Paso 1 de 4")).toBeVisible();
  await page.getByLabel("URL del turnero").fill(`unas-lumiere-${stamp.toLowerCase()}`);
  await page.getByRole("button", { name: "Continuar" }).click();

  // Paso 2: rubro con tarjetas, no un <select>.
  await expect(page.getByText("Paso 2 de 4")).toBeVisible();
  const unas = page.getByRole("radio", { name: /Uñas y pestañas/ });
  await unas.click();
  await expect(unas).toHaveAttribute("aria-checked", "true");
  await expectNoHorizontalScroll(page);

  // Atrás y adelante no pierde lo cargado.
  await page.getByRole("button", { name: "Atrás" }).click();
  await expect(page.getByLabel("Nombre del local")).toHaveValue(`Uñas Lumière ${stamp}`);
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("radio", { name: /Uñas y pestañas/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Continuar" }).click();

  // Paso 3: datos de la dueña y modalidad del local. Sin sexo elegido no se
  // puede seguir, y el copy se adapta a lo que elige.
  await expect(page.getByText("Paso 3 de 4")).toBeVisible();
  await expect(page.getByLabel("Tu nombre")).toHaveValue("Dueña E2E");
  await expect(page.getByRole("button", { name: "Continuar" })).toBeDisabled();
  await expect(page.getByRole("radio", { name: "Trabajo sin equipo" })).toBeVisible();
  await page.getByRole("radio", { name: "Mujer" }).click();
  await expect(page.getByText("¡Bienvenida, Dueña!")).toBeVisible();
  await page.getByRole("radio", { name: /Trabajo sola/ }).click();
  await expect(page.getByRole("radio", { name: /Trabajo sola/ })).toHaveAttribute("aria-checked", "true");
  await expectNoHorizontalScroll(page);
  await page.getByRole("button", { name: "Continuar" }).click();

  // Paso 4 y creación con la pantalla de TurnCreate.
  await expect(page.getByText("Paso 4 de 4")).toBeVisible();
  await page.getByRole("button", { name: "Crear mi turnero" }).click();
  const creating = page.getByRole("status");
  await expect(creating).toBeVisible();
  await expect(creating.getByRole("img", { name: "TurnCreate" })).toBeVisible();
  await expect(creating).toContainText(/Bienvenida, Dueña|Tu turnero está listo/);

  // Inicio: checklist simple de 3 pasos.
  await expect(page).toHaveURL(new RegExp(`/app/unas-lumiere-${stamp.toLowerCase()}$`), { timeout: 15_000 });
  await expect(page.getByText("Terminá de preparar tu turnero")).toBeVisible();
  await expect(page.getByText("0/3")).toBeVisible();
  await expect(page.getByText("Cargá tu logo")).toBeVisible();
  await expect(page.getByText("Cargá tus servicios y precios")).toBeVisible();
  await expect(page.getByText("Conectá tu cuenta de Mercado Pago")).toBeVisible();
  // Sin turnos hoy: no aparece ninguna sección de pendientes ni texto de "no hay turnos".
  await expect(page.getByText("Pendientes de hoy")).toHaveCount(0);
  await expect(page.getByText(/no hay turnos/i)).toHaveCount(0);
  await expectNoHorizontalScroll(page);

  // El "?" del header lleva a Ayuda con preguntas frecuentes y, al final, WhatsApp.
  await page.getByRole("link", { name: "Ayuda", exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/ayuda$/);
  await page.getByText("¿Cómo comparto mi turnero con mis clientas?").click();
  await expect(page.getByText(/Link público/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Hablar con soporte" })).toHaveAttribute("href", /wa\.me/);
  await expectNoHorizontalScroll(page);
});

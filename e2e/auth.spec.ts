import { test, expect } from "@playwright/test";
import { SLUG, NEW_TEMP_PASSWORD, NEW_VALID_PASSWORD, primerIngresoEmail, expectNoHorizontalScroll } from "./fixtures";

test("primer ingreso: fuerza el cambio de contraseña antes de entrar al local", async ({ page }, testInfo) => {
  const email = primerIngresoEmail(testInfo.project.name);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(NEW_TEMP_PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();

  await expect(page).toHaveURL(/\/cambiar-clave/);
  await expectNoHorizontalScroll(page);

  // Contraseña débil (10+ caracteres para esquivar el minlength nativo del
  // input, pero sin mayúscula/dígito): el servidor debe rechazarla igual.
  await page.getByLabel("Nueva contraseña").fill("todaminuscula");
  await page.getByLabel("Repetir contraseña").fill("todaminuscula");
  await page.getByRole("button", { name: "Guardar y continuar" }).click();
  await expect(page.getByText(/al menos 10 caracteres/i)).toBeVisible();
  await expect(page).toHaveURL(/\/cambiar-clave/);

  // Contraseñas que no coinciden: tampoco avanza.
  await page.getByLabel("Nueva contraseña").fill(NEW_VALID_PASSWORD);
  await page.getByLabel("Repetir contraseña").fill(NEW_VALID_PASSWORD + "x");
  await page.getByRole("button", { name: "Guardar y continuar" }).click();
  await expect(page.getByText(/no coinciden/i)).toBeVisible();

  // Contraseña válida y confirmada: entra al local.
  await page.getByLabel("Nueva contraseña").fill(NEW_VALID_PASSWORD);
  await page.getByLabel("Repetir contraseña").fill(NEW_VALID_PASSWORD);
  await page.getByRole("button", { name: "Guardar y continuar" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/${SLUG}`));
  await expectNoHorizontalScroll(page);

  // La clave temporal ya no sirve; la nueva sí (confirma que el cambio persistió).
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(NEW_TEMP_PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByText(/incorrect/i)).toBeVisible();

  // El server action re-renderiza el form: se vuelven a completar los dos
  // campos en vez de asumir que el email quedó cargado de antes.
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(NEW_VALID_PASSWORD);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/${SLUG}`));
});

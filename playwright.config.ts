import { defineConfig, devices } from "@playwright/test";

// Corre siempre contra el Firebase Emulator Suite (ver e2e/global-setup.ts),
// nunca contra el proyecto de producción -- las claves de abajo son fijas
// y sin valor fuera del emulador.
const E2E_ENV = {
  FIREBASE_PROJECT_ID: "turncreate-e2e",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_WEB_API_KEY: "e2e-fake-api-key",
  MP_TOKEN_ENCRYPTION_KEY: "e2e-encryption-key-not-for-production",
  MP_E2E_STUB: "1",
  // Los 4 proyectos reservan en paralelo desde la misma IP.
  PUBLIC_BOOKING_RATE_LIMIT: "off",
  PLATFORM_ADMIN_EMAIL: "e2e-platform-admin@turncreate.test",
  PLATFORM_ADMIN_UID: "e2e_platform_admin_uid",
  NEXT_PUBLIC_APP_URL: "http://localhost:3100",
  ANALYTICS_HASH_SECRET: "e2e-analytics-secret",
  ANALYTICS_INTERNAL_SECRET: "e2e-analytics-internal-secret",
};
// Puerto dedicado, distinto del 3000 de `npm run dev`: así nunca hay riesgo
// de que Playwright reutilice (o se choque con) un dev server real que ya
// esté corriendo contra Firebase de producción.
const PORT = 3100;
// Los specs (workers) también leen el email admin para loguearse.
process.env.PLATFORM_ADMIN_EMAIL ??= E2E_ENV.PLATFORM_ADMIN_EMAIL;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Un reintento también fuera de CI: 4 proyectos comparten un único
  // emulador + dev server, y bajo carga de máquina alguna request puntual
  // puede demorar más que el timeout sin que sea un bug real.
  retries: process.env.CI ? 2 : 1,
  timeout: 60_000,
  // `next dev` compila cada pantalla la primera vez que se pide: con varios
  // proyectos en paralelo esa primera navegación puede pasar los 5s de
  // espera por defecto sin que haya nada roto.
  expect: { timeout: 10_000 },
  workers: process.env.CI ? 2 : 4,
  reporter: "html",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  // Pixel 7 (el dispositivo de referencia del plan) + los tres anchos
  // mínimos que pide el checklist mobile (320/360/390px).
  projects: [
    { name: "pixel-7", use: { ...devices["Pixel 7"] } },
    { name: "w320", use: { viewport: { width: 320, height: 720 }, userAgent: devices["Pixel 7"].userAgent, isMobile: true, hasTouch: true } },
    { name: "w360", use: { viewport: { width: 360, height: 740 }, userAgent: devices["Pixel 7"].userAgent, isMobile: true, hasTouch: true } },
    { name: "w390", use: { viewport: { width: 390, height: 844 }, userAgent: devices["Pixel 7"].userAgent, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: E2E_ENV,
  },
});

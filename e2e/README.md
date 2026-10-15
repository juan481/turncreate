# E2E (Playwright)

Corre siempre contra el **Firebase Emulator Suite** (Firestore + Auth), nunca
contra producción. `playwright.config.ts` levanta los emuladores y corre
`scripts/seed-e2e.cjs` en `globalSetup` antes de arrancar `next dev` con las
variables de entorno del emulador (ver `E2E_ENV` en ese archivo), y los apaga
en `globalTeardown`. Mercado Pago se stubea con `MP_E2E_STUB=1`: el checkout
nunca pega contra la API real.

Requisitos previos (una sola vez):

- `npx playwright install` para bajar los browsers.
- Un JRE en el PATH (lo necesita el emulador de Firestore). En Windows:
  `winget install EclipseAdoptium.Temurin.21.JRE`. Abrí una terminal nueva
  después de instalarlo para que tome el PATH actualizado.

Correr todo: `npx playwright test`.

Cubierto hoy: primer ingreso + cambio de contraseña obligatorio
(`auth.spec.ts`), reserva pública completa hasta el checkout y los 4
desenlaces del pago -- aprobado/rechazado/pendiente/aprobación tardía sobre
un horario ya ocupado (`public-booking.spec.ts`). Cada spec corre en 4
proyectos (Pixel 7 + anchos 320/360/390px) y valida que no haya scroll
lateral en las pantallas clave.

Todavía falta (plan maestro, sección 8.1): alta/edición de servicio, turno
manual con efectivo y transferencia, navegación de clientes/agenda/
calendario/caja/reportes, y back físico del teléfono.

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

Cubierto: primer ingreso + cambio de contraseña obligatorio (`auth.spec.ts`);
reserva pública completa hasta el checkout y los 4 desenlaces del pago --
aprobado/rechazado/pendiente/aprobación tardía sobre un horario ya ocupado
(`public-booking.spec.ts`); alta y edición de servicio, con pausa
(`servicios.spec.ts`); turno manual con seña en efectivo y por transferencia
(`turno-manual.spec.ts`); navegación de clientes/agenda/calendario/caja/
reportes y back físico (`navegacion.spec.ts`). Cada spec corre en 4 proyectos
(Pixel 7 + anchos 320/360/390px) y valida que no haya scroll lateral en las
pantallas clave. 44/44 corridas verificadas en verde.

Un único profesional ("owner" en el tenant de prueba) compite por los mismos
horarios entre specs y proyectos corriendo en paralelo contra el mismo
backend: cada spec que reserva un turno usa un offset de índice de horario
distinto (ver los comentarios en `public-booking.spec.ts` y
`turno-manual.spec.ts`) para no pisarse.

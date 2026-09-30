# Estado de migración a Firebase

## Migración completa (100% Firestore, cero Supabase en `src`)

- Autenticación, sesiones y onboarding.
- Tenant, membresías, panel privado y cierre de sesión.
- Landing y redirección `/` a `/landing`.
- Servicios, clientes, staff, configuración, caja, dashboard y reportes.
- Turnero público, hold transaccional de diez minutos, reserva y "Mi turno".
- Recordatorios, outbox y plataforma (`PLATFORM_ADMIN_EMAIL` en vez de tabla de admins).
- Agenda completa: diaria, semana, mes, detalle, alta manual y reprogramación (drag & drop y botón).

### Motor de disponibilidad/reserva compartido (`src/server/firebase/booking.ts`)

Agenda interna y turnero público usan el mismo modelo Firestore:

- Grilla de 15 minutos: cada turno/hold ocupa un documento en `tenants/{id}/occupancy`
  por cada intervalo de 15' que dura. Turnos confirmados quedan permanentes (sin
  `expiresAt`); los holds del turnero expiran a los 10'.
- Ventana libre por profesional = horario del local ∩ horario propio (si lo
  configuró; si no, no se restringe) − bloqueos de horario (`timeBlocks`).
- Reprogramar (botón o drag & drop) = turno nuevo + cancelar el original
  (con `rescheduledFromId`), nunca un update in-place.
- Cancelar o marcar "no vino" libera los documentos de ocupación del turno.
- Se corrigió un bug de doble reserva ya existente en el turnero público:
  al confirmar un hold, los documentos de ocupación no se volvían permanentes,
  por lo que el horario quedaba libre para otro cliente apenas vencía el hold.

## Eliminado

- `src/server/tenant.ts`, `src/server/notifications.ts` (código muerto, sin
  imports), `src/server/supabase/*`, `src/lib/database.types.ts`.
- Dependencias `@supabase/ssr`, `@supabase/supabase-js`, `supabase` (CLI) de
  `package.json`, y el script `db:types`.

## Criterio de despliegue

`rg -l "supabase|Supabase" src` no lista nada. `npm run typecheck`, `npm test`
y `npm run build` pasan en verde. Queda habilitado el despliegue a
`turn.justcreate.com.ar`.

## Infraestructura prevista

- Dominio: `turn.justcreate.com.ar`
- PM2: `turncreate`
- Puerto local: `3011`
- Firebase: `turncreate-prod`, Firestore en Northern Virginia (`us-east4`).

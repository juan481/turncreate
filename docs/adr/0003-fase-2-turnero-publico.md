# 0003. Fase 2: turnero público, onboarding real y mensajería

Fecha: 2026-09-16 / 2026-09-18

## Contexto

Este trabajo llegó parcialmente construido por fuera de esta sesión de
Claude Code (otro proceso trabajando sobre el mismo repo en paralelo).
Antes de seguir, hubo que auditar y corregir lo que ya estaba en el
working tree — varios archivos referenciaban un esquema que no es el
real (el de las Fases 0-1, ya probado y commiteado).

## Bugs corregidos antes de construir nada nuevo

Estos rompían el sistema o abrían huecos de seguridad reales, no son
detalles de estilo:

- **`get_public_catalog`/`get_public_staff`** referenciaban `categories`
  (la tabla real es `service_categories`), `services.is_active` y
  `services.duration` (son `active`, y la duración se suma desde
  `service_phases` — no existe como columna), y un join
  `staff.user_id -> profiles` que no existe (`staff` no tiene
  `user_id`). Ninguna de las tres funciones podía ejecutar.
- **`confirm_public_hold`** usaba `clients.first_name/last_name/phone`
  (el esquema real es `full_name`/`phone_e164`) y buscaba clientes
  existentes por `email` en vez de `phone_e164` (la clave natural real,
  sección 3.5). También rompía en runtime.
- **El trigger de `outbox_events`** leía `NEW.customer_id`/`NEW.start_time`
  (son `client_id`/`starts_at`) y encolaba un status `'reprogramado'` que
  no existe en el CHECK de `appointments.status`. Se dispara en cada
  insert/update de turno — hubiera roto **todo** el flujo de turnos, no
  solo el nuevo código.
- **`outbox_events`/`message_logs` sin RLS habilitado.** Sin el
  `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`, cualquier usuario
  autenticado podía leer mensajería (teléfonos, contenido) de
  cualquier tenant — el mismo aislamiento que probamos con pgTAP en
  Fase 0 hubiera quedado roto para estas dos tablas.
- **El wizard de onboarding insertaba directo a `tenants` con
  `role: "owner"`.** `tenants` no tiene policy de insert a propósito
  (ADR 0001: el alta es por RPC) y `'owner'` no es un rol válido
  (`admin`/`receptionist`/`professional`). El alta de un local nuevo
  hubiera fallado silenciosamente a mitad de camino: el tenant se
  creaba pero el dueño quedaba sin `tenant_members`, así que no podía
  ver ni administrar su propio local después.
- **El link "Reprogramar" de Mi turno** apuntaba a `/${slug}/nuevo`, una
  ruta que no existe (esa página vive en el panel del staff, no en el
  turnero público).

Todo esto se corrigió antes de dar por buena ninguna parte nueva, y se
re-verificó con pgTAP + un smoke test manual contra la API real (signup,
onboarding, turnero completo, reprogramar, cancelar, notas de cliente,
outbox) antes de commitear.

## Qué quedó construido y funcionando de punta a punta

- **Turnero público `/{slug}`, 4 pasos** (servicio → profesional →
  fecha/hora → datos), con "Cualquiera disponible" conectado al combo
  del dominio (`unionAnyStaffSlots` + `pickLeastBusyStaff`, que ya
  existía en `src/domain/availability` desde la Fase 1).
- **Holds** como tabla separada (no un status de `appointments` como
  sugiere literalmente la sección 3.6 del plan) — decisión que se
  mantuvo: evita mezclar el ciclo de vida de un intento de reserva
  efímero (10 min) con el de un turno real. Reusa el mismo `EXCLUDE`
  constraint de `appointment_segments` vía `hold_id`/`appointment_id`
  mutuamente excluyentes (`appointment_segments_owner_check`), así que
  un hold y un turno confirmado chocan entre sí igual que dos turnos.
- **Reprogramar desde el turnero público**: mismo patrón que el panel
  de staff (Fase 1) — el hold nuevo lleva `rescheduled_from_id`, y al
  confirmarse cancela el original con motivo automático. No puede
  llamar a `transition_appointment` (exige rol de staff); repite el
  mínimo necesario, igual que `cancel_appointment_by_token`.
  Probado con la API real: crear turno → reprogramarlo → confirmar que
  el original queda `cancelled` con el nuevo enlazado.
- **Onboarding real** vía la RPC `onboard_tenant`: crea tenant +
  `tenant_settings` + `tenant_members` (admin) + `business_hours` +
  copia `service_templates` del rubro, todo en una transacción.
- **Mi turno** (`/{slug}/mi-turno/{token}`): ver detalle y cancelar por
  token, sin login. El token es un `uuid` en texto plano (columna
  `appointments.token`), no el `manage_token_hash` que preveía el
  diseño original de la sección 3.6 — simplificación deliberada dado
  que un UUID v4 ya tiene entropía suficiente contra adivinar; el
  riesgo real (alguien con un dump completo de la base podría extraer
  tokens activos) queda documentado, no resuelto.
- **Mensajería**: trigger que encola `outbox_events` al confirmar o
  cancelar un turno, cron de outbox que los procesa y escribe
  `message_logs`, cron de recordatorios 24 h antes. El envío real
  (WhatsApp/email) sigue simulado con un `console.log` — no hay
  integración con Meta ni Brevo todavía, y el destinatario es un
  placeholder (`customer@example.com`) en vez de resolverse desde el
  cliente real del turno.
- **Notas de cliente** con el matiz de notas clínicas (ficha de
  cliente nueva en `/app/{tenant}/clientes/{clientId}`).

## Qué falta para la Fase 2 completa

- **Mercado Pago**: OAuth + Checkout Pro + webhook siguen siendo el
  stub de la Fase 0. El turnero corre en modo "sin seña" (turno nace
  `confirmed` directo), que es un fallback válido según el plan
  (sección 5.4) pero no el camino principal. Necesita la cuenta
  developer de MP del checklist (`docs/checklist-cuentas-externas.md`).
- **Cloudflare Turnstile** (anti-abuso en el turnero) — no implementado,
  necesita una site key real.
- **Envío real de WhatsApp/email**: el outbox ya arma y encola los
  eventos correctos; falta conectar Meta Cloud API y Brevo.
- **`manage_token_hash`**: si se quiere cerrar la brecha de seguridad
  documentada arriba, migrar de `appointments.token` (plano) a guardar
  el hash y entregar el token plano solo en el momento de la reserva.

# 0002. Fase 1: operación del local

Fecha: 2026-09-17

## Contexto

Fase 1 del plan maestro (semanas 3-5): "servicios con fases, staff,
horarios, bloqueos, clientes, motor de disponibilidad, agenda día y
semana, crear, mover y cambiar estado de turnos, Realtime". Terminado
cuando: "se carga una semana completa de un local de prueba sin solapes".

## Qué quedó construido

- **Modelo de datos** (secciones 3.4, 3.5, 3.6): catálogo, clientes y
  turnos completos, con el FK diferido de `staff_services.service_id` de
  la Fase 0 cerrado.
- **Motor de disponibilidad puro** en `src/domain/availability/` (sección
  5.1): álgebra de rangos, cálculo de segmentos ocupados por fases
  (reproduce el ejemplo exacto del plan), combo "Cualquiera". 22 tests.
- **`appointment_segments` con `EXCLUDE USING gist`** (sección 5.2):
  probado con pgTAP (`no_double_booking.test.sql`) y con un usuario HTTP
  real vía la RPC — un segundo turno solapado se rechaza atómicamente
  (el `appointment` insertado en la misma función también se revierte).
- **`transition_appointment`** y **`create_staff_appointment`** (sección
  4.2): funciones RPC `security definer`, permisos revocados de `anon`.
- **Capa de servidor** `src/server/availability.ts`: conecta el motor
  puro con Supabase real y zona horaria (`@date-fns/tz`) — arma las
  ventanas libres de un profesional para un día y calcula los slots.
- **UI real** (Server Actions + Server Components, sin cliente rico
  todavía): Servicios, Clientes, Staff, Agenda del día, Nuevo turno.

Todo probado end-to-end con un usuario HTTP autenticado real (no solo
simulado en pgTAP): RLS, la RPC de creación, el choque de horario, la
transición de estados y la vista `client_stats`.

## Decisiones y simplificaciones deliberadas

- **`appointments.balance`** es una columna mantenida por trigger
  (`total - deposit_paid`), aproximación hasta que exista `payments` en
  la Fase 5 (el plan dice explícitamente que el saldo "se calcula desde
  payments"). El trigger se reemplaza ahí, no antes.
- **`client_stats.total_spent`** se aproxima con `appointments.total` de
  turnos `completed`, por la misma razón. Vista creada con
  `security_invoker = true` (sin esto, una vista de una migración —
  dueña `postgres`, que tiene BYPASSRLS — ignora el RLS de las tablas de
  abajo para cualquiera que la consulte).
- **Alta de servicio simplificada a una sola fase activa** en la UI. El
  dominio y la base ya soportan fases múltiples con espera (`services →
  service_phases`, probado con el ejemplo del plan); falta el editor
  visual de fases múltiples.
- **"Nuevo turno" es un flujo GET progresivo** (selects + botón, sin
  fetch de cliente) en vez de un formulario interactivo. Es
  deliberadamente simple para esta pasada — funciona, pero no es tan
  fluido como un selector con JS. Candidato a mejorar cuando se sume
  TanStack Query.
- **Un solo servicio por turno** en el flujo de creación (no combos
  múltiples todavía), aunque `create_staff_appointment` y el dominio ya
  soportan un array de items — falta la UI para elegir varios.

## Segunda pasada (2026-09-18): reprogramar, bloqueos, semana, Realtime

- **Reprogramar y cancelar desde la UI**: ficha de turno
  (`/agenda/[appointmentId]`) con las transiciones válidas según el
  estado actual. `transition_appointment` ahora acepta un `p_reason`
  opcional (se guarda en `cancel_reason` solo al cancelar).
  `create_staff_appointment` ahora acepta `p_rescheduled_from_id`: crea
  el turno nuevo y cancela el original en la misma transacción (motivo
  `"Reprogramado"` automático). Ambos cambios de firma requirieron `DROP
  FUNCTION` antes del `CREATE` — un `CREATE OR REPLACE` con una firma de
  parámetros distinta sobrecarga en vez de reemplazar.
- **Bloqueos de horario** (`time_blocks`) desde la UI, dentro de la
  página de Staff: alta (todo el local o un profesional puntual, con
  motivo) y listado de los próximos.
- **Agenda semana**: vista adicional con toggle Día/Semana, conteo de
  turnos por día y por profesional, sin drag & drop todavía.
- **Realtime**: la tabla `appointments` está en la publication
  `supabase_realtime`; un Client Component sin UI propia
  (`realtime-refresh.tsx`) se suscribe filtrando por `tenant_id` y llama
  `router.refresh()` en cada cambio, en vez de duplicar la lógica de
  fetch del lado del cliente.

Probado end-to-end contra la API real (no solo pgTAP): crear turno,
cancelar con motivo, reprogramar a otro horario y confirmar que el
original queda `cancelled` con `rescheduled_from_id` en el nuevo.

## Qué queda para seguir Fase 1

- Grilla con drag & drop (`dnd-kit`, mencionado en el stack del plan) —
  hoy la agenda es de solo lectura + click para el detalle.
- Combo "Cualquiera" en la UI (el dominio ya lo resuelve:
  `unionAnyStaffSlots` + `pickLeastBusyStaff`, falta conectarlo al form
  de "Nuevo turno").
- Notas de cliente (`client_notes`, con el matiz de notas clínicas).
- Editor de fases múltiples en la UI de Servicios (hoy solo una fase
  activa; el dominio y la base ya soportan combos con espera).
- Editar `staff_schedules` desde la UI (hoy solo se ve, se carga por
  seed).

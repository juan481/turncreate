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

## Qué queda para seguir Fase 1

- Agenda semana (vista además de la de día).
- Grilla con drag & drop (`dnd-kit`, mencionado en el stack del plan).
- Realtime: refrescar la agenda en vivo con cambios de otros usuarios.
- Reprogramar y cancelar desde la UI (el RPC `transition_appointment` ya
  soporta las transiciones; falta el botón y el flujo de reasignación).
- Editar horarios de staff y cargar bloqueos (`time_blocks`) desde la UI
  — hoy `staff_schedules` se ve pero no se edita después del seed.
- Combo "Cualquiera" en la UI (el dominio ya lo resuelve:
  `unionAnyStaffSlots` + `pickLeastBusyStaff`).
- Notas de cliente (`client_notes`, con el matiz de notas clínicas).

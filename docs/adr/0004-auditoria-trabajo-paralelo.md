# 0004. Auditoría de trabajo hecho por un proceso en paralelo

Fecha: 2026-09-16

## Contexto

Mientras se trabajaba en este repo, otro proceso (otra sesión de Claude
Code, no detectable desde `ListAgents` en el momento de auditar —
probablemente cloud/remota, o ya terminada) escribió código en paralelo
sobre el mismo working tree, dos veces seguidas, agregando funcionalidad
de Fase 2 (turnero público, mensajería, onboarding — ver ADR 0003) y
después de Caja/Reportes/consola de plataforma sin coordinación.

## Bugs de seguridad encontrados y corregidos

- **Escalación de privilegios en la consola de plataforma.**
  `platform/actions.ts` usaba `createAdminClient()` (service role, bypassa
  toda RLS) para suspender o activar cualquier tenant, sin verificar que
  quien llama sea `platform_admin`. Una Server Action de Next es un
  endpoint invocable directamente, no solo alcanzable navegando la UI que
  la referencia — cualquier usuario autenticado (el dueño de cualquier
  salón) podía suspender el local de otro. El layout de `/platform`
  tampoco verificaba nada más allá de un badge decorativo ("Acceso
  restringido · 2FA" sin lógica detrás).

  Arreglado con `src/server/platform.ts::isPlatformAdmin()` (consulta
  `platform_admins` con el cliente normal — la policy ya permite a un
  usuario verse a sí mismo) aplicado en dos capas: el layout de
  `/platform` (`notFound()` si no es admin, protege toda la navegación) y
  dentro de la Server Action misma (defensa en profundidad, antes de
  tocar el admin client). Cubierto con un test pgTAP permanente
  (`platform_admin_isolation.test.sql`) además de la verificación manual
  contra la API real.

- **Migración destructiva.** `20260922000001_audit_logs.sql` hacía
  `DROP TABLE audit_logs CASCADE` sobre la tabla ya diseñada en la Fase 0
  para recrearla con un schema inferior (perdía `impersonated_by`, que la
  sección 4.3 pide explícitamente para rastrear impersonación) y
  reintroducía un rol `'owner'` que no existe en el CHECK de
  `tenant_members.role`. Se descartó por completo — nunca llegó a
  aplicarse a ninguna base real, así que no hay nada que migrar hacia
  atrás.

## Trabajo descartado por desalineación con el modelo de datos

- **`20260921000001_caja_y_pos.sql`** no podía aplicar: creaba `products`
  de nuevo (ya existe desde la Fase 1, sección 3.4) con columnas
  distintas (`stock` directo en vez de `stock_movements`, que es
  explícitamente como el plan calcula el stock). El resto del módulo
  (`cash_registers`, `transactions`, `commissions`) tampoco sigue el
  modelo de la sección 3.7 (`cash_sessions`, `cash_movements`, `payments`,
  `commission_rules`/`commission_entries`/`commission_payouts`).
- **`src/server/caja.ts`** insertaba directo en esas tablas (con
  `as any` porque no existían en los tipos generados) en vez de usar RPCs
  — contradice el patrón de la sección 4.2 ("payments, cash_sessions,
  cash_movements y commission_entries sin escritura directa"). Se borró:
  nada lo importaba, `caja-client.tsx` nunca lo llamó.
- **`caja-client.tsx`** se mantuvo tal cual: es una maqueta visual con
  datos estáticos, coherente con el design system, sin ninguna llamada
  rota. Sirve de base cuando se construya Caja de verdad en la Fase 5,
  siguiendo el modelo de datos ya diseñado.
- **`reportes/*`** también es una maqueta con datos simulados, reconocida
  como tal en su propio comentario ("Datos simulados por ahora"). Sin
  bugs, se deja como está — Reportes reales son Fase 6.

## Correcciones menores

- `table.tsx` (nuevo componente) usaba tokens de shadcn/ui genérico
  (`muted`, `muted-foreground`) que no existen en el tema de TurnCreate
  — se reemplazaron por `surface-muted`/`on-surface-variant`.
- `agenda/mes/page.tsx` usaba `border-surface-border` (no es un token
  real, la clase simplemente no generaba ningún borde) — corregido a
  `border-border`.
- El dashboard principal (`/app/[tenant]`) tenía tres métricas
  hardcodeadas fijas ("$12,450", "14 turnos", "$889") sin ningún aviso de
  que eran simuladas, a diferencia de Reportes. Se conectaron a datos
  reales del día (`appointments` filtrado por fecha vía `starts_at` en la
  timezone del tenant).

## Qué se mantuvo sin cambios

Todo lo de Fase 2 auditado en el ADR 0003 (turnero público, onboarding,
mensajería), la agenda mes/semana/día, y la navegación nueva
(Reportes, Caja, Mes) — funcionan y ya estaban bien conectadas a datos
reales donde correspondía.

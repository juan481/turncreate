# TurnCreate

SaaS multi-tenant de turnos, CRM y caja para barberías, salones y centros de
estética de Argentina. Plan maestro completo en
`../TurnCreate — Plan maestro de desarrollo.docx` (carpeta padre); design
system en `../DESIGN.md` y pantallas de referencia en
`../Pantallas - Referencias/`.

Estado: Fase 2 en curso (turnero público, onboarding, mensajería), 100%
local — ver `docs/adr/0001-fase-0-fundaciones.md`,
`docs/adr/0002-fase-1-operacion-del-local.md` y
`docs/adr/0003-fase-2-turnero-publico.md`. Mercado Pago real y Cloudflare
Turnstile todavía no están conectados (necesitan cuentas externas, ver
`docs/checklist-cuentas-externas.md`); el turnero funciona en modo
"sin seña" mientras tanto.

## Desarrollo local

Requisitos: Node 22+, Docker Desktop corriendo.

```bash
npm install
npx supabase start        # levanta Postgres + Auth + Studio local (Docker)
```

Copiá las credenciales que imprime `supabase start` (o `npx supabase status`)
a un `.env.local` (ver `.env.example`). Después:

```bash
npm run dev                # http://localhost:3000
```

Supabase Studio local queda en `http://127.0.0.1:54323`.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo Next.js |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (lógica de `src/domain/`) |
| `npm run db:types` | Regenera `src/lib/database.types.ts` desde el schema local |
| `npx supabase test db supabase/tests` | pgTAP (aislamiento, permisos por rol, doble reserva) |
| `npx supabase db reset` | Reaplica migraciones + `seed.sql` desde cero |

Corré `npm run db:types` después de cualquier cambio de schema (migración
nueva) — el resto del código depende de esos tipos para el typecheck.

## Estructura

Ver la sección 2.3 del plan maestro. Resumen:

- `src/app/` — 4 zonas por route group: `(public)/[slug]` (turnero),
  `(auth)`, `(onboarding)/onboarding`, `(app)/app/[tenant]`,
  `(platform)/platform`, más `(marketing)` (landing) y `api/`.
- `src/domain/` — lógica pura, sin Next ni Supabase (Vitest).
- `src/server/` — clientes de Supabase (y, más adelante, MP/WhatsApp/Brevo).
- `src/components/ui/` — primitives del design system (`Button`, `Card`,
  `StatusPill`, `Input`, `Icon`, `Logo`).
- `supabase/migrations/` — esquema; `supabase/tests/database/` — pgTAP.

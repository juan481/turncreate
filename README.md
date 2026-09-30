# TurnCreate

SaaS multi-tenant de turnos, CRM y caja para barberías, salones y centros de
estética de Argentina. Plan maestro completo en
`../TurnCreate — Plan maestro de desarrollo.docx` (carpeta padre); design
system en `../DESIGN.md` y pantallas de referencia en
`../Pantallas - Referencias/`.

Estado: 100% Firebase/Firestore (ver `MIGRACION_FIREBASE.md`). Mercado Pago
real y WhatsApp todavía no están conectados (necesitan cuentas externas, ver
`docs/checklist-cuentas-externas.md`); el turnero funciona en modo
"sin seña" mientras tanto.

## Desarrollo local

Requisitos: Node 22+, credenciales de Firebase (proyecto `turncreate-prod`
o uno propio de desarrollo).

```bash
npm install
```

Completá `.env.local` (ver `.env.example`) con las credenciales de Firebase
Admin (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)
y `FIREBASE_WEB_API_KEY`. Después:

```bash
npm run dev                # http://localhost:3000
```

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo Next.js |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (lógica de `src/domain/`) |

## Estructura

- `src/app/` — 4 zonas por route group: `(public)/[slug]` (turnero),
  `(auth)`, `(onboarding)/onboarding`, `(app)/app/[tenant]`,
  `(platform)/platform`, más `(marketing)` (landing) y `api/`.
- `src/domain/` — lógica pura, sin Next ni Firebase (Vitest).
- `src/server/firebase/` — Firebase Admin, sesiones, tenants y el motor de
  disponibilidad/reserva (`booking.ts`) compartido por agenda y turnero.
- `src/components/ui/` — primitives del design system (`Button`, `Card`,
  `StatusPill`, `Input`, `Icon`, `Logo`).

# TurnCreate — handoff: suscripciones de locales + mails (2026-10-16)

## 0. Estado en una línea
Producción = `a79a35e` (LIVE, verificado). Local `main` = `cc5c096` (solo el contrato de billing, **sin pushear**) + **trabajo a medias sin commitear** de 3 agentes que se cortaron por límite de gasto. Hoy: `tsc` con 3 errores, vitest con 1 test roto (detalle en §3). Nada de esto está en producción.

## 1. Qué está LIVE (a79a35e) — no rehacer
- Rediseño UX completo (onboarding, home con paso a paso de 4 pasos + interruptor del turnero + celebración "¡Turnero habilitado!", Configuración en botonera, Pagos y señas con MP y transferencia, nuevo turno en pasos, agenda con dial, caja Hoy/Historial/Reportes, reportes en streaming).
- Seña por transferencia de punta a punta (público, Mi turno, `/transferencias`, detalle del turno), endurecida.
- `/platform`: lista de locales, ficha por local, prender/apagar local o solo turnero con motivo, auditoría (`platformAudit`), `/platform/auditoria`.
- Local `status: "suspended"` → panel redirige a `/cuenta-suspendida` y `requireTenantAccess` rechaza.
- Seguridad: `requireTenantPage` en cada `page.tsx` del admin (el auth del layout NO alcanza: RSC filtra), OAuth MP atado a sesión, webhook que no revierte pagos, índices Firestore, cron `*/5` de `/api/cron/holds` en el VPS.
- E2E: 125/125 (4 viewports). Unit: 249.

## 2. Decisiones de negocio de Juan (definitivas)
- Los locales pagan a Just Create **solo con Mercado Pago automático** (Suscripciones / `preapproval`, débito mensual) a la cuenta MP de Juan.
- Locales nuevos: **todo gratis (cortesía) por ahora**; después se activa prueba de N días desde `/platform/planes`.
- Sin pago: **3 días de gracia** con aviso amarillo → después **turnero público cerrado + panel solo lectura** con el cartel "Por falta de pago tu turnero está interrumpido. Por favor aboná tu plan para seguir usándolo." + botón de pago.
- Planes: Solo $19.900 / Equipo $34.900 / Pro $54.900 ARS/mes, **editables desde /platform** sin deploy. Alinear la landing con lo que existe (sacar/“Próximamente”: WhatsApp incluido, multi-sucursal, dominio propio, comisiones automáticas, mini POS, permisos de recepcionista; cambiar “prueba 7 días” por copy según config).
- **Ignorar** las 3 cuentas iniciales (Alisson/Ponte/Generic) y su script.

## 3. Trabajo a medias (sin commitear) — terminarlo
Contrato commiteado (leerlo primero): `src/lib/billing.ts` (+test) — estados `free|trial|active|past_due|unpaid|cancelled`, `billingAccess(billing, now)` → `full|grace|readonly`; un agente le agregó `cancelAtPeriodEnd`. `src/lib/plans.ts`: `PLAN_IDS`, `DEFAULT_PLAN_PRICES_ARS`, `isPlanId`. Firestore: `tenants/{id}.billing` (fechas Timestamp), `platformConfig/billing`.

**A — backend (`src/server/billing/**`, mayormente escrito):** `config.ts` (`getBillingConfig`/`saveBillingConfig`), `tenant-billing.ts` (`readTenantBilling`, `tenantBillingAccess`, `initialBillingFor`), `subscriptions.ts` (`isSubscriptionCheckoutAvailable`, `createSubscriptionCheckout`, `cancelSubscription`, `syncSubscription`, stub para E2E), webhook de suscripciones. Revisar y completar:
- `src/server/public-booking/transfer.ts:93` usa `tenantBillingAllowsPublicBooking` que no existe → importarlo/crearlo en `tenant-billing.ts` (debe usar `billingAllowsPublicBooking` de `src/lib/billing.ts`).
- `requireTenantAccess(uid, slug, { write?: boolean })` en `src/server/firebase/tenants.ts`: default `write: true`, rechaza escrituras en readonly; las acciones que solo leen (agenda/mes `loadMonth`, reportes, etc.) pasan `{ write: false }`; la acción que INICIA el pago también `{ write: false }`.
- Turnero público cerrado si `!billingAllowsPublicBooking` (getPublicTenant, slots, createHold, transfer, checkout MP).
- `createTenantForOwner` escribe `billing: initialBillingFor(await getBillingConfig(), plan, now)`.
- Webhook (`src/app/api/webhooks/mercadopago/route.ts`): rutear `subscription_preapproval` / `subscription_authorized_payment` (y nombres legacy) a `src/server/billing/webhook.ts`, misma validación HMAC, re-consulta a MP con `MP_PLATFORM_ACCESS_TOKEN`, idempotente (`billingEvents/{id}`), registra cobros en `billingPayments`. No romper el flujo existente de topic `payment`.
**B — UI del local (escrito parcial):** `src/app/(app)/app/[tenant]/plan/**` ("Mi plan": plan, estado, próximo cobro, elegir plan, "Suscribirme con Mercado Pago" → `initPoint`; deshabilitado con "se habilita muy pronto" si no hay token; cancelar con confirmación; `?mp=subscribed`), `src/components/ui/billing-banner.tsx` (gracia amarillo / prueba por vencer / cartel readonly) montado en `layout.tsx`, "Mi plan" en hoja Más (`mobile-bottom-nav.tsx`), tile en `configuracion/page.tsx`, ruta `plan` en `route-meta.ts` (+test). En readonly ocultar el + del speed-dial.
**C — /platform (escrito parcial):** `billing-actions.ts`, `planes/` (precios, modo de alta free/trial + días, días de gracia), `src/server/platform/{billing-model,action-support}.ts`. Falta/arreglar:
- `tenants-client.tsx:20` y `:41`: falta la key `demo` en los mapas de filtros/contadores (se agregó el filtro "Demo").
- `src/server/platform/model.test.ts`: 1 test roto (probablemente por el nuevo filtro demo) — revisar.
- Ficha `/platform/[tenantId]`: sección "Suscripción" (cortesía, iniciar/extender prueba, cambiar plan, interrumpir por falta de pago, reactivar, dar de baja → `cancelSubscription`), todas auditadas con motivo en las negativas.
- Flag `isDemo` (toggle auditado, excluido de KPIs del overview; los 3 demos: demo-individual, demo-equipo, demo-barberia → por eso el KPI "699 turnos").
- "Eliminar local": solo si ya está apagado o dado de baja; escribir el slug exacto + motivo; auditar ANTES; `db.recursiveDelete(tenantRef)` + `tenantSlugs/{slug}` + `tenantClientPhones`/`pendingTransfers`/`pendingTransferPhones` con ese tenantId + `users/{uid}/memberships/{tenantId}` + `mpSellers` que apunten a él. Nunca borrar usuarios de Auth.
- Landing (`src/app/(marketing)/page.tsx`) según §2, precios desde `getBillingConfig()`.
- `e2e/platform.spec.ts`: cubrir demo + ciclo de billing sobre `e2e_platform_tenant` (solo pixel-7).

## 4. Siguiente: notificaciones por mail (Juan aceptó SES, falta confirmar remitente)
Diagnóstico: `src/server/email.ts` ya usa **Amazon SES** (`@aws-sdk/client-ses`, plantillas de confirmación/recordatorio/cancelación) pero el VPS **no tiene credenciales AWS** → hoy no sale ningún mail. Además: la dueña nunca recibe nada; la clienta solo recibiría confirmación de turnos manuales (no de reservas públicas/MP/transferencia); `/api/cron/recordatorios` y `/api/cron/outbox` no están en el crontab y `recordatorios` usa un collectionGroup `appointments` con `status` + rango `startsAt` → **necesita índice compuesto** (agregar a `firestore.indexes.json` y desplegar) o reescribirse. Remitente actual `no-reply@turncreate.com.ar` (dominio sin mail): propuesta `TurnCreate <turnos@justcreate.com.ar>` (justcreate.com.ar ya tiene SPF con amazonses) con Reply-To = email del local.
Implementar: a la dueña (nuevo turno, transferencia por confirmar, clienta canceló) al `contactEmail` del onboarding o el de login; a la clienta (confirmación con link Mi turno, instrucciones de transferencia, recordatorio 24 h, cancelación/reprogramación); preferencias en Configuración; programar crons. Todo inactivo sin claves (no romper).

## 5. Pendientes de Juan (no los puede hacer el agente)
- Registrarse en `/registro` con `juancruzrossi1@gmail.com` (es `PLATFORM_ADMIN_EMAIL` en el VPS y **la cuenta no existe**: mientras no exista, cualquiera podría registrarse con ese email y ser admin). Después setear `PLATFORM_ADMIN_UID` con su uid en el `.env` del VPS.
- `MP_PLATFORM_ACCESS_TOKEN` (access token de producción de SU cuenta MP) en el `.env` del VPS; habilitar en la app MP 5045809422290209 los tópicos de suscripciones del webhook.
- AWS: dominio verificado en SES, cuenta fuera de sandbox, usuario IAM solo `ses:SendEmail` → `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`/`AWS_REGION`/`SES_FROM_EMAIL` en el `.env` del VPS.
- Repo `juan481/turncreate` es **público**. Para pasarlo a privado, ANTES darle al VPS una deploy key de solo lectura (el VPS hace `git pull` https anónimo; si se pasa a privado sin eso, se rompen los deploys).
- Nunca poner secretos en este repo ni en el chat.

## 6. Reglas del proyecto (no negociables)
- Leer `.claude/skills/turncreate-mobile-ui/SKILL.md` antes de tocar UI. `AGENTS.md`: Next 16 distinto a lo conocido → `node_modules/next/dist/docs/`.
- Cada `page.tsx` del admin: `await requireTenantPage(slug)`; cada page de `/platform`: `isPlatformAdmin()` + `notFound()`; cada server action: auth + `requireTenantAccess`/`requirePlatformAdmin` antes de leer/escribir.
- **Índices**: producción los exige y el emulador no → cualquier `collectionGroup` o query multi-campo nueva va a `firestore.indexes.json` y se despliega (`npx firebase deploy --only firestore:indexes --project turncreate-prod`, con OK de Juan) ANTES del código.
- Tailwind: **nunca** `max-w-xs|sm|md|lg|xl|2xl` (chocan con `--spacing-*`; `max-w-sm` = 0.5rem). Usar rem: `max-w-[24rem]`.
- Archivos con CRLF: los scripts de edición tienen que respetarlo.

## 7. Verificar y deployar
```bash
npm run typecheck && npx eslint . && npx vitest run && TZ=UTC npx vitest run
export PATH="/c/Program Files/Eclipse Adoptium/jre-21.0.12.101-hotspot/bin:$PATH"
npx playwright test          # emuladores + next en :3100; seed en scripts/seed-e2e.cjs
```
Deploy (con OK explícito de Juan; push a main NO despliega solo):
```bash
git push origin main
ssh -i ~/.ssh/claude_justfood root@5.161.65.111 'cd /root/turncreate && git pull --ff-only && source /root/.nvm/nvm.sh && nvm use 22 && npm ci && npm run build && npm prune --omit=dev && pm2 restart turncreate --update-env'
```
Smoke: `/`, `/login`, `/demo-individual`, `/platform` (404 sin admin), cookie inventada + `RSC: 1` en `/app/demo-individual/clientes` sin teléfonos, webhook sin firma 401, `/root/turncreate-cron-holds.sh` → 200.

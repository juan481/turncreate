---
name: turncreate-mobile-ui
description: Convenciones del rediseño mobile de TurnCreate (tokens, primitivas de components/ui, el shell AppBar/bottom-nav, reglas duras anti-overflow, helpers de fecha, tono de copy). Cargar SIEMPRE antes de tocar cualquier pantalla bajo src/app/(app)/app/[tenant]/ -- home, agenda, nuevo turno, detalle de turno, clientes, caja, reportes, servicios, staff, configuración -- para que las 4 áreas en paralelo queden visualmente y estructuralmente consistentes entre sí.
---

# TurnCreate — convenciones del rediseño mobile

Referencia, no un tutorial paso a paso. Leela antes de editar, aplicá las convenciones, seguí trabajando.

## 1. Tokens (`src/app/globals.css`, bloque `@theme`)

- **Color de marca**: `primary`/`secondary` = violeta `#7069e8` (hover `#5b52d6`). `tertiary` = verde `#22c55e`. Estados: `status-{confirmed,pending,alert,draft}` + `-bg` + `-dot` para cada uno.
- **Degradé de marca y sombras teñidas** (AppBar, + de la barra, FAB, KpiTile `emphasis`): `bg-gradient-to-br from-primary-light via-primary to-primary-deep`, brillo lila `bg-primary-glow/20`, sombras `shadow-brand` (header) y `shadow-fab` (botón flotante). Velo oscuro de overlays: `bg-scrim/60 backdrop-blur-sm`.
- **Animaciones** (todas con `motion-safe:` o `motion-reduce:animate-none`): `animate-fade-in/fade-up/pop-in/sheet-up/scrim-in`, más `animate-greet-in` (texto que sube apenas), `animate-icon-rise` (ícono que "sale" como un sol) y `animate-dial-in` (ítems del speed-dial; escalonalos con `style={{ animationDelay }}`). Si necesitás otra, va como `--animate-*` + `@keyframes` en globals.css, no inline.
- **Superficies**: `canvas` (fondo lavanda de página) → `surface`/`surface-container-lowest` (blanco, cards) → `surface-container-low/DEFAULT/high/highest` (tintes para anidar: chip sobre card sobre fondo).
- **Tipografía**: `headline-xl..sm`, `body-lg..sm`, `label-lg..xs`. `label-xs` (10px) es NUEVA, para los labels de la barra inferior — no existía antes de este rediseño.
- **Spacing — GOTCHA real, ya mordió código antes**: `xs/sm/md/lg/xl/2xl` alimentan la MISMA escala compartida de padding, gap, width, height Y max-width. Un `max-w-sm` o `max-w-xs` NO te da el ancho de contenedor típico de Tailwind — resuelve contra `--spacing-sm` (0.5rem) o `--spacing-xs` (0.25rem), prácticamente nada. Para anchos máximos usá un valor entre corchetes: `max-w-[24rem]`, nunca el nombre corto.
- **Radios**: `rounded-sm` (chips), `rounded-inner` (filas/contenedores anidados), `rounded-card` (cards grandes), `rounded-pill` (botones/inputs/filtros).
- **Safe-area**: variables `--safe-t/b/l/r` (`env(safe-area-inset-*)`, fallback 0px). No existe una utilidad `.pb-safe` — combinalas vos en el punto de uso con un valor entre corchetes: `pb-[calc(0.75rem+var(--safe-b))]`. Ya están sumadas en `AppBar`, `MobileBottomNav` y el `Modal` variant="sheet"; solo hace falta si agregás OTRO elemento fijo que toque el borde real de la pantalla.
- **Números y plata**: clase `tabular-nums`, para que los dígitos no bailen de ancho al actualizarse (KpiTile y AppointmentRow ya la aplican).

## 2. Primitivas (`src/components/ui/`)

Antes de escribir markup a mano para algo de esta lista, usá la primitiva — así las 4 áreas se ven iguales sin coordinar entre sí.

| Componente | Cuándo usarlo |
|---|---|
| `AppBar` (`app-bar.tsx`) | Ya está montado por el shell (ver §3) vía `MobilePageHeader`. No lo instancies de nuevo en una página de pantalla. |
| `BackButton` (`back-button.tsx`) | `<BackButton href={padre} variant="default"\|"on-brand" />`. Es un `<Link>` al **padre jerárquico** de la ruta según `route-meta.ts` (`resolveTenantRoute(pathname, slug).backHref`) — **NUNCA `router.back()`**: el historial depende del camino que hiciste, la jerarquía no (Agenda → Clientes → Caja + Volver = Inicio). Recupera el `?query` con el que dejaste el padre (`RememberRouteSearch`, ya montado en el layout). El atrás físico del teléfono sigue siendo historial, eso es del navegador. `fallbackHref` = alias viejo de `href`. `variant="on-brand"` sobre violeta (AppBar), `"default"` sobre fondos claros. Pantalla nueva = agregala a `ROUTES` en `route-meta.ts` con su `parent`. |
| `KpiTile` (`kpi-tile.tsx`) | Métrica: ícono en chip + etiqueta + número protagonista (`tabular-nums`, `truncate` en `min-w-0`) + hint (line-clamp-2). `{label, value, hint?, hintTone?, icon?, href?, emphasis?, title?}`. `emphasis` = LA métrica principal de la pantalla (degradé de marca, número grande; una sola). En grilla 2x2 a 320px cada tile tiene ~105px útiles: pasá la plata grande compacta ("$1,25 M") y el valor completo en `title`. |
| `JustCreateFooter` (`just-create-footer.tsx`) | Firma "Desarrollado y diseñado por Just Create". En el admin **ya la monta el layout** al final de `<main>` en TODAS las pantallas — no la agregues en tu página. |
| `MenuTile` (`menu-tile.tsx`) | Tarjeta de la botonera de la home: ícono en cuadrado + título + subtítulo con dato vivo. `{href, icon, title, subtitle?}`. |
| `StatusDot` (`status-dot.tsx`) | Punto de color + texto chico, para **filas densas** (lista de turnos, historial). `{tone: "confirmed"\|"pending"\|"alert"\|"draft"\|"neutral", children}`. |
| `StatusPill` (`status-pill.tsx`, YA EXISTÍA) | Pill de 24px con fondo tintado, para **headers y detalle** donde el estado es protagonista (ficha de turno, filtros). **No la uses en filas de lista** — eso es literalmente el bug que se está arreglando ("se ve un Confirmado enorme" tapando nombre/servicio). En listas, `StatusDot`. |
| `AppointmentRow` (`appointment-row.tsx`) | Tarjeta de turno de lista: hora compacta, avatar, nombre protagonista, servicio, `StatusDot`, precio. `{href, time, durationLabel?, clientName, clientPhoto?, serviceName, staffName?, statusTone, statusLabel, price?}`. |
| `VerticalBarChart` / `HorizontalBarList` (`bar-chart.tsx`) | Gráficos en CSS puro, sin librería. Vertical para tendencia mensual, horizontal para rankings (servicios más pedidos, top clientas). Ojo con el gotcha de altura: si armás un gráfico de barras A MANO (no con esta primitiva), un `height:N%` necesita que TODOS sus ancestros tengan una altura explícita en la cadena (`style={{height}}` en la raíz + `h-full` en cada nivel intermedio) — si confiás en `items-end` de flexbox para eso, el navegador no reserva altura y la barra no se ve (exactamente lo que le pasaba al gráfico viejo de Reportes). Usá la primitiva y te olvidás del problema. |
| `StepperHeader` / `StepPanel` (`stepper.tsx`) | Flujos en pasos (nuevo turno): "Paso X de N" + barra segmentada + título con aria-live; `StepPanel` anima la entrada de cada paso (sin animación con reduced motion). Si un paso se saltea (un solo profesional), N baja: no muestres "de 4" si son 3. |
| `MonthCalendar` (`month-calendar.tsx`) | Elegir un día: mes con lunes primero, `minISO`/`maxISO` + `isDayDisabled(iso)`, flechas de 44px. Cada día es un botón con `data-date="YYYY-MM-DD"` (los E2E lo usan) y aria-label completo. Nunca `<input type="date">`. |
| `DayDial` (`day-dial.tsx`) | Tira horizontal de días con scroll-snap (agenda): el elegido centrado, hoy con anillo, scroll dentro de su propio contenedor (nunca de la página). |
| `EmptyState` (`empty-state.tsx`) | Ícono + título + descripción + acción opcional, para listas vacías. |
| `useToast` / `ToastProvider` (`toast.tsx`) | Ya montado en el layout del tenant. Para confirmar una acción: `const toast = useToast(); toast.show("Turno agendado para el sábado 10/10 10:00")`. No inventes otro sistema de feedback (ni `alert()`, ni toasts ad-hoc). |
| `Modal` (`modal.tsx`) | `closeOnBack` (default `true`): el atrás del teléfono cierra el sheet en vez de abandonar la pantalla. No lo desactives salvo razón concreta. |
| `Avatar`, `Button`, `Card`, `Input`, `Icon` | Sin cambios de API, seguís usándolos igual. `Icon` ahora renderiza SVG de lucide-react (antes era texto con una fuente); si necesitás un ícono que no está en el mapa `ICONS` de `icon.tsx`, importá el componente de lucide-react correspondiente y agregalo ahí — no inventes otro patrón de ícono. |

## 3. Contrato del shell (`src/app/(app)/app/[tenant]/layout.tsx`)

Por debajo de `lg` (1024px) el layout ya renderiza `MobilePageHeader` (un `AppBar` violeta sticky con ‹Volver + título de la sección, resuelto por ruta). El header-pill flotante viejo (logo + nav-pills + avatar) ahora es **solo `lg+`**.

Consecuencia práctica: **tu pantalla no necesita su propio `<h1>` + link de volver para mobile** — eso ya lo da el AppBar. Pero el header-pill de escritorio NO tiene título ni back propio, así que si la página ya traía su `<h1>`/back a mano (ej. `clientes/[clientId]/page.tsx`, `agenda/[appointmentId]/page.tsx`, `servicios/[serviceId]/page.tsx`), **no lo borres**: envolvelo en `hidden lg:flex` (o `lg:block`) para que siga apareciendo en desktop y desaparezca en mobile, donde ya está duplicado por el AppBar.

**Barra inferior (`mobile-bottom-nav.tsx`, < lg)** — 5 slots fijos: **Inicio · Agenda · (+) · Clientes · Más**. La pestaña activa la decide `bottomNavTab(relativeTenantPath(pathname, slug))` de `route-meta.ts` (inicio | agenda | clientes | menu) y se marca con una pill tintada (`bg-secondary-soft text-primary`) detrás del ícono + label `label-xs` en `text-primary`. "Más" abre un `Modal variant="sheet"` con Caja, Servicios, Reportes, Equipo (solo si el plan permite >1 profesional), Configuración y Ayuda, más el selector de local (si hay varios) y Cerrar sesión; queda marcada en cualquier sección "menu" (caja, reportes, servicios, staff, configuracion, ayuda, novedades, tutorial, bot, transferencias). Barra `h-16` + `pb-[var(--safe-b)]`, slots `min-h-14`, labels truncan: entra a 320px. **No agregues slots** — una sección nueva va a la hoja "Más" y/o a la botonera de la home (y a `MENU_SECTIONS` de route-meta si debe marcar "Más").

**El + es un speed-dial (`new-appointment-fab.tsx`)** — tanto el + central de la barra (mobile) como el FAB de abajo a la derecha (lg+). Al tocarlo: velo `bg-scrim/60 backdrop-blur-sm` sobre toda la pantalla y las acciones apiladas con entrada escalonada (`animate-dial-in`): **Nuevo turno** (`/agenda/nuevo`, respeta `?date=` si estás mirando un día de la agenda), **Nuevo cliente** (`/clientes` — no existe `/clientes/nuevo`) y **Cobrar** (`/caja`). El + gira a × (`rotate-45`). Cierra con tap en el velo, Escape (devuelve el foco al +) o cambio de ruta (el estado guarda el pathname donde se abrió: si cambia, queda cerrado solo). `aria-expanded`/`aria-controls` en el botón. El velo y las acciones van por **portal a `document.body`** (la barra tiene `backdrop-blur`, que la vuelve containing block de cualquier `fixed` de adentro); mientras está abierto la barra sube a `z-[70]` sobre el velo (`z-[60]`) y se oscurece con su propio velo interno. Acciones nuevas: agregalas en `quickActions()`, no armes otro FAB.

**Footer**: `<JustCreateFooter />` va como último hijo de `<main>` en el layout; el `pb` mobile de `<main>` es `calc(5.5rem+var(--safe-b))` para que la barra inferior (y el + que asoma) nunca lo tape. Si cambiás la altura de la barra, ajustá ese padding.

**Colores del shell solo por token**: el AppBar y el + usan `from-primary-light via-primary to-primary-deep`, `shadow-brand`/`shadow-fab`, `bg-primary-glow/20`. Nada de `#hex` ni `rgba()` en className.

## 4. Reglas duras (con el motivo, no son caprichos)

- **Toda `page.tsx` del admin arranca con `const { tenant } = await requireTenantPage(slug)`** (`@/server/firebase/tenant-page`), aunque el layout ya lo llame. Motivo: Next renderiza layout y página en paralelo; el `notFound()` del layout NO impide que los datos de la página viajen en el payload RSC. `requireTenantPage` está envuelto en `cache`, así que layout + página comparten una sola verificación por request. Una ruta nueva sin tipos generados todavía puede tipar sus props a mano: `{ params }: { params: Promise<{ tenant: string }> }` (PageProps<"/app/[tenant]/x"> recién existe después de `next typegen`).
- **Nada de colores hex (ni `rgba()`/`rgb()` literales) en className ni en style.** Todo color sale de un token de `globals.css` (`bg-primary`, `from-primary-light`, `bg-scrim/60`, `text-status-draft`...). Si te falta un color, agregalo como `--color-*` en el `@theme` (con un comentario de para qué es) y usalo por nombre. Motivo: los hex sueltos del header y el FAB se desincronizaban del violeta de marca cada vez que se tocaba uno solo.

- **Todo target tocable ≥44px** (`h-11` en esta escala). Un botón de 32-37px se toca mal con el dedo.
- **Todo grid que pueda aparecer en mobile necesita `grid-cols-1` explícito antes de cualquier `sm:`/`md:`/`lg:` override.** Un `lg:grid-cols-3` suelto, sin fallback de 1 columna, deja que el grid se dimensione por el contenido más ancho — es la causa literal del "scroll lateral" en la ficha de cliente hoy.
- **Todo hijo de flex/grid con texto que pueda desbordar necesita `min-w-0` en el contenedor + `truncate` en el texto.** `truncate` solo no alcanza si el padre no tiene `min-w-0` (los ítems de flex/grid no se achican por debajo de su contenido por default).
- **Plata y contadores: `tabular-nums`.**
- **Fechas: nunca `new Date("YYYY-MM-DD")` ni `new TZDate("YYYY-MM-DDTHH:MM:SS", tz)`.** Usá los helpers de `src/lib/dates.ts` (`zonedInstant`, `dayRange`, `weekRange`, `monthRange`, `todayISO`, `formatInTz`, `longDayLabel`, `dayMonthLabel`, `isDateISO`, etc.). Motivo real, no teórico: `new TZDate(texto, tz)` lo parsea `@date-fns/tz` con `new Date(texto)`, que lee el texto en la zona horaria del PROCESO, no en `tz` — en el VPS (UTC) eso guardaba cada turno un día antes de lo pedido. Ya se arregló en `src/server/availability.ts` y en todas las pantallas existentes; cualquier query o cálculo de rango de fechas NUEVO que agregues tiene que pasar por estos helpers o reintroduce el mismo bug.
- **Tono de copy: voseo rioplatense**, casual pero preciso, nunca "ustedeo" ni "tú". Ejemplos reales ya en el repo:
  - "¿No tenés cuenta?"
  - "Probá reservar uno vos mismo/a ahí -- lo vas a ver reflejado acá al toque."
  - "Olvidate de cruzar horarios a mano."
  - "Administrá la apertura y cierre de caja diaria... funciona igual si sos vos solo/a o si sumás todo un equipo."

## 5. Dónde está cada cosa

- Pantallas del admin: `src/app/(app)/app/[tenant]/<sección>/...`
- UI compartida: `src/components/ui/`
- Helpers de fecha/zona horaria: `src/lib/dates.ts`
- Acceso a datos / Firestore: `src/server/firebase/` (`booking.ts` = motor de turnos, `tenants.ts`, `stats.ts` = `getDaySummary` ya calculado — turnos/facturado/cobrado/por cobrar de un día, usalo en vez de recalcularlo inline si tu pantalla necesita "hoy")
- Rangos de mes/calendario: `src/server/agenda-month.ts`

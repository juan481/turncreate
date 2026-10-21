# TurnCreate — handoff de reservas, señas y cancelaciones

Fecha: 2026-10-21
Rama: `wip/suscripciones`

## Resultado

Se actualizó el flujo público de reserva, la configuración de horarios, la política de cancelación y la gestión de señas. La implementación conserva compatibilidad con comercios existentes: si un tenant todavía no tiene el nuevo campo de política, se aplican 24 horas por defecto.

## Cambios implementados

### Flujo público

- Encabezado persistente con nombre/logo, dirección e Instagram como `@usuario` cuando la URL permite obtenerlo.
- Indicador visual `Paso X de Y`, porcentaje y barra de progreso.
- Fecha y horario separados en pasos claros.
- Calendario simultáneo del mes actual y el siguiente.
- Días pasados, fuera del rango o sin atención en gris, con leyenda.
- Grilla amplia de horarios; los ocupados siguen visibles, deshabilitados, tachados y marcados como `Ocupado`.
- Formulario con nombre, WhatsApp y email obligatorios.
- Aviso de privacidad y uso de datos.
- Paso de pago separado, con resumen, política de devolución y aviso del enlace único de gestión.
- Textos de introducción y opciones de comisión de Mercado Pago reescritos para que sean comprensibles para el comercio.

### Configuración del comercio

- En `Configuración > Horarios` se puede definir:
  - separación de la grilla: 15, 30, 45 o 60 minutos;
  - anticipación mínima para reservar, en minutos.
- Ambas opciones también aparecen en el onboarding.
- La duración real del turno sigue siendo propia de cada servicio; el intervalo solo controla cada cuánto se ofrece un inicio.
- En `Configuración > Pagos y señas` se puede definir el plazo reembolsable entre 0 y 720 horas. Cero significa que se puede cancelar con devolución hasta el inicio del turno.

### Cancelación, devolución y gestión

- La regla está centralizada en `src/domain/booking/cancellation-policy.ts`.
- Al cancelar antes o exactamente en el límite:
  - la cita queda con `depositDisposition: "refund_required"`;
  - si la seña fue pagada por Mercado Pago, se solicita la devolución total con una clave de idempotencia estable;
  - si fue por transferencia, queda en la cola manual `A devolver`.
- Al cancelar después del límite, se guarda `depositDisposition: "retained"` y no se muestra ni dispara un reembolso.
- El reembolso automático filtra exclusivamente pagos de tipo seña; nunca toca otros cobros que pueda tener el turno.
- Si Mercado Pago falla, la cancelación no se revierte: queda registrada para devolución manual y con estado técnico de error.
- La pantalla `Mi turno` explica si la seña todavía es reembolsable, pide confirmación antes de cancelar y muestra el resultado.
- La reprogramación desde el enlace público inicia una conversación de WhatsApp prearmada. Todavía no existe reprogramación transaccional autoservicio.
- Para pagos aprobados por Mercado Pago y reservas por transferencia se envía por email el enlace único de gestión, siempre que SES esté configurado.
- Los datos variables incluidos en emails HTML ahora se escapan y los enlaces se restringen a HTTP/HTTPS.

### Botones de reprogramación interna

- Se reemplazaron las opciones ambiguas por dos acciones grandes:
  - `Usar la misma seña`;
  - `Nuevo turno sin seña`.
- Se agregó una acción clara para volver.

### Corrección adicional encontrada durante la revisión

- El filtro de plataforma ya contemplaba el estado `demo` en el modelo pero no en el cliente ni en sus totales. Se completó esa rama y se actualizaron las pruebas.

## Datos nuevos y compatibilidad

Campo nuevo en `tenant.settings`:

```ts
cancellationRefundHours?: number
```

- Valor efectivo por defecto: `24`.
- Máximo aceptado: `720`.
- No requiere migración obligatoria. Los tenants existentes usan el fallback hasta que guarden la configuración.
- Los tenants nuevos guardan 24 horas explícitamente.

La API pública agrega:

```ts
cancellation_refund_hours: number
slot_interval_min: number
bookable_weekdays: number[]
```

Los slots públicos ahora tienen esta forma:

```ts
{ starts_at: string; available: boolean }
```

## Archivos clave para continuar

- `src/domain/booking/cancellation-policy.ts`: regla pura de plazo y disposición.
- `src/server/mercadopago/refunds.ts`: devolución automática e idempotente de señas.
- `src/app/(public)/[slug]/booking-flow.tsx`: flujo público completo.
- `src/app/(public)/[slug]/public-month-calendar.tsx`: calendario de dos meses.
- `src/app/(public)/[slug]/mi-turno/[token]/actions.ts`: cancelación pública.
- `src/app/(public)/[slug]/mi-turno/[token]/page.tsx`: estado y gestión del turno.
- `src/app/(app)/app/[tenant]/configuracion/booking-rules-form.tsx`: intervalo y anticipación.
- `src/app/(app)/app/[tenant]/configuracion/cancellation-policy-form.tsx`: política de devolución.

## Validación realizada

- `npx eslint src e2e/public-booking.spec.ts playwright.config.ts`: aprobado.
- `npm run typecheck`: aprobado.
- `npm test`: 27 archivos y 282 tests aprobados.
- `npm run build`: aprobado.
- `npx playwright test e2e/public-booking.spec.ts --project=pixel-7`: 7/7 aprobados, incluyendo Mercado Pago stub, transferencia y estados del checkout.
- `git diff --check`: aprobado.

Nota del entorno Windows: este checkout se expone también por `C:\Users\Juanc\Documents\...`, pero Node resuelve la ruta física como `D:\JustCreate\Clientes\Claude Proyectos\TurnCreate\turncreate`. Para evitar que Next concatene ambas rutas, ejecutar Playwright desde la ruta física `D:`. El comando del web server E2E se cambió a `npx next dev -p 3100` para no depender del reenvío de argumentos de la versión local de npm.

## Límites conocidos y siguiente iteración

- WhatsApp automático no está implementado porque el proyecto no tiene un proveedor de mensajería saliente configurado. Hoy el enlace se envía por email y la reprogramación abre WhatsApp con un mensaje prearmado.
- La devolución automática se probó a nivel de tipos, dominio y flujo local; para una prueba real se necesita un pago de prueba reembolsable en una cuenta Mercado Pago conectada.
- Conviene agregar una tarea de reconciliación de devoluciones `in_process` para consultar su estado final en Mercado Pago.
- La reprogramación pública autoservicio debería diseñarse como una operación atómica que mueva ocupación y preserve la seña; no debe implementarse como dos acciones sueltas.

## Facturación electrónica ARCA (ex-AFIP)

Sí, se puede sumar. Para TurnCreate conviene tratarla como un módulo desacoplado de pagos y turnos, no llamar a ARCA dentro de la transacción que confirma una reserva.

### Arquitectura recomendada

1. Crear una interfaz `FiscalProvider` y una implementación `ArcaWsfeProvider`.
2. Cada comercio configura CUIT, razón social, condición fiscal, ingresos brutos, domicilio fiscal, punto de venta Web Services y régimen impositivo.
3. Usar delegación del servicio `wsfe` a la identidad/certificado de TurnCreate siempre que el encuadre fiscal y legal lo permita. Es preferible a pedir y almacenar la clave privada de cada comercio. ARCA documenta certificados, asociación al servicio y delegación para producción.
4. Autenticar contra WSAA, cachear el Ticket de Acceso durante su vigencia y emitir por WSFEv1.
5. Procesar la emisión mediante una outbox asíncrona e idempotente:
   - evento de negocio;
   - trabajo fiscal pendiente;
   - consulta del último número autorizado;
   - `FECAESolicitar`;
   - persistencia inmutable de tipo, punto de venta, número, CAE, vencimiento, observaciones y request/response sanitizados.
6. Serializar por comercio + punto de venta para evitar colisiones en la numeración.
7. Generar representación PDF/HTML con el QR obligatorio y enviarla por email.
8. Ante una devolución de un comprobante ya emitido, generar la nota de crédito asociada; nunca borrar ni editar el comprobante original.

### Decisiones de producto pendientes

- Definir con contador si la seña se factura al cobrarla o si se factura el servicio completo al finalizar. No debe fijarse esta conducta sin validar el tratamiento fiscal de cada comercio.
- Soportar al menos monotributistas/exentos (comprobantes C) y responsables inscriptos (A/B según receptor). ARCA indica que la clase depende de la condición del emisor y receptor.
- Pedir documento y condición IVA del cliente solo cuando corresponda. Los límites y parámetros fiscales cambian: deben consultarse o configurarse con vigencia, no hardcodearse.
- Separar homologación y producción, con rotación y alertas de vencimiento de certificados.

### Fases sugeridas

- Fase 1: modelo fiscal, pantalla de configuración, outbox e integración WSAA/WSFEv1 en homologación.
- Fase 2: factura C a consumidor final, CAE, QR, descarga y email.
- Fase 3: A/B, notas de crédito por devolución, reintentos y conciliación.
- Fase 4: tablero fiscal, exportación para contador y monitoreo de certificados.

### Fuentes oficiales consultadas

- ARCA, WSAA y acceso con certificados: https://www.arca.gob.ar/ws/documentacion/wsaa.asp
- ARCA, certificados de homologación/producción y delegación: https://www.arca.gob.ar/ws/documentacion/certificados.asp
- ARCA, ayuda y manuales de Factura Electrónica: https://www.arca.gob.ar/fe/ayuda/webservice.asp
- Manual oficial WSFEv1, versión vigente publicada: https://www.arca.gob.ar/ws/documentacion/manuales/manual-desarrollador-ARCA-COMPG.pdf
- ARCA, QR obligatorio en comprobantes electrónicos: https://www.arca.gob.ar/fe/qr/conceptos-generales.asp
- ARCA, tipos de comprobante por condición fiscal: https://www.arca.gob.ar/facturacion/regimen-general/comprobantes.asp
- ARCA, facturación de monotributistas: https://arca.gob.ar/facturacion/monotributo/comprobantes.asp

## Indicaciones para Claude

- Leer este archivo y `AGENTS.md` antes de continuar.
- Mantener la regla fiscal/de cancelación en funciones puras y testeables.
- No eliminar `depositDisposition`; alimenta caja, reportes y la cola manual.
- Toda llamada de devolución o facturación externa debe ser idempotente y reconciliable.
- No registrar tokens de gestión, access tokens, claves privadas ni respuestas fiscales completas con datos personales en logs.
- Antes de tocar reprogramación pública, diseñar la transición atómica de ocupación y seña.

## Rediseño de landing y color por comercio

Segunda entrega del 2026-10-21. La referencia elegida fue la opción visual 1 y quedó publicada en producción.

### Publicación en producción

- URL: `https://turn.justcreate.com.ar/landing`.
- Commit funcional desplegado: `ac9f441365be9d80007b267cf5fd507b3ee75e3f`.
- GitHub Actions aprobó lint, typecheck y tests, pero omitió el deploy porque todavía faltan los secrets `VPS_SSH_KEY`, `VPS_HOST` y `VPS_USER`.
- Se hizo un deploy manual seguro: build con Node 22 en `/root/turncreate-release-ac9f441`, prueba canary en el puerto 3012, cambio de release y reinicio de `turncreate` en PM2.
- La release anterior quedó temporalmente disponible en `/root/turncreate-previous-a79a35e` como rollback.
- Validación posterior: `/landing` y `/login` responden 200 por HTTPS; PM2 está online; el proceso real de Next usa Node `22.23.3`.
- Auditoría remota en 1440x1000 y 390x844: sin overflow horizontal ni errores de consola; menú mobile, demo de reserva, integraciones, planes, animaciones y selector de color verificados.

### Landing nueva

- Hero premium con la propuesta de valor y una composición real de dashboard + turnero mobile.
- Secciones con mucho más aire editorial y comportamiento responsive específico, no una simple reducción de desktop.
- Demo interactiva del flujo de reserva de 5 pasos, incluyendo política de devolución y enlace de gestión.
- Vista del panel con agenda, clientes, pagos, caja y reportes.
- Personalización interactiva con cinco paletas accesibles.
- Mercado Pago se presenta como disponible; ARCA se muestra de forma explícita como `Próximamente · beta`, prevista para el plan Equipo.
- Planes visibles renombrados a `Individual`, `Estudio` y `Equipo`. Los IDs internos siguen siendo `solo`, `equipo` y `pro` para conservar compatibilidad.
- Los precios de la landing salen de `DEFAULT_PLAN_PRICES_ARS`, evitando una segunda fuente hardcodeada.
- El período de prueba por defecto se alineó a 7 días con registro y comunicación comercial.
- Hover lift, fades, movimiento ambiental, cambios de panel y soporte de `prefers-reduced-motion`.

Archivos principales:

- `src/app/(marketing)/page.tsx`
- `src/app/(marketing)/layout.tsx`
- `src/app/(marketing)/marketing.css`
- `src/app/(marketing)/marketing-product-showcase.tsx`
- `src/app/(marketing)/marketing-mobile-menu.tsx`
- `public/marketing/turncreate-light-waves.webp`
- `public/marketing/turncreate-dark-waves.webp`

### Color de marca

- Nuevo campo opcional top-level `tenant.brandColor`; tenants existentes caen de forma segura a `iris`.
- Paletas cerradas: violeta, rosa, esmeralda, azul y ámbar. No se aceptan hex arbitrarios, para mantener contraste y consistencia.
- Se configura en `Configuración > Información del local > Color de tu marca`.
- El tema se inyecta mediante variables CSS tanto en el panel autenticado como en el turnero público. Botones, acciones primarias, estados activos, foco y sombras de marca adoptan la paleta.
- Los tenants nuevos guardan `iris` explícitamente.

Archivos principales:

- `src/lib/brand-theme.ts`
- `src/lib/brand-theme.test.ts`
- `src/app/(app)/app/[tenant]/configuracion/brand-color-form.tsx`
- `src/app/(app)/app/[tenant]/configuracion/actions.ts`
- `src/app/(app)/app/[tenant]/layout.tsx`
- `src/app/(public)/[slug]/layout.tsx`
- `src/app/(public)/[slug]/actions.ts`
- `src/server/firebase/tenants.ts`

No requiere migración: el fallback visual cubre documentos viejos hasta que el comercio guarde su elección.

### QA de esta entrega

- `npx eslint src e2e/public-booking.spec.ts playwright.config.ts`: aprobado.
- `npm run typecheck`: aprobado.
- `npm test`: 28 archivos y 284 tests aprobados.
- `npm run build`: aprobado.
- `npx playwright test e2e/public-booking.spec.ts --project=pixel-7`: 7/7 aprobados.
- Auditoría visual y funcional documentada en `design-qa.md`: `passed`.
- Capturas y comparaciones en `artifacts/landing-redesign/`.

### Cuidado al continuar

- No anunciar ARCA como disponible hasta completar homologación, emisión idempotente, notas de crédito y revisión contable.
- Mantener los IDs internos de plan aunque cambien sus nombres comerciales.
- Si se agregan paletas, validar contraste AA de texto blanco sobre `primary` y mantener todos los tokens de `brandThemeStyle`.
- El componente `Reveal` usa un umbral bajo a propósito: un valor alto vuelve invisibles las secciones más altas que el viewport.

## Tercera entrega — turnero, marca, alertas y caja (2026-10-21)

Esta sección reemplaza las descripciones anteriores del calendario de dos meses y de las paletas cerradas.

### Reserva pública

- El calendario muestra un solo mes. Las flechas permiten alternar únicamente entre el actual y el siguiente.
- Elegir una fecha avanza inmediatamente a horarios; ya no existe el clic redundante en `Ver horarios`.
- Fecha y horario conservan acciones sticky dentro del viewport mobile. Los horarios ocupados siguen visibles, tachados, deshabilitados y rotulados.
- Nombre completo, WhatsApp, email y edad son obligatorios y se validan también en servidor. La edad se conserva en el snapshot del turno y actualiza el año de nacimiento aproximado de la ficha.
- La pantalla de datos muestra servicio, fecha, hora, precio total y seña. La pantalla de pago separa seña, recargo (si corresponde) y `Total a pagar ahora`.
- La confirmación final oculta la introducción genérica, indica revisar email o WhatsApp según configuración y mantiene el enlace `Ver mi turno`.
- Los indicadores de paso, botones, selección de fecha/hora y confirmación usan los tokens del color del comercio.

### Color de marca

- `tenant.brandColor` acepta los IDs históricos (`iris`, `rose`, etc.) o un hexadecimal `#rrggbb`.
- El selector nativo permite cualquier color, más campo hexadecimal, presets y preview en vivo.
- El servidor rechaza colores con contraste menor a 4.5:1 contra blanco. No alcanza con bloquear solo blanco.
- `brandThemeStyle` deriva hover, light, deep, glow y soft; no requiere migración y mantiene compatibilidad con las paletas existentes.

### Alertas administrativas

- El layout consulta turnos creados en las últimas 48 horas y los muestra en la campana con enlace directo.
- Un `pending_payment` con `awaitingTransfer` se muestra como `Transferencia por confirmar`; los demás, como `Nuevo turno`.
- El cliente consulta `/api/app/[tenant]/notifications` cada 20 segundos. La ruta exige sesión y acceso de lectura al tenant.
- Al detectar un ID nuevo reproduce un doble tono suave. Por restricciones del navegador, el sonido se habilita después de la primera interacción con la página; la campana muestra ese estado.
- Desktop y mobile deduplican el sonido con una clave local por tenant.

### Caja, cobros y reportes

- `Cobrar` permite un importe parcial del servicio o el saldo completo.
- Se puede dividir el total entre dos medios distintos: efectivo, transferencia, Posnet o Mercado Pago ya acreditado.
- El saldo del turno descuenta solo el importe aplicado al servicio. Los productos no alteran ese saldo.
- Los documentos de pago separan servicio y producto cuando ambos se cobran juntos; todos comparten `paymentGroupId`. Así los totales por método no se duplican y `Señas`, `Pagos totales`, `Saldos` y `Productos / ajustes` son exactos.
- Un cobro manual marcado como Mercado Pago lleva `feeUnknown: true`: hasta reconciliar el cobro real no inventa una comisión.
- Caja y Reportes muestran el desglose por tipo de cobro; el cobro mixto suma cada porción en su medio.
- Los movimientos sueltos se registran como `Gasto`, `Retiro` o `Ingreso`; el servidor deriva entrada/salida desde la categoría y no confía en un `type` enviado por el cliente.
- La configuración existente de comisión sigue siendo la fuente de verdad: `absorbed` (la absorbe el comercio) o `passed_through` (se agrega al total que paga el cliente).

Archivos centrales de esta entrega:

- `src/app/(public)/[slug]/booking-flow.tsx`
- `src/app/(public)/[slug]/public-month-calendar.tsx`
- `src/lib/brand-theme.ts`
- `src/app/(app)/app/[tenant]/notifications-button.tsx`
- `src/server/firebase/app-notifications.ts`
- `src/app/(app)/app/[tenant]/caja/actions.ts`
- `src/domain/money/split-payment.ts`
- `src/server/firebase/stats-model.ts`

### Marcas e integraciones

- El logo dibujado de Mercado Pago fue reemplazado por el SVG oficial entregado en `public/brands/mercado-pago.svg`.
- La landing usa el logo ARCA entregado en `public/brands/arca.jpeg`.
- ARCA continúa rotulado `Próximamente · beta`; no se anuncia emisión fiscal activa.
- Revisión Mercado Pago local: firma HMAC con ventana temporal, `x-request-id`, idempotencia, `external_reference`, OAuth de un solo uso, tokens cifrados, HTTPS obligatorio y webhooks server-side están presentes. No se encontraron bloqueantes de severidad alta. Queda pendiente una prueba real con usuarios/cuenta de prueba externa y la reconciliación de devoluciones `in_process` ya registrada como límite conocido.

### QA de esta entrega

- `npm run typecheck`: aprobado.
- `npm test`: 29 archivos / 291 tests aprobados.
- `npx eslint src e2e`: aprobado.
- `npm run build`: aprobado.
- `npx playwright test e2e/public-booking.spec.ts --project=pixel-7`: 7/7 aprobado contra Firebase Emulator y Mercado Pago stub.
- `npm run lint` global detecta únicamente archivos generados y scripts dentro del worktree ajeno no versionado `.claude/worktrees/`; el código versionable se validó por separado y esa carpeta no debe agregarse al commit.

### Indicaciones adicionales para Claude

- No volver a juntar producto y servicio en un único pago categorizado como seña/saldo: rompe el desglose.
- `Mercado Pago (ya acreditado)` en caja es registro manual, no inicia Checkout Pro.
- No eliminar `feeUnknown`; evita reportar un neto ficticio.
- Si se cambia el polling, conservar autorización por tenant y deduplicación de sonidos.
- La notificación no usa push en segundo plano: funciona mientras el panel está abierto. Web Push sería una fase distinta.

### Publicación de esta entrega

- Commit funcional: `093824687269a3359188f651dc6979325369e08f`.
- Subido a GitHub en `main` y `wip/suscripciones`.
- Release construida con Node `22.23.3` en `/root/turncreate-release-0938246` y validada primero como canary en el puerto 3012.
- Canary: `/landing`, `/demo-individual`, logo Mercado Pago y logo ARCA respondieron 200; la API de notificaciones sin sesión respondió 401.
- Cambio atómico completado en PM2. `/root/turncreate` quedó en `0938246` y `/root/turncreate-previous-cb18288` conserva el rollback anterior.
- El rollback más viejo `/root/turncreate-previous-a79a35e` se eliminó antes del build para liberar espacio; sigue recuperable desde Git.
- Verificación HTTPS externa posterior: `/landing`, `/demo-individual`, `/login` y el SVG oficial de Mercado Pago respondieron 200; PM2 quedó `online`.

# TurnCreate — handoff técnico

Fecha de corte: 2026-10-15 (America/Argentina/Buenos_Aires)

## 1. Estado ejecutivo

TurnCreate quedó rediseñado con foco mobile y publicado en producción. El código, los índices Firestore y el deploy manual están actualizados. El repositorio estaba limpio y sincronizado con `origin/main` antes de agregar este documento.

Pendientes reales:

1. Provisionar las tres cuentas iniciales. **Todavía no fueron creadas.**
2. Completar una autorización OAuth de Mercado Pago resolviendo manualmente el reCAPTCHA.
3. Hacer un pago real de prueba con usuarios de prueba y ejecutar la evaluación oficial con el `payment_id`.
4. Opcional: automatizar el deploy de GitHub Actions cargando los secretos del VPS.

No hay que rehacer el rediseño ni la integración de pagos.

## 2. Repositorio y producción

- Repositorio local: `D:\JustCreate\Clientes\Claude Proyectos\TurnCreate\turncreate`
- Rama: `main`
- Producción: `https://turn.justcreate.com.ar`
- Directorio de aplicación en el VPS: `/root/turncreate`
- Proceso PM2: `turncreate`
- Firebase project: `turncreate-prod`

Commits relevantes ya publicados:

- `546f77a` — responder 404 para slugs públicos inválidos.
- `e5a9254` — operación mobile, pagos, seguridad y provisioning.
- `1484051` — onboarding, home, servicios y Ayuda.
- `08e36ec` — cobertura E2E y corrección de iconos.
- `5ded75d` — sesión posterior al cambio de contraseña y encoding.
- `8252250` — integración base de Mercado Pago.

El deploy automático de GitHub Actions no está habilitado porque faltan los secretos `VPS_SSH_KEY`, `VPS_HOST` y `VPS_USER`. El deploy vigente se hizo manualmente y está operativo.

## 3. Validación realizada

Último ciclo completo exitoso:

- ESLint: aprobado.
- TypeScript: aprobado.
- Vitest: 15 archivos, 151 tests aprobados.
- Vitest con `TZ=UTC`: aprobado.
- Playwright: 52/52 tests aprobados, sin retries.
- Viewports: Pixel 7, 320, 360 y 390 px.
- Build de Next.js 16.3.8: aprobado.
- `npm audit --omit=dev`: 0 vulnerabilidades.
- Auditoría completa: 10 alertas transitivas sólo de desarrollo; no aplicar `npm audit fix --force` ni degradar Firebase.
- Índices Firestore: desplegados y READY.
- Smoke productivo: landing, login y demo en 200; webhook sin firma en 401; cron sin secreto en 401; OAuth sin sesión redirige al login.
- Smoke productivo autenticado en home, agenda, clientes, caja y reportes: sin errores y sin overflow horizontal.

Capturas locales disponibles en `test-results/`:

- `production-home-390.png`
- `production-agenda-390.png`
- `production-reportes-390.png`
- `mp-oauth-entry.png`

## 4. UX/UI implementada

- Home mobile tipo botonera inspirada en Perladerm, conservando la identidad de TurnCreate.
- KPIs de cobrado hoy, por cobrar, turnos del día y total mensual.
- Botonera de Agenda, Calendario, Clientes, Caja, Reportes, Servicios, Link público y Configuración.
- App bar y navegación mobile, safe areas y targets táctiles adecuados.
- Back físico mediante rutas reales; los modales/sheets usan historial.
- Tutorial roto eliminado; onboarding/checklist de configuración.
- Agenda con nombre y servicio prioritarios, hora compacta y estado pequeño.
- Calendario con conteos por día, selección y fecha actual claras.
- Sin drag accidental al intentar hacer scroll.
- Clientes sin scroll lateral, avatar con fallback, notas e historial.
- Caja con cobros pendientes y desglose por método.
- Reportes con tendencia mensual, ingresos, costos MP, neto, servicios y analítica.
- Servicios agrupables en categorías y ordenables.
- Botón de soporte por WhatsApp al `+54 11 2452-7669`.
- Perfil Solo sin selector innecesario de profesional y sin arqueo de equipo.

## 5. Mercado Pago

### Implementado

- SDK `mercadopago@3.6.1`.
- Marketplace + Checkout Pro con OAuth por tenant.
- Tokens de vendedor cifrados, persistentes y renovables.
- Una cuenta vendedora no puede conectarse simultáneamente a dos tenants.
- Hold de 10 minutos.
- El turno sólo se crea/confirma después de un pago aprobado.
- Preferencia construida con importes confiables del servidor.
- Expiración configurada, máximo una cuota y medios offline excluidos.
- Webhook con HMAC, timestamp, `x-request-id`, comparación segura y deduplicación.
- Reconsulta del pago a Mercado Pago antes de aplicar cambios.
- Manejo de aprobación tardía con `refund_required` si el horario ya no está libre.
- Seña, comisión, recargo, importe aplicado y neto separados.
- Comisión absorbida o trasladada por tenant.
- La reserva pública queda desactivada hasta conectar OAuth y se desactiva al desconectar.

Archivos centrales:

- `src/app/api/integrations/mercadopago/connect/route.ts`
- `src/app/api/integrations/mercadopago/callback/route.ts`
- `src/app/api/webhooks/mercadopago/route.ts`
- `src/server/mercadopago/`
- `src/app/(app)/app/[tenant]/configuracion/mercadopago-settings.tsx`

### Validación oficial realizada

- App TurnCreate: `5045809422290209`.
- Validadores oficiales de Marketplace y Checkout Pro: aprobados.
- Checklist de calidad revisado.
- No se ejecutó `quality_evaluation` porque todavía no existe un `payment_id` de prueba reciente.
- No se presentó homologación.

### Bloqueo actual

El OAuth llega correctamente al login de Mercado Pago, pero aparece reCAPTCHA. No debe automatizarse ni evadirse.

Los usuarios de prueba disponibles pertenecen al panel:

`https://www.mercadopago.com.ar/developers/panel/app/5941090035007510/test-users`

- Vendedora: ID `2068331202`, usuario `TESTUSER1055508240`.
- Compradora: ID `3341711424`, usuario `TESTUSER8432144625140652827`.

Mercado Pago devolvió las contraseñas enmascaradas porque esos usuarios ya existían. Recuperarlas o regenerarlas desde el panel. No escribirlas en el repositorio.

Secuencia para terminar:

1. Entrar al panel de usuarios de prueba y recuperar/regenerar las claves.
2. Ingresar a TurnCreate con el demo.
3. Abrir `Configuración → Mercado Pago → Conectar Mercado Pago`.
4. Autorizar con la vendedora de prueba y resolver el reCAPTCHA manualmente.
5. Hacer una reserva pública con la compradora de prueba.
6. Confirmar que el webhook deja el intento en `approved`, crea el turno y libera el hold.
7. Tomar el `payment_id` y correr la evaluación oficial de calidad.
8. Confirmar en el dashboard de Mercado Pago que el webhook productivo apunta a `https://turn.justcreate.com.ar/api/webhooks/mercadopago` con topic `payment`.

Pendiente no bloqueante: la devolución automática por API todavía no está implementada; hoy queda marcada como `refund_required` para intervención de soporte.

## 6. Alta de las tres cuentas

**Estado: no ejecutada.** Los dry-runs confirmaron que los usuarios/slugs no existían.

Script:

`scripts/provision-initial-nail-accounts.cjs`

Archivo local seguro ya creado e ignorado por Git:

`.env.provision.local`

En el último chequeo los tres valores seguían vacíos. Deben completarse localmente:

```env
TURNCREATE_ALISSON_PASSWORD=
TURNCREATE_PONTE_PASSWORD=
TURNCREATE_GENERIC_PASSWORD=
```

No imprimir ni copiar los valores en logs, comandos, commits o documentación.

Comando de alta real:

```powershell
node --env-file=.env.local --env-file=.env.provision.local scripts/provision-initial-nail-accounts.cjs
```

El script es idempotente: crea sólo lo ausente y preserva configuraciones existentes.

Cuentas esperadas:

| Negocio | Email | Slug |
|---|---|---|
| Alisson Nails | `alison@turncreate.com.ar` | `alisson-nails` |
| Ponte Coquetta STUDIO | `pontecoquetta@turncreate.com.ar` | `ponte-coquetta-studio` |
| Generic Nails Studio | `nails.studio@turncreate.com.ar` | `generic-nails-studio` |

Configuración esperada por cuenta:

- Plan Solo, rubro estética/uñas y perfil unipersonal.
- Buenos Aires / ARS.
- Lunes a sábado, 09:00–19:00.
- Intervalos de 15 minutos.
- Anticipación mínima de 12 horas y horizonte de 60 días.
- Seña fija obligatoria de $10.000.
- Comisión MP absorbida inicialmente.
- Reserva pública desactivada hasta completar OAuth.
- Un profesional con el nombre del negocio.
- Tres categorías y doce servicios activos.
- `mustChangePassword: true` para usuarios nuevos.

Después del alta verificar sin exponer claves:

1. Existencia de los tres usuarios en Firebase Auth.
2. Slug → tenant correcto.
3. Membership owner activa.
4. Un staff activo.
5. Tres categorías y doce servicios.
6. `publicBookingEnabled === false`.
7. Login y redirección al cambio obligatorio de contraseña.
8. Que el panel manual funcione antes de conectar Mercado Pago.

## 7. Bugs y decisiones importantes

- Se corrigió el bug que guardaba turnos un día antes en servidores UTC.
- Los rangos diarios/semanales/mensuales usan la zona horaria del tenant.
- Cancelados y expirados no contaminan la agenda activa.
- La navegación mobile conserva la fecha al crear un turno.
- Caja y dashboard calculan dinero por la fecha real del pago.
- Los pagos reducen saldo por importe aplicado, no por recargo.
- `Marcar como pagado` exige método e importe y genera un pago.
- El alta pública no confía en datos de precio enviados por el navegador.
- Acciones sensibles validan sesión y acceso al tenant.
- Un slug público inválido responde 404 en vez de 500.

## 8. Operación y deuda técnica

- PM2 funciona actualmente con Node 20.20.2. Next.js funciona, pero conviene migrar el daemon/proceso a Node 22 antes de enero de 2027 por futuras exigencias del AWS SDK. No reiniciar globalmente PM2 sin coordinar: aloja otros sitios.
- Next muestra una advertencia por un `package-lock.json` externo en `/root`; no bloquea el build.
- Las alertas de auditoría restantes son transitivas de herramientas de desarrollo. No usar `npm audit fix --force`.
- El documento formal de arquitectura con la plantilla solicitada no se generó porque el conector documental no estaba disponible. Este archivo contiene el handoff operativo completo.

## 9. Orden recomendado para continuar

1. Completar y guardar `.env.provision.local`.
2. Ejecutar el provisioning y validar las tres cuentas.
3. Resolver OAuth/reCAPTCHA en el demo con la vendedora de prueba.
4. Ejecutar un pago de prueba completo y evaluar el `payment_id`.
5. Probar cada cuenta creada en 390 px y verificar cambio de contraseña.
6. Activar públicamente una cuenta por vez después de conectar su propio Mercado Pago.
7. Monitorear webhooks, holds vencidos, `refund_required` y errores.

No desplegar reservas públicas sin Mercado Pago conectado cuando la seña obligatoria esté activa.
